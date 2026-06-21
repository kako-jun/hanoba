// ランキングの開発専用デモ fixture（#162）。
//
// **本番では一切使わない。** RankingBoard が `import.meta.env.DEV` かつ URL に `?demo` のときだけ
// 動的 import する（本番ビルドではこの分岐がデッドコードになり tree-shake される）。
// 目的は、まだ実投稿が少ない launch 直後でも、複数週・先週比（↑↓/NEW/RE）・途中経過チャート（uPlot）の
// 複数系列といったリッチな状態を `npm run dev` でリレーに何も publish せず確認すること（捏造データを本番に出さない）。
//
// 票数・順位は意図的に作り込む（先週比 up/down/same・NEW・RE・チャートの線の山谷が出るように）。
// タグは実カタログの品種名を使う（buildFuda が同定できる）。createdAt は now を起点に週単位で遡る
// （いつ実行しても「今週＋過去数週」になるよう、生成関数で相対的に組む）。

import type { FeedPost } from "./parse.ts";

const WEEK_SEC = 7 * 24 * 60 * 60;

// 週オフセット（0=今週・1=先週・…）と、その週に立てる品種タグの並び（出現順＝集計の初出順）。
// 同じ品種を複数回並べるとその週の票数が増える＝順位と sparkline の山谷を作れる。
const DEMO_WEEKS: { weeksAgo: number; tags: string[][] }[] = [
  // 3週前: グラキリスが主役（のちに一旦消えて RE で戻る布石）。
  {
    weeksAgo: 3,
    tags: [["グラキリス"], ["グラキリス"], ["グラキリス"], ["チタノタ"], ["オベサ"]],
  },
  // 2週前（先週の前）: チタノタ躍進・グラキリスは消える。
  {
    weeksAgo: 2,
    tags: [["チタノタ"], ["チタノタ"], ["チタノタ"], ["オベサ"], ["オベサ"], ["白鯨"]],
  },
  // 1週前（＝直前週）: オベサ1位・チタノタ2位・白鯨3位。今週との比較基準。
  {
    weeksAgo: 1,
    tags: [["オベサ"], ["オベサ"], ["オベサ"], ["チタノタ"], ["チタノタ"], ["白鯨"]],
  },
  // 今週: チタノタ↑1位・オベサ↓2位・白鯨 same3位・グラキリス RE・デリシオサ NEW。
  {
    weeksAgo: 0,
    tags: [
      ["チタノタ"],
      ["チタノタ"],
      ["チタノタ"],
      ["チタノタ"],
      ["オベサ"],
      ["オベサ"],
      ["オベサ"],
      ["白鯨"],
      ["グラキリス"],
      ["デリシオサ"],
    ],
  },
];

/**
 * デモ用の合成 FeedPost 群を組む（開発専用・relay には触れない）。
 * `now`（unix 秒）を起点に各週へ投稿を割り付ける。各投稿は週の内側（水曜相当）に置く。
 */
export function buildDemoRankingPosts(now: number): FeedPost[] {
  const posts: FeedPost[] = [];
  let n = 0;
  for (const { weeksAgo, tags } of DEMO_WEEKS) {
    for (const hashtags of tags) {
      // 週の中ほどに置く（境界跨ぎを避ける）。weeksAgo 週ぶん遡る。
      const createdAt = now - weeksAgo * WEEK_SEC - 2 * 24 * 60 * 60;
      const id = `demo-${n}`;
      posts.push({
        id,
        pubkey: "demo".padEnd(64, "0"),
        createdAt,
        caption: `デモ投稿 ${hashtags.join(" ")}`,
        imageUrls: [`https://example.invalid/demo-${n}.jpg`],
        imageUrl: `https://example.invalid/demo-${n}.jpg`,
        hashtags,
        shotDates: [],
      });
      n += 1;
    }
  }
  return posts;
}
