// 市民の実績バッジ（称号）。#272 段階2。すべて CitizenStats の公開集計（投稿/写真/品種/居住）から
// 純粋に解除判定する＝backendless・新たな身バレ無し（公開投稿を数えるだけ）。市民Ln（lore/citizen.ts・
// 複合 居住×投稿）と対を成し、品種コンプ・節目の鉢数・居住の長さなど「点」の達成をバッジで称える
// （kako-jun: 居住×投稿で市民Ln・品種等はバッジ）。
//
// 文言は市長ボタニクス・フォン・ハノーバの声（lore/cityHall.ts と一貫）。連続投稿バッジは streak 計算が
// 要るため段階4（草/ヒートマップ）に回す。Date.now は呼ばない（集計値の比較だけ）＝テスト容易・決定的。

/** バッジが見る集計軸。 */
export type BadgeMetric = "posts" | "photos" | "varieties" | "tenure";

/** バッジ定義（しきい値で解除）。表示順は配列順。 */
export interface BadgeDef {
  key: string;
  /** 称号名（解除時に表示）。 */
  label: string;
  /** 解除時に添える市長の一言（hover の title）。 */
  flavor: string;
  /** 判定する集計軸。 */
  metric: BadgeMetric;
  /** 解除しきい値（metric の値がこれ以上で解除）。 */
  threshold: number;
}

/**
 * 称号の一覧（表示順・節目で増える）。鉢数（投稿）・品種・写真・居住の4系統。
 * 連続投稿系は段階4（草）で streak を出してから足す。
 */
export const BADGES: BadgeDef[] = [
  { key: "first-pot", label: "初めの一鉢", flavor: "最初の一鉢が芽吹いた。市は、また少し緑になった。", metric: "posts", threshold: 1 },
  { key: "pots-10", label: "十鉢の庭", flavor: "気づけば十鉢。諸君の区画は、もう立派な庭だ。", metric: "posts", threshold: 10 },
  { key: "pots-50", label: "五十鉢の温室", flavor: "五十鉢とは。葉脈川の水も、忙しくなるわけだ。", metric: "posts", threshold: 50 },
  { key: "pots-100", label: "百鉢の主", flavor: "百鉢を超えた。諸君を温室街の主と認めよう。", metric: "posts", threshold: 100 },
  { key: "species-10", label: "十種の蒐集家", flavor: "十種を育て分ける手。蒐集家の素質があるな。", metric: "varieties", threshold: 10 },
  { key: "species-30", label: "三十種の植物学者", flavor: "三十種。もはや市の植物学者と呼ぶほかない。", metric: "varieties", threshold: 30 },
  { key: "photos-100", label: "百枚の植物図譜", flavor: "百枚の記録。これはもう、市の植物図譜だ。", metric: "photos", threshold: 100 },
  { key: "tenure-30", label: "ひと月の住人", flavor: "移り住んでひと月。すっかり街の顔だな。", metric: "tenure", threshold: 30 },
  { key: "tenure-365", label: "一年の古参", flavor: "丸一年、よく根を張った。市の古い友人だ。", metric: "tenure", threshold: 365 },
];

/** バッジ判定の入力（CitizenStats の集計値の部分集合）。 */
export interface BadgeInput {
  postCount: number;
  photoCount: number;
  varietyCount: number;
  tenureDays: number;
}

/** metric ごとの表示メタ（未解除ヒント用）。 */
const METRIC_META: Record<BadgeMetric, { label: string; unit: string }> = {
  posts: { label: "投稿", unit: "件" },
  photos: { label: "写真", unit: "枚" },
  varieties: { label: "育てた品種", unit: "種" },
  tenure: { label: "居住", unit: "日" },
};

/** バッジが見る集計値を取り出す。 */
function metricValue(input: BadgeInput, metric: BadgeMetric): number {
  switch (metric) {
    case "posts":
      return input.postCount;
    case "photos":
      return input.photoCount;
    case "varieties":
      return input.varietyCount;
    case "tenure":
      return input.tenureDays;
  }
}

/** 未解除バッジのヒント文（「投稿が10件で開きます」等・図鑑式 ??? の title）。 */
export function badgeHint(def: BadgeDef): string {
  const m = METRIC_META[def.metric];
  return `${m.label}が${def.threshold}${m.unit}で開きます。`;
}

/** 1 バッジの解除状態。 */
export interface BadgeStatus {
  def: BadgeDef;
  unlocked: boolean;
}

/**
 * 全バッジの解除状態を表示順で返す純関数（#272 段階2）。
 * 各バッジは metric の集計値がしきい値以上で解除。連続投稿系は含めない（段階4）。
 */
export function evaluateBadges(input: BadgeInput): BadgeStatus[] {
  return BADGES.map((def) => ({ def, unlocked: metricValue(input, def.metric) >= def.threshold }));
}

/** 解除済みバッジ数（「N / 総数」表示用）。 */
export function unlockedBadgeCount(input: BadgeInput): number {
  return evaluateBadges(input).reduce((n, b) => (b.unlocked ? n + 1 : n), 0);
}
