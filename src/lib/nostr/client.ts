// Nostr クライアント。リレーへの接続・publish はこの 1 モジュールに集約する。
// 他モジュールや React 島から relay 呼び出しをばら撒かない（guidelines §3）。

import { SimplePool } from "nostr-tools/pool";
import { nip19 } from "nostr-tools";
import {
  classifyDiscoverQuery,
  discoverKeywordFilters,
  discoverTagFilters,
  selectAuthorsByName,
} from "../feed/discover.ts";
import {
  mergePostsById,
  parseProfile,
  parseProfileName,
  parsePost,
  type FeedPost,
  type Profile,
} from "../feed/parse.ts";
import { rankHashtags, type RankedTag } from "../feed/popular.ts";
import { countLikes } from "../feed/reactions.ts";
import { findPlantByTerm, plantTagValues } from "../plants/search.ts";
import { GENERAL_RELAYS, RELAYS, SEARCH_RELAYS, TAG_HANOBA } from "./constants.ts";
import { buildDeletionEvent, buildNoteTemplate, buildProfileEvent, type ProfileFields } from "./events.ts";
import {
  getProfileExtra,
  getPublicKeyHex,
  mergeProfileExtra,
  setDisplayName,
  setProfileExtra,
  signTemplate,
} from "./keys.ts";
import { extractHashtags } from "./tags.ts";
import { deleteImage } from "./upload.ts";
import type { NostrEvent } from "./types.ts";

// リレー取得の最大待ち時間（ms）。EOSE を返さない・接続が滞るリレーがあっても
// querySync をここで打ち切り、UI が「読み込み中…」で固まらないようにする（session640 バグ）。
// 期限内に届いたイベントだけで解決する（部分結果でも空でも UI は前へ進む）。
const QUERY_MAXWAIT = 4000;

// SimplePool はシングルトンとして遅延生成する（最初の publish 時に WebSocket 接続）。
let pool: SimplePool | null = null;

function getPool(): SimplePool {
  if (pool === null) {
    pool = new SimplePool();
  }
  return pool;
}

/**
 * 署名済みイベントを全リレーへ publish する。
 * いずれか 1 リレーが OK を返せば成功（Promise.any）。全滅なら throw。
 */
export async function publishEvent(event: NostrEvent): Promise<void> {
  const promises = getPool().publish(RELAYS, event);
  await Promise.any(promises);
}

/**
 * 投稿テンプレートを構築・署名・publish し、署名済みイベントを返す。
 * 返り値は呼び出し側（フィード即時反映など）の利便のため。
 */
export async function signAndPublishNote(input: {
  caption: string;
  imageUrls?: string[];
  createdAt?: number;
}): Promise<NostrEvent> {
  const template = buildNoteTemplate(input);
  const signed = await signTemplate(template);
  await publishEvent(signed);
  return signed;
}

/**
 * 最近の hanoba 投稿から、本文で使われた #ハッシュタグの一覧を取得する。
 * 一言入力中のタグ補完（emergent taxonomy・DESIGN §3）の候補プールに使う。
 *
 * - `{"#t":["hanoba"], kinds:[1]}` で hanoba タグ持ちの最近の投稿を取得
 * - 各 content から extractHashtags で本文 # を抽出 → 出現順で flat + dedup
 * - 失敗（オフライン等）は throw せず空配列にフォールバックする
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchKnownHashtags(limit = 200): Promise<string[]> {
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      {
        kinds: [1],
        "#t": [TAG_HANOBA],
        limit,
      },
      { maxWait: QUERY_MAXWAIT },
    );
    const seen = new Set<string>();
    const result: string[] = [];
    for (const event of events) {
      for (const tag of extractHashtags(event.content)) {
        if (seen.has(tag)) continue;
        seen.add(tag);
        result.push(tag);
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 最近の hanoba 投稿から、本文ハッシュタグを**出現回数で人気順**に集計する（#22）。
 * タグクラウド/ランキング（選んで入力）の素データ。失敗は空配列。
 */
export async function fetchPopularHashtags(limit = 30): Promise<RankedTag[]> {
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      { kinds: [1], "#t": [TAG_HANOBA], limit: 200 },
      { maxWait: QUERY_MAXWAIT },
    );
    return rankHashtags(
      events.map((e) => extractHashtags(e.content)),
      limit,
    );
  } catch {
    return [];
  }
}

