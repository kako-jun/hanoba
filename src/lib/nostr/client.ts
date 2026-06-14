// Nostr クライアント。リレーへの接続・publish はこの 1 モジュールに集約する。
// 他モジュールや React 島から relay 呼び出しをばら撒かない（guidelines §3）。

import { SimplePool } from "nostr-tools/pool";
import {
  classifyDiscoverQuery,
  discoverKeywordFilters,
  discoverTagFilters,
} from "../feed/discover.ts";
import { mergePostsById, parsePost, type FeedPost } from "../feed/parse.ts";
import { countLikes } from "../feed/reactions.ts";
import { GENERAL_RELAYS, RELAYS, SEARCH_RELAYS, TAG_HANOBA } from "./constants.ts";
import { buildDeletionEvent, buildNoteTemplate, buildProfileEvent } from "./events.ts";
import { setDisplayName, signTemplate } from "./keys.ts";
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

  // モードごとに (relays, filter) のペアを組む。
  const jobs: Promise<NostrEvent[]>[] =
    mode === "tag"
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

/**
 * プロフィール（kind:0・表示名）を publish する（#28）。
 * 「ユーザー名を入れたら投稿できる」ためのアカウント確立。name 空は events 側で throw。
 */
export async function publishProfile(name: string): Promise<NostrEvent> {
  const signed = await signTemplate(buildProfileEvent(name));
  await publishEvent(signed);
  return signed;
}

/**
 * 表示名を確定する（#28・Composer / MyGrid 共通）。
 * ローカル保存は**必ず**通し、kind:0 publish は best-effort（全 relay 落ち等で失敗しても
 * 投稿フローを止めない＝名前は次回以降の publish に乗る）。重複ロジックをここに集約。
 */
export async function saveDisplayName(name: string): Promise<void> {
  setDisplayName(name); // 空なら throw（呼び出し側で trim 済みを渡す）
  try {
    await publishProfile(name);
  } catch {
    // publish 失敗はローカル名を保持して握り潰す。
  }
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
