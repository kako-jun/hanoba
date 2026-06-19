// コメント（Nostr リプライ＝kind:1）のパース・整形の純粋関数（定義先行・テスト対象）。
// Nostr イベント → 表示用 Comment への変換と、id 重複除去・並べ替え。
// relay 呼び出しはしない（取得は client.ts の責務）。

import type { NostrEvent } from "../nostr/types.ts";

/**
 * 投稿に対するコメント1件（DESIGN §6・Nostr リプライ）。
 * - id / pubkey / createdAt: イベント由来。
 * - content: コメント本文（kind:1 の content をそのまま。画像 URL の抽出はしない＝コメントは文章だけ）。
 */
export interface Comment {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
}

/** Nostr イベント（kind:1 リプライ）を表示用 Comment に変換する純粋関数。 */
export function parseComment(event: NostrEvent): Comment {
  return {
    id: event.id,
    pubkey: event.pubkey,
    content: event.content,
    createdAt: event.created_at,
  };
}

/**
 * イベントが親投稿への「本物のリプライ」かを判定する（NIP-10/NIP-18）。
 *
 * `{kinds:[1], "#e":[parentId]}` は親を e タグで参照する kind:1 を全部返すが、
 * その中には**引用リポスト**（NIP-18・`["e", parentId, "", "mention"]` 付き）が混ざる。
 * 引用リポストはコメントではなく、フラットなコメント一覧に混ぜると無関係な内容を注入してしまう。
 *
 * 判定: 「値が parentId に一致し、かつ marker（4番目 `tag[3]`）が `"mention"` でない」e タグを
 * 1つでも持てば本物のリプライ＝残す。本物のリプライは `"root"` / `"reply"` / マーカー無しを使う
 * （`buildReplyTemplate` は `"root"`、mypace のリプライは `"root"`/`"reply"`）。
 * 引用リポストだけが親を `"mention"` で印付けるので落ちる。
 */
function isGenuineReply(event: NostrEvent, parentId: string): boolean {
  return event.tags.some(
    (tag) => tag[0] === "e" && tag[1] === parentId && tag[3] !== "mention",
  );
}

/**
 * 複数のイベント列（リレーごと等）を Comment に変換し、id で重複除去する。
 * 引用リポスト（親を `"mention"` で印付ける e タグ＝NIP-18）はコメントではないので除外する
 * （`isGenuineReply`）。同じ id は最初に出会ったものを採用する（リレー間の重複を畳む）。
 * 並び順は入力順を保つ。
 */
export function toComments(events: NostrEvent[], parentId: string): Comment[] {
  const byId = new Map<string, Comment>();
  for (const event of events) {
    if (!isGenuineReply(event, parentId)) continue;
    if (!byId.has(event.id)) {
      byId.set(event.id, parseComment(event));
    }
  }
  return [...byId.values()];
}

/**
 * 複数投稿の kind:1 リプライを**投稿 id ごとに**コメント数へ集計する純粋関数（#276）。
 *
 * タイムライン/discover のカードは1グリッドで多数の投稿を出すので、id ごとに query せず
 * 1クエリで集めた kind:1 をクライアント側で振り分ける（N+1 を避ける・取得は client.ts の責務）。
 *
 * - 各 id について `toComments(replies, id).length` を数える＝本物のリプライ抽出
 *   （引用リポスト〔NIP-18・marker="mention"〕除外）と id 重複除去を**そのまま再利用**する。
 *   ＝カードのコメント数は投稿詳細の `comments.length` と同じ純関数を通る（数え方を揃える）。
 * - **複数の対象（e タグ）を本物リプライとして指す返信1件は、各対象に1ずつ計上される**。これは
 *   `PostDetail` を各投稿で開いたときの `comments.length` と一致する（同じ純関数を通すため整合）。
 *   ＝リアクション側（`countLikesByEvent`＝最初の一致 e タグへ畳む）とは割り当て規則が**非対称**。
 * - 返り値は eventIds の全 id をキーに持つ Map（該当0件の id は 0）。0 を出すか隠すかは呼び出し側の責務。
 */
export function countCommentsByEvent(
  replies: NostrEvent[],
  eventIds: string[],
): Map<string, number> {
  const result = new Map<string, number>();
  for (const id of eventIds) {
    result.set(id, toComments(replies, id).length);
  }
  return result;
}

/** コメントの並び順（古い順＝投稿の流れを追う／新しい順＝最新を先頭）。 */
export type CommentOrder = "old" | "new";

/**
 * コメントを指定順に並べ替えた新しい配列を返す（入力は破壊しない・安定ソート）。
 * - "old": createdAt 昇順（古いものが上＝会話の流れ順）。
 * - "new": createdAt 降順（新しいものが上）。
 */
export function sortComments(comments: Comment[], order: CommentOrder): Comment[] {
  const sign = order === "old" ? 1 : -1;
  // createdAt 同値は入力順を保つ（安定ソート＝index で tie-break）。
  return comments
    .map((c, i) => ({ c, i }))
    .sort((a, b) => sign * (a.c.createdAt - b.c.createdAt) || a.i - b.i)
    .map((x) => x.c);
}
