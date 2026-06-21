// 市民レベル（#163）。ハノーバ市民手帳の本のページ解放を司る純粋ロジック。
//
// すべて Nostr 由来＝backendless。サーバに会員ランクを持たず、その場の手がかり
// （表示名の登録／投稿数／最古投稿の経過日数）だけからレベルを決める。
//
// 純関数: Date.now を内部で呼ばない（now は秒で渡す）。テストは固定値で網羅する。

/** 市民レベル。L0 旅人 / L1 市民 / L2 市民L2（… 以降は市民Ln・#272）。 */
export type CitizenLevel = 0 | 1 | 2;

/** 市民L2 に必要な最小投稿数。 */
export const TENURE_POSTS = 5;

/** 市民L2 に必要な最古投稿からの経過日数（居住日数）。 */
export const TENURE_DAYS = 14;

/** 市民Ln（L2 以降）の昇格しきい値（#272 段階2）。 */
export interface CitizenTier {
  level: number;
  /** この tier に必要な最小投稿数。 */
  minPosts: number;
  /** この tier に必要な最小居住日数。 */
  minDays: number;
}

/**
 * 市民Ln の昇格テーブル（#272 段階2・kako-jun 確定の軸＝複合 居住×投稿の AND で進む）。
 * level 昇順。各 tier は「投稿数 >= minPosts かつ 居住日数 >= minDays」を満たすと到達する。
 * L2 は既存条件（TENURE_POSTS / TENURE_DAYS）と一致させる＝CityHallBook・既存テストの不変条件を保つ。
 * 称号/実績バッジは脱ゲーム化で撤去（#272）＝レベルは静かなステータスとして残すだけ。
 */
export const CITIZEN_TIERS: CitizenTier[] = [
  { level: 2, minPosts: TENURE_POSTS, minDays: TENURE_DAYS },
  { level: 3, minPosts: 15, minDays: 30 },
  { level: 4, minPosts: 40, minDays: 90 },
  { level: 5, minPosts: 80, minDays: 180 },
  { level: 6, minPosts: 150, minDays: 365 },
];

/**
 * 市民レベルの表示名（#272・kako-jun「L0は旅人、L1が市民、L2が市民L2、ずっと市民Ln」）。
 * 古参/訪問者という別語は使わず、**名乗ったら市民・以降は市民のままレベルが上がる**進行にする。
 * - 0 以下 → 「旅人」（まだ名乗っていない＝市民でない）。
 * - 1     → 「市民」。
 * - 2 以上 → 「市民L2」「市民L3」…（活動で手帳レベルが進む）。
 * 引数は number で受ける（将来 stats が L3+ を出すため・CitizenLevel に閉じない）。
 */
export function citizenLevelLabel(level: number): string {
  if (level <= 0) return "旅人";
  if (level === 1) return "市民";
  return `市民L${level}`;
}

/** 1 日の秒数。 */
const DAY_SEC = 86400;

/** 居住日数（最古投稿→now・日数 floor）を求める純粋ヘルパ。投稿が無ければ 0。 */
function tenureDaysOf(earliestCreatedAt: number | null, now: number): number {
  if (earliestCreatedAt === null) return 0;
  return Math.max(0, Math.floor((now - earliestCreatedAt) / DAY_SEC));
}

/**
 * 非キャップの市民レベル Ln を決める純関数（#272 段階2）。
 *
 * - L0 旅人: 表示名が未登録（= まだ名乗っていない＝市民でない）。
 * - L1 市民: 表示名が登録済み（= 名乗り完了・どの tier も未達）。
 * - L2..Ln: CITIZEN_TIERS のうち「投稿数 >= minPosts かつ 居住日数 >= minDays」を満たす最上位 tier の level。
 *
 * 活動スタッツ（CitizenStats）が市民Ln を出すために使う。CityHallBook のページ解放は citizenLevel（0|1|2 capped）。
 *
 * @param input.hasName       登録済みの表示名が存在するか
 * @param input.postCount     t:hanoba の投稿数
 * @param input.earliestCreatedAt 最古投稿の created_at（unix 秒・投稿が無ければ null）
 * @param input.now           現在時刻（unix 秒）
 */
export function citizenLevelFull(input: {
  hasName: boolean;
  postCount: number;
  earliestCreatedAt: number | null;
  now: number;
}): number {
  const { hasName, postCount, earliestCreatedAt, now } = input;
  // 名前が無ければ旅人。名乗り（表示名の登録）が市民の条件。
  if (!hasName) return 0;
  const days = tenureDaysOf(earliestCreatedAt, now);
  // 満たす最上位 tier を採る（テーブルは単調増加だが、念のため全件評価して最大達成 level を取る）。
  let level = 1;
  for (const tier of CITIZEN_TIERS) {
    if (postCount >= tier.minPosts && days >= tier.minDays && tier.level > level) {
      level = tier.level;
    }
  }
  return level;
}

/**
 * 市民レベルを決める純関数（CityHallBook のページ解放用・0|1|2 capped）。
 * citizenLevelFull を 2 で頭打ちにする＝沿革/条文ページの解放境界は従来どおり L2 まで（挙動不変）。
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
  return Math.min(2, citizenLevelFull(input)) as CitizenLevel;
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