/**
 * hanoba フィードを取得する。`t:hanoba` で絞った kind:1 投稿だけを拾う
 * （mypace の一般投稿は hanoba に流さない＝DESIGN §6・Issue #4）。
 *
 * - `{"#t":["hanoba"], kinds:[1]}` で hanoba タグ持ちの最近の投稿を取得
 * - 各 event を parsePost → mergePostsById で id dedup・createdAt 降順
 * - hanoba は写真 SNS のため、画像 URL を持たない投稿（imageUrl === null）は除外する
 * - 失敗（オフライン等）は throw せず空配列にフォールバックする
 *
 * クロスクライアントの本文 # 全文検索（NIP-50・DESIGN §6 二段構え）は
 * この Issue では使わない（将来の discover 機能の領分）。ここは hanoba 限定。
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchHanobaFeed(limit = 100): Promise<FeedPost[]> {
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      {
        kinds: [1],
        "#t": [TAG_HANOBA],
        limit,
      },
      { maxWait: QUERY_MAXWAIT },
    );
    const posts = mergePostsById(events.map(parsePost));
    return posts.filter((post) => post.imageUrl !== null);
  } catch {
    return [];
  }
}

/**
 * 投稿（kind:1）に対するいいね数を取得する。NIP-25 の kind:7 リアクションを
 * `#e` で対象投稿に絞って集計する（表示のみ・書き込みはこの Issue では作らない）。
 *
 * - `{kinds:[7], "#e":[eventId]}` で対象投稿宛のリアクションを取得
 * - countLikes で dislike を除外し、同一 pubkey は 1 票に畳む（1 人 1 いいね）
 * - 失敗（オフライン等）は throw せず 0 にフォールバックする
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchReactionCount(eventId: string, limit = 500): Promise<number> {
  try {
    // limit はリレーから取る kind:7 の上限。超人気投稿（リアクション > limit）では概数になる。
    // kind:7 の #e フィルタは通常リレーで足りる（NIP-50 検索リレーは本文全文検索用＝不要）。
    const reactions = await getPool().querySync(
      [...GENERAL_RELAYS],
      {
        kinds: [7],
        "#e": [eventId],
        limit,
      },
      { maxWait: QUERY_MAXWAIT },
    );
    return countLikes(reactions);
  } catch {
    return 0;
  }
}

/**
 * クロスクライアント discover（DESIGN §6＋#24）。mypace 等 他クライアントの植物投稿も
 * 集約する。hanoba フィード（#4・t:hanoba 限定）とは別物で、hanoba 投稿だけに絞らない
 * （DiscoverGrid・別ページ/別島から呼ぶ）。
 *
 * 入力は classifyDiscoverQuery でモード分岐する:
 * - **tag モード**（`#アガベ`）= 二段構え（DESIGN §6）:
 *     ① {"#t":[tag]}        を GENERAL_RELAYS（t タグ持ち）
 *     ② NIP-50 search:"#tag" を SEARCH_RELAYS（本文 #タグ全文検索）
 * - **keyword モード**（`葉焼け` 等・#24）= 本文キーワード全文検索:
 *     ① NIP-50 search:"葉焼け" を SEARCH_RELAYS（本文中の素の語・# 無しも拾う）
 *     ② {"#t":[葉焼け]}        を GENERAL_RELAYS（同語の t タグ持ちも一応拾う）
 *
 * いずれも片方のリレー群が落ちても他方を活かすため Promise.allSettled で待ち、
 * parsePost → mergePostsById（id dedup・createdAt 降順）、画像ありのみに絞る。
 * 空入力・全滅・失敗は throw せず空配列にフォールバックする。
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchDiscover(query: string, limit = 100): Promise<FeedPost[]> {
  const { mode, term } = classifyDiscoverQuery(query);
  if (term === "") return [];

  const pool = getPool();

  // 著者検索（#68）。特定の人の植物を引く（昔のユーザーの新着待ちでなく能動チェック）。
  if (mode === "author") {
    // classify が npub 形に振り分けたものだけがここに来る。decode 不能（壊れた npub）は
    // キーワード全文検索しても無意味なので空で返す（正直に「0件」）。
    const pubkey = npubToPubkey(term);
    return pubkey === null ? [] : fetchPostsByAuthors([pubkey], limit);
  }
  if (mode === "author-name") {
    return fetchPostsByAuthorName(term, limit);
  }

  // 既知の植物なら別名 OR 検索（#23 Phase 2）。「パキポ」でも Pachypodium/グラキリス 等の
  // 全表記を横断して拾う。#t は配列で OR できるので 1 クエリで別名タグをまとめて取得し、
  // 本文は著名表記で NIP-50 全文検索する。
  const plant = findPlantByTerm(term);

  const jobs: Promise<NostrEvent[]>[] = plant
    ? (() => {
        const tags = plantTagValues(plant);
        return [
          pool.querySync(
            [...GENERAL_RELAYS],
            { kinds: [1], "#t": tags, limit },
            { maxWait: QUERY_MAXWAIT },
          ),
          pool.querySync(
            [...SEARCH_RELAYS],
            { kinds: [1], search: plant.name, limit },
            { maxWait: QUERY_MAXWAIT },
          ),
        ];
      })()
    : mode === "tag"
      ? (() => {
          const { tagFilter, searchFilter } = discoverTagFilters(term, limit);
          return [
            pool.querySync([...GENERAL_RELAYS], tagFilter, { maxWait: QUERY_MAXWAIT }),
            pool.querySync([...SEARCH_RELAYS], searchFilter, { maxWait: QUERY_MAXWAIT }),
          ];
        })()
      : (() => {
          const { keywordFilter, tagFilter } = discoverKeywordFilters(term, limit);
          return [
            pool.querySync([...SEARCH_RELAYS], keywordFilter, { maxWait: QUERY_MAXWAIT }),
            pool.querySync([...GENERAL_RELAYS], tagFilter, { maxWait: QUERY_MAXWAIT }),
          ];
        })();

  // 片方のリレー群が失敗しても他方の結果を活かす（allSettled）。
  const settled = await Promise.allSettled(jobs);
  const events = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const posts = mergePostsById(events.map(parsePost));
  return posts.filter((post) => post.imageUrl !== null);
}

/** npub（bech32）を pubkey（hex）に変換する。npub でなければ null。nip19 は純粋。 */
function npubToPubkey(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub);
    return decoded.type === "npub" ? decoded.data : null;
  } catch {
    return null;
  }
}

