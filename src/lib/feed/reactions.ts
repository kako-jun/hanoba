// リアクション（NIP-25・kind:7）集計の純粋関数（定義先行・テスト対象）。
// relay 呼び出しはしない（取得は client.ts の責務）。

import type { NostrEvent } from "../nostr/types.ts";

/**
 * リアクションイベント（kind:7）が「いいね（肯定的反応）」かを判定する純粋関数。
 *
 * NIP-25 では content が `"+"`（like）/`"-"`（dislike）/絵文字（カスタム絵文字含む）。
 * hanoba は写真 SNS のため、否定的反応（`"-"` = dislike）だけを除外し、
 * それ以外（`"+"`・空文字・絵文字）はすべて like として扱う。
 */
export function isLike(event: NostrEvent): boolean {
  return event.content !== "-";
}

/**
 * kind:7 リアクションの配列から「いいね」数を集計する純粋関数。
 *
 * - dislike（content === "-"）は除外する（isLike）。
 * - 1 人 1 いいねに畳む（同一 pubkey の重複は 1 票）。
 *   イベントは取得順で走査し、同一 pubkey の最後の反応を採用する
 *   ＝ 後から dislike に変えていれば like から落ち、like に変えていれば数える。
 * - 返り値は 0 以上の整数。
 *
 * 注: 同一 pubkey が like と dislike の両方を出している場合、配列内で最後に
 * 現れたイベントの content で like/dislike を決める（最後採用）。
 */
export function countLikes(reactions: NostrEvent[]): number {
  // pubkey → 最後に観測した反応が like かどうか。
  const byPubkey = new Map<string, boolean>();
  for (const event of reactions) {
    byPubkey.set(event.pubkey, isLike(event));
  }
  let count = 0;
  for (const liked of byPubkey.values()) {
    if (liked) count += 1;
  }
  return count;
}
