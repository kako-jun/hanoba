// 市民レベル（#163）。市民の在籍段階を判定する純粋ロジック。
//
// すべて Nostr 由来＝backendless。サーバに会員ランクを持たず、その場の手がかり
// （表示名の登録／投稿数／最古投稿の経過日数）だけからレベルを決める。
//
// #510 方針B でレベル解禁ゲートは撤去し、手帳は全ページ開放になった。#525 で表示ラベルも
// 「旅人/市民」の二値に統一し、数字付きの Ln 表記はどこにも出さない方針へ転換した（#272 から転換）。
// 内部の段階判定（citizenLevelFull / CITIZEN_TIERS）自体は残し、昇格の味付け分岐（levelFlavor）と
// 初期表示ページ（defaultPage）にだけ使う。
//
// 純関数: Date.now を内部で呼ばない（now は秒で渡す）。テストは固定値で網羅する。

import { t } from "../i18n/t.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale.ts";

/**
 * 市民レベル（capped 0|1|2|3）。かつては 1 レベル=1 ページのページ解禁に使っていたが、
 * #510 方針B で解禁ゲートを撤去し全ページ開放にした。この capped 型は昇格の味付け分岐
 * （levelFlavor）と初期表示ページ（defaultPage）に残るだけで、ページの閲覧可否は司らない。
 * 表示ラベル（citizenLevelLabel）は #525 で「旅人/市民」の二値に統一済み＝この型の内部段階
 * （2 以上）は表示に出ない。
 */
export type CitizenLevel = 0 | 1 | 2 | 3;

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
 * 市民レベルの表示名（#525・kako-jun 承認により #272 の Ln 表記から方針転換）。
 * 表示は常に「旅人」（未登録）か「市民」（登録済み）の二値のみで、数字付きの「市民Ln」は
 * 一切出さない。内部の段階判定（citizenLevelFull / CITIZEN_TIERS）は defaultPage 等が引き続き
 * 使うのでそのまま残し、この表示ラベル関数だけを二値化する。
 * 引数は number で受ける（内部段階（citizenLevelFull）をそのまま渡せるように・CitizenLevel に閉じない）。
 */
export function citizenLevelLabel(level: number, locale: Locale = DEFAULT_LOCALE): string {
  if (level <= 0) return t(locale, "citizen.level.traveler");
  return t(locale, "citizen.level.citizen");
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
 * 活動スタッツ（CitizenStats）が内部段階として使う（表示は citizenLevelLabel が旅人/市民の二値に畳む・#525）。
 * CityHallBook のページ解放は citizenLevel（0|1|2|3 capped）。
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
 * 市民レベルの capped 値（0|1|2|3・#469）。citizenLevelFull を 3 で頭打ちにする。
 * #510 方針B でページ解禁ゲートは撤去したので、この値はページの閲覧可否を司らない。
 * 昇格の味付け分岐（levelFlavor: L1 が地図を開く／L2 以上が奥に達する）と初期表示ページ
 * （defaultPage）の判定にだけ使う。タイトルの進捗バッジ Ln は capped でない citizenLevelFull を使う。
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
  return Math.min(3, citizenLevelFull(input)) as CitizenLevel;
}

/**
 * 本を開いたときの既定ページ（最初に見せる導入的なページ）。ページ解禁とは無関係の初期表示だけを決める。
 * L0 → 1（移住案内） / それ以外 → 2（街の地図＝ご褒美ページを最初に見せる・#469）。
 * どのページも最初から閲覧可能（#510 方針B）で、奥のページ（沿革・条文）へは前送りで辿る。
 */
export function defaultPage(level: CitizenLevel): number {
  return level === 0 ? 1 : 2;
}
