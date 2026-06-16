// 植物写真向けフィルタのプリセット（DESIGN §3: ランダム適用でなく「選択式」）。
//
// 各プリセットは CSS の filter 文字列。プレビューでは style={{filter}} でライブ適用し、
// 投稿時は canvas に同じ filter を焼き込む（renderSquareImageFromRect）。
// color はチップに添えるスウォッチ色（雰囲気を伝える視覚ヒント）。

import type { FilterPreset } from "../nostr/types.ts";

// types.ts の FilterPreset を正とする（color を含む）。ここでは値だけ定義する。
export type { FilterPreset };

/**
 * 選択式フィルタの一覧。畑で迷わないよう、細かな調整ではなく効果単位のプリセットにする。
 * 重ねがけ前提なので、各効果は潰しすぎない強さに抑える。
 * 「なし」は UI 側で別途用意する（このリストには含めない）。
 */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { name: "葉露", filter: "brightness(1.02) contrast(1.06) saturate(1.08)", color: "#76b65a" },
  { name: "華美", filter: "brightness(1.04) contrast(1.04) saturate(1.16)", color: "#d96d8b" },
  { name: "土香", filter: "brightness(0.99) contrast(1.1) saturate(1.05) sepia(0.08)", color: "#9b7047" },
  { name: "葉隠", filter: "brightness(0.98) contrast(1.08) saturate(1.02)", color: "#2f4028", vignette: 0.82 },
  { name: "輪郭", filter: "brightness(1.01) contrast(1.08) saturate(1.02)", color: "#5e807c", sharpen: 0.72 },
] as const;

export function composeFilterCss(presets: readonly FilterPreset[]): string | null {
  if (presets.length === 0) return null;
  return presets.map((preset) => preset.filter).join(" ");
}

export function composeVignette(presets: readonly FilterPreset[]): number {
  return Math.max(0, ...presets.map((preset) => preset.vignette ?? 0));
}

export function composeSharpen(presets: readonly FilterPreset[]): number {
  return Math.max(0, ...presets.map((preset) => preset.sharpen ?? 0));
}