/**
 * 指定著者（pubkey 群）の投稿（kind:1）を取得する（#68・著者検索の共通処理）。
 * discover と同じく画像ありのみ・createdAt 降順。t:hanoba には絞らない
 * （他クライアントの投稿も含めて「その人の植物/写真」を見たいため）。失敗は空配列。
 */
async function fetchPostsByAuthors(pubkeys: string[], limit: number): Promise<FeedPost[]> {
  if (pubkeys.length === 0) return [];
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      { kinds: [1], authors: pubkeys, limit },
      { maxWait: QUERY_MAXWAIT },
    );
    return mergePostsById(events.map(parsePost)).filter((post) => post.imageUrl !== null);
  } catch {
    return [];
  }
}

// @名前 検索（#68）。NIP-50 で kind:0 を取る上限と、その中から選ぶ著者の上限。
// 50 件取って name 一致の新しい順に最大 20 人を選ぶ（fetchPostsByAuthorName / selectAuthorsByName）。
const AUTHOR_NAME_PROFILE_LIMIT = 50;
const AUTHOR_NAME_MAX = 20;

/**
 * ユーザー名（kind:0 の name）で著者を引き、その投稿を取得する（#68・`@名前` 検索）。
 * NIP-50 で kind:0 を全文検索し、name に検索語を含む著者だけに絞ってから（NIP-50 はゆるいので
 * 誤ヒットを parseProfileName で再確認）その authors の kind:1 を取得する。失敗は空配列。
 *
 * kind:0 の NIP-50 検索は検索リレー（search.nos.today）に加え一般リレーにも投げて取りこぼしを
 * 減らす（NIP-50 kind:0 対応はリレー依存・1本に賭けない）。片方落ちても他方を活かす（allSettled）。
 */
async function fetchPostsByAuthorName(name: string, limit: number): Promise<FeedPost[]> {
  const filter = { kinds: [0], search: name, limit: AUTHOR_NAME_PROFILE_LIMIT };
  const settled = await Promise.allSettled([
    getPool().querySync([...SEARCH_RELAYS], filter, { maxWait: QUERY_MAXWAIT }),
    getPool().querySync([...GENERAL_RELAYS], filter, { maxWait: QUERY_MAXWAIT }),
  ]);
  const profileEvents = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  // name が検索語を含む著者だけ集める（pubkey ごと最新 kind:0・新しい順・上限・純粋関数）。
  const pubkeys = selectAuthorsByName(profileEvents, name, AUTHOR_NAME_MAX);
  return fetchPostsByAuthors(pubkeys, limit);
}

