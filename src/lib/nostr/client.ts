// Nostr クライアント。リレーへの接続・publish はこの 1 モジュールに集約する。
// 他モジュールや React 島から relay 呼び出しをばら撒かない（guidelines §3）。

import { SimplePool } from "nostr-tools/pool";
import {
  applyClientFilter,
  tagAliasValues,
  type DiscoverFilter,
} from "../feed/discoverFilter.ts";
import { buildCatalogAliasIndex } from "../plants/variety-search.ts";
import {
  mergePostsById,
  parseProfile,
  parseProfileName,
  parsePost,
  type FeedPost,
  type Profile,
} from "../feed/parse.ts";
import { countCommentsByEvent } from "../feed/comments.ts";
import { rankHashtags, type RankedTag } from "../feed/popular.ts";
import { countLikes, countLikesByEvent } from "../feed/reactions.ts";
import { GENERAL_RELAYS, RELAYS, SEARCH_RELAYS, TAG_HANOBA } from "./constants.ts";
import {
  buildDeletionEvent,
  buildNoteTemplate,
  buildProfileEvent,
  buildReplyTemplate,
  type ProfileFields,
} from "./events.ts";
import {
  getProfileExtra,
  getPublicKeyHex,
  mergeProfileExtra,
  type ProfileExtra,
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
  /** 写真ごとの撮影日（#324・imageUrls と同順・無い写真は null）。位置配列タグ `shot_dates` で載る。 */
  photoShotDates?: Array<string | null>;
}): Promise<NostrEvent> {
  const template = buildNoteTemplate(input);
  const signed = await signTemplate(template);
  await publishEvent(signed);
  return signed;
}

/**
 * 投稿を編集する（#300・mypace 由来）。Nostr はイベント不変なので「編集」＝**新しい投稿を publish して
 * 旧イベントを NIP-09 kind:5 で削除**する。**画像は content の URL を再利用する（再アップロードしない）**ので、
 * 投稿削除（deletePost）と違い nostr.build の実体は消さない（消すと再投稿側の URL が死ぬ）。
 * いいね・コメントは旧イベント id に紐づくので新投稿には引き継がれない（呼び出し側が事前に確認を取る前提）。
 *
 * 順序は **新規 publish → 旧削除**（先に消さない＝publish 失敗で投稿が消える事故を防ぐ）。新規 publish の
 * 失敗は throw（呼び出し側が UI に伝える）。返り値は新しい投稿イベント（呼び出し側が即時に差し替えできる）。
 */
