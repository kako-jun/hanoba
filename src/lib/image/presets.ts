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
  { name: "淡陽", filter: "brightness(1.08)", color: "#d9b85f" },
  // 翠露/土香 は CSS contrast ではなく canvas のトーンカーブで焼き込む（#156）。
  // 焼き込みは toneCurve、プレビューは toneCurvePreviewCss の contrast() で近似する。
  { name: "翠露", filter: "none", color: "#76b65a", toneCurve: "s" },
  { name: "土香", filter: "none", color: "#9b7047", toneCurve: "reverse-s" },
  { name: "美華", filter: "saturate(1.28)", color: "#d96d8b" },
  { name: "影暮", filter: "brightness(0.98) contrast(1.08)", color: "#2f4028", vignette: 0.82 },
  { name: "霞幻", filter: "none", color: "#aebfcb", edgeBlur: 0.6 },
  { name: "線明", filter: "none", color: "#5e807c", sharpen: 0.82 },
] as const;

export function composeFilterCss(presets: readonly FilterPreset[]): string | null {
  const filters = presets.map((preset) => preset.filter).filter((filter) => filter !== "none");
  return filters.length > 0 ? filters.join(" ") : null;
}

/**
 * 重ねがけ後のトーンカーブを決める。S字（翠露）と逆S字（土香）を同時選択したときは、
 * 相反するので完全に相殺して `null`（＝トーン処理なし）にする。複数同種は同じ向きへ。
 */
export function composeToneCurve(presets: readonly FilterPreset[]): "s" | "reverse-s" | null {
  const hasS = presets.some((preset) => preset.toneCurve === "s");
  const hasReverse = presets.some((preset) => preset.toneCurve === "reverse-s");
  if (hasS && hasReverse) return null;
  if (hasS) return "s";
  if (hasReverse) return "reverse-s";
  return null;
}

/** トーンカーブのプレビュー近似（焼き込みは canvas LUT、プレビューは従来の CSS contrast）。 */
export function toneCurvePreviewCss(tone: "s" | "reverse-s" | null): string | null {
  if (tone === "s") return "contrast(1.16)";
  if (tone === "reverse-s") return "contrast(0.86)";
  return null;
}

export function composeVignette(presets: readonly FilterPreset[]): number {
  return Math.max(0, ...presets.map((preset) => preset.vignette ?? 0));
}

export function composeSharpen(presets: readonly FilterPreset[]): number {
  return Math.max(0, ...presets.map((preset) => preset.sharpen ?? 0));
}

export function composeEdgeBlur(presets: readonly FilterPreset[]): number {
  return Math.max(0, ...presets.map((preset) => preset.edgeBlur ?? 0));
}