/**
 * プロフィール（kind:0）を publish する（#28/#35）。
 * kind:0 は replaceable なので、呼び出し側は常に全フィールド（name＋picture＋about＋websites）を
 * マージして渡す（部分更新で他項目を消さない）。name 空は events 側で throw。
 */
export async function publishProfile(fields: ProfileFields): Promise<NostrEvent> {
  const signed = await signTemplate(buildProfileEvent(fields));
  await publishEvent(signed);
  return signed;
}

/**
 * プロフィール全体を保存する（#35 Piece3・ProfileEditor から）。
 * ローカル（name＋付加項目）に控えてから kind:0 を publish する。publish 失敗は throw
 * （UI が配信失敗を伝えられるように。ローカルには保存済みなので次回再 publish できる）。
 */
export async function saveProfile(fields: ProfileFields): Promise<NostrEvent> {
  setDisplayName(fields.name); // 空なら throw（呼び出し側で trim 済みを渡す）
  setProfileExtra({
    picture: fields.picture?.trim() || null,
    about: fields.about?.trim() || null,
    websites: (fields.websites ?? []).map((w) => w.trim()).filter((w) => w !== ""),
  });
  return publishProfile(fields);
}

/**
 * 自分のプロフィール（kind:0）を relay から取得する（#35 Piece3・編集の初期値）。
 * 他デバイス/他クライアントで設定済みの picture/about/websites を編集 UI に引き継ぐ。失敗は null。
 */
export async function fetchMyProfile(pubkey: string): Promise<Profile | null> {
  const map = await fetchProfiles([pubkey]);
  return map.get(pubkey) ?? null;
}

/** ms 待つ（resilient fetch のリトライ間隔・テストは attempts/delay を注入して即時化できる）。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 自分の kind:0 を bounded retry 付きで取得する（#93）。
 *
 * 単発の querySync は、接続直後やモバイル回線で websites を載せた最新版を
 * maxWait 内に掴み損ねることがある（lagging relay が古い版を速く返す等）。単発だと
 * 編集欄が空のまま固定され、その空控えが saveDisplayName の clobber（websites:[] で
 * relay の正本を上書き）を招く（#93 の data-loss 経路）。
 *
 * websites を持つ版を掴めたら即確定。取れなければ最大 attempts 回まで引き直し、
 * その間で最も豊富（websites 件数が多い）な結果を採って返す。全部空振りなら null。
 * 取得は非ブロッキング（呼び出し側は先にローカル控えで描画済み）なので、待ちは UI を止めない。
 */
export async function fetchMyProfileResilient(
  pubkey: string,
  attempts = 3,
  delayMs = 600,
  // 内部依存（取得1回・待ち）はテスト注入できるようにする。本番は既定のまま。
  fetchOnce: (pubkey: string) => Promise<Profile | null> = fetchMyProfile,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<Profile | null> {
  let best: Profile | null = null;
  for (let i = 0; i < attempts; i++) {
    const p = await fetchOnce(pubkey);
    if (p !== null && (best === null || p.websites.length > best.websites.length)) {
      best = p;
    }
    // websites は最も取りこぼしやすい項目。掴めたら確定する（無駄な再取得をしない）。
    if (best !== null && best.websites.length > 0) return best;
    if (i < attempts - 1) await wait(delayMs);
  }
  return best;
}

/**
 * 指定 pubkey の表示名（kind:0 の name）を取得する（#28・nsec インポート時に既存名を引き継ぐ）。
 * 最新の kind:0 を採用。無ければ null。失敗も null。
 */
export async function fetchProfileName(pubkey: string): Promise<string | null> {
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      { kinds: [0], authors: [pubkey], limit: 1 },
      { maxWait: QUERY_MAXWAIT },
    );
    if (events.length === 0) return null;
    const latest = events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
    return parseProfileName(latest.content);
  } catch {
    return null;
  }
}

/**
 * 複数 pubkey のプロフィール（kind:0）を一括取得する（#35・著者ヘッダ）。
 * pubkey ごとに最新の kind:0 を採用し Map で返す。取得できない著者は Map に入らない。
 * フィードの著者アイコン/名前・サイトリンクの解決に使う。失敗時は空 Map。
 */
