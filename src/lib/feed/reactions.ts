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

/**
 * kind:7 リアクション群を「対象投稿ごとのいいね数」に集計する純粋関数（#131 popular 並び）。
 *
 * 1 回の relay 問い合わせ（`{kinds:[7], "#e":[…ids]}`）で複数投稿宛のリアクションをまとめて取り、
 * `e` タグ（NIP-25 では最後の `e` がリアクション対象イベント）で投稿ごとに振り分けてから
 * countLikes で畳む（dislike 除外・1 人 1 票）。`e` タグの無いイベントは無視する。
 * 返り値は id→いいね数の Map（リアクションが無い投稿は Map に入らない＝呼び出し側で 0 扱い）。
 */
export function countLikesByTarget(reactions: NostrEvent[]): Map<string, number> {
  const byTarget = new Map<string, NostrEvent[]>();
  for (const ev of reactions) {
    const eTags = ev.tags.filter((t) => t[0] === "e" && typeof t[1] === "string" && t[1] !== "");
    if (eTags.length === 0) continue;
    const target = eTags[eTags.length - 1]![1]!; // NIP-25: 最後の e タグが対象イベント
    const arr = byTarget.get(target);
    if (arr === undefined) byTarget.set(target, [ev]);
    else arr.push(ev);
  }
  const out = new Map<string, number>();
  for (const [id, evs] of byTarget) out.set(id, countLikes(evs));
  return out;
}