export async function editPost(input: {
  oldEventId: string;
  caption: string;
  imageUrls?: string[];
  /** 撮影日（#324・写真ごと・imageUrls 同順）。画像 URL と同じ写真メタなので編集でも引き継ぐ。 */
  photoShotDates?: Array<string | null>;
}): Promise<NostrEvent> {
  // 1) 先に新規を publish（画像 URL・撮影日は再利用＝写真メタを保つ）。
  const created = await signAndPublishNote({ caption: input.caption, imageUrls: input.imageUrls, photoShotDates: input.photoShotDates });
  // 2) 旧イベントを kind:5 で削除（画像は消さない＝再投稿側で使う）。deletePost と違い実体削除はしない。
  const deletion = await signTemplate(buildDeletionEvent([input.oldEventId]));
  await publishEvent(deletion);
  return created;
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
 * ランキング（#162）用に hanoba 投稿を取得する。fetchHanobaFeed と同形だが、
 * 週次バケットの履歴を増やすため既定 limit を大きめ（500）にする。
 *
 * - `{"#t":["hanoba"], kinds:[1]}` で hanoba タグ持ちの投稿を取得
 * - 各 event を parsePost → mergePostsById で id dedup・createdAt 降順
 * - 画像 URL を持たない投稿（imageUrl === null）は除外する（写真 SNS の母集団に揃える）
 * - 失敗（オフライン等）は throw せず空配列にフォールバックする
 *
 * 集計（品種の同定・週次・先週比）は純粋ロジック（feed/ranking.ts）の責務で、ここは取得のみ。
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchRankingPosts(limit = 500): Promise<FeedPost[]> {
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

// バッチ取得（タイムライン/discover のカード・#276）の kind:7/kind:1 上限。
// 1グリッド分の投稿（既定 fetchHanobaFeed=100 件）の反応をまとめて1クエリで取る。
// 固定上限だと投稿数が多いグリッドで1投稿あたりの実効が薄まり、単一取得（500/件）より早く頭打ちする。
// そこで **投稿数に連動**させる＝1投稿あたりの想定上限 PER_EVENT_COUNT_BUDGET を掛け、
// BATCH_COUNT_MAX で天井を切る（リレー負荷の歯止め）。超人気投稿が多いグリッドでは概数になり得る（既知の制約）。
const PER_EVENT_COUNT_BUDGET = 60;
const BATCH_COUNT_MAX = 5000;

/** バッチ取得 limit を投稿数（n）連動で算出する（両バッチ関数で共有・式の重複を避ける）。 */
function batchCountLimit(n: number): number {
  return Math.min(n * PER_EVENT_COUNT_BUDGET, BATCH_COUNT_MAX);
}

/**
 * 複数投稿のいいね数を**1クエリで一括取得**する（#276・タイムライン/discover のカード用）。
 *
 * `{kinds:[7], "#e":[...eventIds]}` で全投稿宛のリアクションをまとめて取り、
 * `countLikesByEvent` で id ごとに集計する＝カードごとに query しない（N+1 回避・guidelines §3）。
 *
 * - eventIds が空なら即空 Map（query しない）。
 * - 失敗（オフライン等）は throw せず空 Map にフォールバックする（カードは count を出さないだけ）。
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchReactionCountsBatch(
  eventIds: string[],
  limit = batchCountLimit(eventIds.length),
): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  try {
    const reactions = await getPool().querySync(
      [...GENERAL_RELAYS],
      {
        kinds: [7],
        "#e": eventIds,
        limit,
      },
      { maxWait: QUERY_MAXWAIT },
    );
    return countLikesByEvent(reactions, eventIds);
  } catch {
    return new Map();
  }
}

/**
 * 複数投稿のコメント数を**1クエリで一括取得**する（#276・タイムライン/discover のカード用）。
 *
 * `{kinds:[1], "#e":[...eventIds]}` で全投稿宛のリプライをまとめて取り、
 * `countCommentsByEvent` で id ごとに集計する（本物のリプライ抽出＝引用リポスト除外・id 重複除去を
 * 単一取得経路と共有）＝カードごとに query しない（N+1 回避・guidelines §3）。
 *
 * - eventIds が空なら即空 Map（query しない）。
 * - 失敗（オフライン等）は throw せず空 Map にフォールバックする（カードは count を出さないだけ）。
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchCommentCountsBatch(
  eventIds: string[],
  limit = batchCountLimit(eventIds.length),
): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      {
        kinds: [1],
        "#e": eventIds,
        limit,
      },
      { maxWait: QUERY_MAXWAIT },
    );
    return countCommentsByEvent(events, eventIds);
  } catch {
    return new Map();
  }
}

/**
 * 投稿（kind:1）へのコメント（kind:1 リプライ）を取得する（#142・表示用）。
 * `#e` で親投稿に向けられた kind:1 を集める（NIP-10 のリプライ）。
 *
 * - `{kinds:[1], "#e":[eventId]}` で親投稿宛のリプライを取得
 * - リレー間の重複を id で防御的に除去する（querySync 内で畳まれることもあるが念のため）
 * - 失敗（オフライン等）は throw せず空配列にフォールバックする
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchReplies(eventId: string, limit = 500): Promise<NostrEvent[]> {
  try {
    const events = await getPool().querySync(
      [...GENERAL_RELAYS],
      {
        kinds: [1],
        "#e": [eventId],
        limit,
      },
      { maxWait: QUERY_MAXWAIT },
    );
    // id でリレー間の重複を畳む（最初の1件を残す）。
    const byId = new Map<string, NostrEvent>();
    for (const ev of events) {
      if (!byId.has(ev.id)) byId.set(ev.id, ev);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

/**
 * コメント（kind:1 リプライ）を構築・署名・publish し、署名済みイベントを返す（#142）。
 * テンプレートの組み立て（空チェック・タグ）は buildReplyTemplate の責務。
 */
export async function publishReply(input: { content: string; parentId: string }): Promise<NostrEvent> {
  const signed = await signTemplate(buildReplyTemplate(input.content, input.parentId));
  await publishEvent(signed);
  return signed;
}

/**
 * 自分のコメント（kind:1 リプライ）を削除する（#142・NIP-09 kind:5）。
 * コメントは画像を持たないので、投稿削除（deletePost）と違い画像の実体削除はしない。
 * kind:5 publish 失敗（全 relay 落ち）は throw（呼び出し側が UI に伝えられるように）。
 */
export async function deleteComment(commentId: string): Promise<void> {
  const signed = await signTemplate(buildDeletionEvent([commentId]));
  await publishEvent(signed);
}

/** 絞り込み時の母集団取得 limit（クライアント側で絞るため厚めに取り、珍しい品種の recall を確保）。 */
const POP_LIMIT_FILTERED = 300;

/**
 * discover（みんなの植物）を取得する（#239 / #258: 品種で絞るだけ・新着順）。
 *
 * 設計原則: **品種は Nostr のルーティングタグ（t タグ）ではなく hanoba の意味タグ。** 投稿の品種は
 * 本文 #ハッシュタグにだけ宿り（buildAutoTags は t:hanoba/t:mypace のみ）、絞り込みは「みんなの植物
 * フィード」の上のクライアント側ビューとして確定する（fetchPopularHashtags が #t:hanoba を取って
 * extractHashtags で数えるのと同じ土俵）。
 *
 * - 母集団は**常に**みんなの植物（#t:plantstr ∪ search:#plantstr ∪ #t:hanoba）。既定も絞り込みも同じ。
 *   かつて絞り込み時に投げていた #t:[品種] は、品種が t タグ化されない hanoba では構造的に常に空で、
 *   本文 #品種 だけ持つ自分の投稿を母集団から落としていた（#258 の退行原因）ため撤去。
 * - 絞り込み時は母集団 limit を厚めに取り（POP_LIMIT_FILTERED）、珍しい品種の recall を確保する。
 *   ※ あくまで「最新 N 件のクライアント絞り込み」なので、それより古い品種投稿は取りこぼし得る
 *     （サイレントな打ち切りではなく既知の制約。将来 until 時間窓ページングで補う）。
 *   加えて NIP-50 search:#品種 を best-effort 補助に足す（外部 plantstr 投稿へのリーチ・load-bearing ではない）。
 * - 取得後は mergePostsById で id dedup・新着降順、applyClientFilter で画像のみ・本文タグ AND を確定。
 * 片方の relay 群が落ちても他方を活かす（allSettled）。失敗・全滅は空配列にフォールバックする。
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない・guidelines §3）。
 * DESIGN §6 の契約（書き込み側は本文 # を t 化しない／読み取り側はフィード上でクライアント絞り込み）は不変。
 */
// discover の別名展開用 catalog 別名索引（#303）。filtering 時に1回だけ動的 import して構築・キャッシュ。
// 失敗時は空 Map＝dictionary だけで動く（グレースフル・catalog 未ロードでも壊さない）。
let catalogAliasIndexPromise: Promise<Map<string, string[]>> | null = null;
function getCatalogAliasIndex(): Promise<Map<string, string[]>> {
  if (catalogAliasIndexPromise === null) {
    catalogAliasIndexPromise = import("../plants/variety-catalog.ts")
      .then((mod) => buildCatalogAliasIndex(mod.VARIETY_CATALOG))
      .catch(() => new Map<string, string[]>());
  }
  return catalogAliasIndexPromise;
}

export async function fetchDiscoverFiltered(
  filter: DiscoverFilter,
  limit = 100,
): Promise<FeedPost[]> {
  const pool = getPool();
  const filtering = filter.tags.length > 0;
  const popLimit = filtering ? Math.max(limit, POP_LIMIT_FILTERED) : limit;
  // catalog 別名索引は relay 取得と並行で読み込む（filtering 時のみ・初回以降はキャッシュ即時）。
  const aliasIndexPromise = filtering ? getCatalogAliasIndex() : null;

  // 母集団は常に「みんなの植物」フィード（#t:plantstr ∪ search:#plantstr ∪ #t:hanoba）。
  // 品種は本文タグなので relay の #t:[品種] では引けない＝母集団を取り applyClientFilter で絞る。
  const jobs: Promise<NostrEvent[]>[] = [
    pool.querySync([...GENERAL_RELAYS], { kinds: [1], "#t": ["plantstr"], limit: popLimit }, { maxWait: QUERY_MAXWAIT }),
    pool.querySync([...SEARCH_RELAYS], { kinds: [1], search: "#plantstr", limit: popLimit }, { maxWait: QUERY_MAXWAIT }),
    pool.querySync([...GENERAL_RELAYS], { kinds: [1], "#t": [TAG_HANOBA], limit: popLimit }, { maxWait: QUERY_MAXWAIT }),
  ];

  if (filtering) {
    // best-effort 補助: 外部 plantstr 投稿を NIP-50 #品種 検索で拾う（届かなくても母集団が hanoba 投稿を担保）。
    jobs.push(
      pool.querySync(
        [...SEARCH_RELAYS],
        { kinds: [1], search: filter.tags.map((t) => `#${t}`).join(" "), limit },
        { maxWait: QUERY_MAXWAIT },
      ),
    );
  }

  const settled = await Promise.allSettled(jobs);
  const events = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const merged = mergePostsById(events.map(parsePost)); // id dedup・新着降順

  // 別名展開＝dictionary（#23・学名/英名）∪ variety-catalog の属/品種別名（#303・札と同じ source）。
  // catalog 索引は辞書外の属別名でタグした cross-client 投稿（例 #ゴムの木＝フィカス）にも当てる。
  const aliasIndex = aliasIndexPromise === null ? null : await aliasIndexPromise;
  const resolveTagAliases =
    aliasIndex === null
      ? tagAliasValues
      : (t: string): string[] => {
          const cat = aliasIndex.get(t.trim().toLowerCase());
          const dict = tagAliasValues(t);
          return cat === undefined ? dict : [...new Set([...dict, ...cat])];
        };
  const filtered = applyClientFilter(merged, { tags: filter.tags, resolveTagAliases });
  return filtered.slice(0, limit);
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
    favoriteVarieties: (fields.favoriteVarieties ?? []).map((v) => v.trim()).filter((v) => v !== ""),
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
 * websites/好きな品種を1件でも掴めたら即確定して返す（取りこぼしが主因なので、解消したら止める）。
 * まだ空の間は最大 attempts 回まで引き直し、その時点で最も豊富（websites＋好きな品種の件数が多い）な
 * 結果を保持する＝早期確定しない all-empty 経路では richest を返す。全部空振りなら null。
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
  // 取りこぼしやすい配列項目（websites＋好きな品種）の合計件数を「豊富さ」とする（#141）。
  const richness = (p: Profile): number => p.websites.length + p.favoriteVarieties.length;
  let best: Profile | null = null;
  for (let i = 0; i < attempts; i++) {
    const p = await fetchOnce(pubkey);
    if (p !== null && (best === null || richness(p) > richness(best))) {
      best = p;
    }
    // 配列項目を1件でも掴めたら確定する（無駄な再取得をしない）。
    if (best !== null && richness(best) > 0) return best;
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
function profileToExtra(p: Profile): ProfileExtra {
  return { picture: p.picture, about: p.about, websites: p.websites, favoriteVarieties: p.favoriteVarieties };
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
  const imageDeleted = await deletePostImages(post.imageUrls);
  return { noteDeleted: true, imageDeleted };
}

export async function deletePostImages(
  imageUrls: string[],
  deleteFn: (url: string) => Promise<boolean> = deleteImage,
): Promise<boolean> {
  if (imageUrls.length === 0) return true;
  const results = await Promise.all(
    imageUrls.map(async (url) => {
      try {
        return await deleteFn(url);
      } catch {
        return false;
      }
    }),
  );
  return results.every(Boolean);
}
