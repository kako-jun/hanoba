// 市民の活動スタッツ（#272）の純粋集計。すべて t:hanoba 投稿からのクライアント集計＝backendless。
//
// 自分も他人も**公開投稿を数えるだけ**（新たな身バレ無し）。RankingBoard / CityHallBook と同じ
// 「読むたびに数える」方式。Date.now は呼ばず now（秒）を引数で受ける＝テスト容易・決定的。
//
// 品種の同定は #182/#23 の `tallyVarieties`（buildFuda 一本化）を再利用する（属/品種の畳み込み・
// 同一投稿内 alias 違いの二重計上防止・票数つき降順）＝ランキングと「育てた品種」が一致する。

import { citizenLevelFull } from "../lore/citizen.ts";
import { tallyVarieties, type RankedVariety } from "./ranking.ts";
import type { FeedPost } from "./parse.ts";
import type { VarietyCategory } from "../plants/variety-catalog.ts";

/** 1 日の秒数（居住日数の算出）。 */
const DAY_SEC = 86400;

/** 市民の活動スタッツ（自分／他人共通）。 */
export interface CitizenStats {
  /** 投稿数（育てた鉢の記録数・t:hanoba）。 */
  postCount: number;
  /** 写真枚数（全投稿の imageUrls 合計）。 */
  photoCount: number;
  /** 育てた品種（票数つき降順・図鑑的な一覧）。tallyVarieties と同じ同定。 */
  varieties: RankedVariety[];
  /** 育てた品種の種類数（varieties.length）。 */
  varietyCount: number;
  /** 居住日数（最古投稿の created_at から now まで・投稿が無ければ 0）。 */
  tenureDays: number;
  /** 最古投稿の created_at（unix 秒・投稿が無ければ null）。 */
  earliestCreatedAt: number | null;
  /** 市民レベル Ln（旅人=0 / 市民=1 / 市民L2=2 / 市民L3…・非キャップ・citizenLevelLabel で表示）。 */
  level: number;
}

/**
 * 市民の活動スタッツを投稿群から組む純関数（#272）。
 * @param input.posts  その市民の t:hanoba 投稿（fetchMyPosts(pubkey)・他人にも流用可）
 * @param input.catalog 品種カタログ（buildFuda 用）
 * @param input.hasName 表示名が登録済みか（市民レベルの判定＝名乗りで市民）
 * @param input.now    現在時刻（unix 秒・居住日数とレベルの基準）
 */
export function computeCitizenStats(input: {
  posts: FeedPost[];
  catalog: VarietyCategory[];
  hasName: boolean;
  now: number;
}): CitizenStats {
  const { posts, catalog, hasName, now } = input;

  const postCount = posts.length;
  const photoCount = posts.reduce((sum, p) => sum + p.imageUrls.length, 0);
  const varieties = tallyVarieties(posts, catalog);

  // 最古投稿（居住の起点）。投稿が無ければ null＝居住 0 日。
  const earliestCreatedAt =
    posts.length > 0 ? posts.reduce((min, p) => (p.createdAt < min ? p.createdAt : min), posts[0]!.createdAt) : null;
  const tenureDays = earliestCreatedAt !== null ? Math.max(0, Math.floor((now - earliestCreatedAt) / DAY_SEC)) : 0;

  const level = citizenLevelFull({ hasName, postCount, earliestCreatedAt, now });

  return {
    postCount,
    photoCount,
    varieties,
    varietyCount: varieties.length,
    tenureDays,
    earliestCreatedAt,
    level,
  };
}
