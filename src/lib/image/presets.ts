// 植物写真向けフィルタのプリセット（DESIGN §3: ランダム適用でなく「選択式」）。
//
// 各プリセットは CSS の filter 文字列。プレビューでは style={{filter}} でライブ適用し、
// 投稿時は canvas に同じ filter を焼き込む（renderSquareImageFromRect）。
// color はチップに添えるスウォッチ色（雰囲気を伝える視覚ヒント）。

import type { FilterPreset } from "../nostr/types.ts";

// types.ts の FilterPreset を正とする（color を含む）。ここでは値だけ定義する。
export type { FilterPreset };

/**
 * 選択式フィルタの一覧。畑で迷わないよう、細かな調整ではなく穏やかなプリセットだけにする。
 * 葉の階調を潰さないため、contrast/saturate/hue-rotate は控えめに抑える。
 * 「なし」は UI 側で別途用意する（このリストには含めない）。
 */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { name: "自然光", filter: "brightness(1.04) contrast(1.04) saturate(1.04)", color: "#8fbf6a" },
  { name: "朝の葉", filter: "brightness(1.06) contrast(1.02) saturate(1.08)", color: "#74a65d" },
  { name: "曇り補正", filter: "brightness(1.08) contrast(1.05) saturate(1.02)", color: "#9aa7a1" },
  { name: "土の色", filter: "brightness(1.02) contrast(1.04) saturate(0.98) sepia(0.06)", color: "#9b7a55" },
  { name: "花やわらか", filter: "brightness(1.05) contrast(0.98) saturate(1.06)", color: "#d8899a" },
] as const;
