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

/** created_at の新しい順、同秒は id の辞書順で決定的に新しい反応を選ぶ。 */
export function latestReaction(reactions: NostrEvent[]): NostrEvent | undefined {
  let latest: NostrEvent | undefined;
  for (const event of reactions) {
    if (
      latest === undefined ||
      event.created_at > latest.created_at ||
      (event.created_at === latest.created_at && event.id > latest.id)
    ) {
      latest = event;
    }
  }
  return latest;
}

/**
 * kind:7 リアクションの配列から「いいね」数を集計する純粋関数。
 *
 * - dislike（content === "-"）は除外する（isLike）。
 * - 1 人 1 いいねに畳む（同一 pubkey の重複は 1 票）。
 *   created_at が最新の反応を採用する
 *   ＝ 後から dislike に変えていれば like から落ち、like に変えていれば数える。
 *   created_at が同秒なら event id の辞書順が大きい方を採用し、relay の返却順に依存させない。
 * - 返り値は 0 以上の整数。
 */
export function countLikes(reactions: NostrEvent[]): number {
  const byPubkey = new Map<string, NostrEvent[]>();
  for (const event of reactions) {
    const events = byPubkey.get(event.pubkey) ?? [];
    events.push(event);
    byPubkey.set(event.pubkey, events);
  }
  let count = 0;
  for (const events of byPubkey.values()) {
    const latest = latestReaction(events);
    if (latest !== undefined && isLike(latest)) count += 1;
  }
  return count;
}

/**
 * 複数投稿の kind:7 リアクションを**投稿 id ごとに**いいね数へ集計する純粋関数（#276）。
 *
 * タイムライン/discover のカードは1グリッドで多数の投稿を出すので、id ごとに query せず
 * 1クエリで集めた kind:7 をクライアント側で振り分ける（N+1 を避ける・取得は client.ts の責務）。
 *
 * - 各 kind:7 を、その `e` タグ値のうち eventIds に含まれる**最初の1つ**へ割り当てる
 *   （リアクションは通常1投稿宛だが、複数 e タグを持つ稀ケースでも対象投稿に倒す）。
 *   eventIds にどれも一致しなければそのリアクションは無視する。
 * - 各群を既存 `countLikes` で数える（dislike 除外・同一 pubkey は時刻/idで最新を採用）。
 * - 返り値は eventIds の全 id をキーに持つ Map（該当0件の id は 0）。0 を出すか隠すかは呼び出し側の責務。
 */
export function countLikesByEvent(
  reactions: NostrEvent[],
  eventIds: string[],
): Map<string, number> {
  const targets = new Set(eventIds);
  // id → その投稿宛のリアクション列。
  const grouped = new Map<string, NostrEvent[]>();
  for (const id of eventIds) grouped.set(id, []);
  for (const event of reactions) {
    // 対象投稿（eventIds）に一致する最初の e タグ値へ割り当てる。
    const targetTag = event.tags.find((tag) => tag[0] === "e" && tag[1] !== undefined && targets.has(tag[1]));
    const id = targetTag?.[1];
    if (id === undefined) continue;
    grouped.get(id)?.push(event);
  }
  const result = new Map<string, number>();
  for (const [id, events] of grouped) {
    result.set(id, countLikes(events));
  }
  return result;
}
