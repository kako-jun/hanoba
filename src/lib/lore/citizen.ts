// 市民レベル（#163）。ハノーバ市民手帳の本のページ解放を司る純粋ロジック。
//
// すべて Nostr 由来＝backendless。サーバに会員ランクを持たず、その場の手がかり
// （表示名の登録／投稿数／最古投稿の経過日数）だけからレベルを決める。
//
// 純関数: Date.now を内部で呼ばない（now は秒で渡す）。テストは固定値で網羅する。

/** 市民レベル。L0 訪問者 / L1 市民 / L2 古参。 */
export type CitizenLevel = 0 | 1 | 2;

/** 古参（L2）に必要な最小投稿数。 */
export const TENURE_POSTS = 5;

/** 古参（L2）に必要な最古投稿からの経過日数（在籍日数）。 */
export const TENURE_DAYS = 14;

/** 1 日の秒数。 */
const DAY_SEC = 86400;

/**
 * 市民レベルを決める純関数。
 *
 * - L0 訪問者: 表示名が未登録（= まだ移住していない）。
 * - L1 市民: 表示名が登録済み（= 移住完了）。
 * - L2 古参: 表示名が登録済み かつ 投稿数 >= TENURE_POSTS かつ
 *   最古投稿の created_at が now から TENURE_DAYS 日以上前（= 在籍が古い）。
 *
 * @param input.hasName       登録済みの表示名が存在するか
 * @param input.postCount     t:hanoba の投稿数
 * @param input.earliestCreatedAt 最古投稿の created_at（unix 秒・投稿が無ければ null）
 * @param input.now           現在時刻（unix 秒）
 */
export function citizenLevel(input: {
  hasName: boolean;
  postCount: number;
  earliestCreatedAt: number | null;
  now: number;
}): CitizenLevel {
  const { hasName, postCount, earliestCreatedAt, now } = input;
  // 名前が無ければ訪問者。移住届（名乗り）が市民の条件。
  if (!hasName) return 0;
  // 古参の判定: 投稿が十分にあり、最古投稿が十分に古い。
  if (postCount >= TENURE_POSTS && earliestCreatedAt !== null) {
    const tenureSec = now - earliestCreatedAt;
    if (tenureSec >= TENURE_DAYS * DAY_SEC) return 2;
  }
  return 1;
}

/**
 * そのレベルで開ける最大ページ番号（前方ロックの上限）。
 * L0 → 1（移住案内のみ） / L1 → 2（市役所ハブまで） / L2 → 4（沿革・条文まで）。
 */
export function maxUnlockedPage(level: CitizenLevel): number {
  switch (level) {
    case 0:
      return 1;
    case 1:
      return 2;
    case 2:
      return 4;
  }
}

/**
 * 本を開いたときの既定ページ（解放済みのうち導入的なページ）。
 * L0 → 1 / L1 → 2 / L2 → 2（奥のページは前送りで辿る・自動では開かない）。
 */
export function defaultPage(level: CitizenLevel): number {
  return level === 0 ? 1 : 2;
}