export async function fetchProfiles(pubkeys: string[]): Promise<Map<string, Profile>> {
  const authors = [...new Set(pubkeys)].filter((p) => p !== "");
  const result = new Map<string, Profile>();
  if (authors.length === 0) return result;
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      // kind:0 は replaceable（著者ごと最新1件）。limit は著者数に余裕を持たせ、
      // 多人数フィードで relay の既定 limit に取りこぼされないようにする（#35 レビュー）。
      { kinds: [0], authors, limit: authors.length * 2 },
      { maxWait: QUERY_MAXWAIT },
    );
    // pubkey ごとに最新の kind:0 だけ採用する。
    const latest = new Map<string, NostrEvent>();
    for (const ev of events) {
      const cur = latest.get(ev.pubkey);
      if (cur === undefined || ev.created_at > cur.created_at) latest.set(ev.pubkey, ev);
    }
    for (const [pubkey, ev] of latest) result.set(pubkey, parseProfile(ev.content));
    return result;
  } catch {
    return result;
  }
}

/**
 * 表示名を確定する（#28・Composer / MyGrid 共通）。
 * ローカル保存は**必ず**通し、kind:0 publish は best-effort（全 relay 落ち等で失敗しても
 * 投稿フローを止めない＝名前は次回以降の publish に乗る）。重複ロジックをここに集約。
 */
export async function saveDisplayName(name: string): Promise<void> {
  setDisplayName(name); // 空なら throw（呼び出し側で trim 済みを渡す）
  // kind:0 は replaceable なので、名前だけの変更でも付加項目（picture/about/websites）を
  // 載せ直して publish する（さもないと名前変更で著者ヘッダのアイコン/リンクが消える）。
  // ローカル控えが空でも relay に実体があれば消さないよう、relay 値とマージする（#78 レビュー M2）。
  let extra = getProfileExtra();
  try {
    // 単発取得だと取りこぼし時に websites:[] を publish して relay の正本を潰す（#93 clobber）。
    // bounded retry で最新版を掴んでからマージする。
    const remote = await fetchMyProfileResilient(await getPublicKeyHex());
    extra = mergeProfileExtra(extra, remote === null ? null : profileToExtra(remote));
    setProfileExtra(extra); // 次回以降のためローカルにも反映。
  } catch {
    // relay 取得失敗はローカル控えだけで進む。
  }
  try {
    await publishProfile({ name, ...extra });
  } catch {
    // publish 失敗はローカル名を保持して握り潰す。
  }
}

/** Profile（kind:0 全体）から付加項目（ProfileExtra）を取り出す。 */
function profileToExtra(p: Profile): { picture: string | null; about: string | null; websites: string[] } {
  return { picture: p.picture, about: p.about, websites: p.websites };
}

/**
 * 自分の植物（#28）＝自分の pubkey ＋ t:hanoba の投稿だけを取得する。
 * fetchHanobaFeed と同様に画像ありのみ・createdAt 降順。失敗は空配列。
 */
export async function fetchMyPosts(pubkey: string, limit = 100): Promise<FeedPost[]> {
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      { kinds: [1], "#t": [TAG_HANOBA], authors: [pubkey], limit },
      { maxWait: QUERY_MAXWAIT },
    );
    const posts = mergePostsById(events.map(parsePost));
    return posts.filter((post) => post.imageUrl !== null);
  } catch {
    return [];
  }
}

/**
 * 投稿を削除する（#28・写真と一蓮托生）。
 * ① NIP-09 kind:5 を publish して投稿を隠す（mypace/Nostr 上で不可視に）。
 * ② 投稿に含まれる画像を nostr.build から実体削除する（本人の鍵で NIP-96 DELETE）。
 *
 * どちらも本人の鍵で行う。画像削除は nostr.build URL のときのみ走る。
 * 戻り値で各結果を返す（UI が部分失敗を伝えられるように）。kind:5 publish が
 * 失敗（全 relay 落ち）したら throw（投稿が消えないのに画像だけ消すのを避ける）。
 */
export async function deletePost(
  post: FeedPost,
): Promise<{ noteDeleted: true; imageDeleted: boolean }> {
  // ① 投稿の削除依頼を先に publish（これが本体）。失敗時は throw して画像を消さない。
  const signed = await signTemplate(buildDeletionEvent([post.id]));
  await publishEvent(signed);

  // ② 画像の実体削除（任意・失敗しても投稿は隠れている）。
  let imageDeleted = false;
  if (post.imageUrl !== null) {
    try {
      imageDeleted = await deleteImage(post.imageUrl);
    } catch {
      imageDeleted = false;
    }
  }
  return { noteDeleted: true, imageDeleted };
}
