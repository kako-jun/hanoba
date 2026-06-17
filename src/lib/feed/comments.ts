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
 * 複数のイベント列（リレーごと等）を Comment に変換し、id で重複除去する。
 * 同じ id は最初に出会ったものを採用する（リレー間の重複を畳む）。並び順は入力順を保つ。
 */
export function toComments(events: NostrEvent[]): Comment[] {
  const byId = new Map<string, Comment>();
  for (const event of events) {
    if (!byId.has(event.id)) {
      byId.set(event.id, parseComment(event));
    }
  }
  return [...byId.values()];
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
