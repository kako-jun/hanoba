// 植物写真向けフィルタのプリセット（DESIGN §3: ランダム適用でなく「選択式」）。
//
// 各効果は なし/弱/中/強 の4段（#171）。プリセットは弱/中/強の3段（levels）を明示的に持ち、
// CSS 文字列をパースして強度を割り出すのではなく、段ごとに値を定義する explicit per-level モデル。
// プレビューでは解決した段の filter を style={{filter}} でライブ適用し、投稿時は canvas に焼き込む。
// color はチップに添えるスウォッチ色（雰囲気を伝える視覚ヒント）。

import type { FilterLevel, FilterPreset, FilterStrength, SelectedFilter } from "../nostr/types.ts";

// types.ts の型を正とする（color / levels を含む）。ここでは値だけ定義する。
export type { FilterLevel, FilterPreset, FilterStrength, SelectedFilter };

/** トーンカーブの既定の効き（buildToneLut の amount 既定と揃える）。 */
const DEFAULT_TONE_AMOUNT = 0.32;

/**
 * 選択式フィルタの一覧。畑で迷わないよう、細かな調整ではなく効果単位のプリセットにする。
 * 各プリセットは [弱, 中, 強] の3段を持つ。**中(levels[1])＝既定の効き**で、弱/中/強は中の前後。
 * 線明（シャープ）は効きが強すぎたので中を旧 0.82 より下げる（#171）。彩度を上げるのは美華だけ。
 * 「なし」は UI 側で別途用意する（このリストには含めない・配列に存在しない＝なし）。
 */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  {
    name: "淡陽",
    color: "#d9b85f",
    levels: [
      { filter: "brightness(1.04)" },
      { filter: "brightness(1.08)" },
      { filter: "brightness(1.13)" },
    ],
  },
  // 翠露/土香 は CSS contrast ではなく canvas のトーンカーブで焼き込む（#156）。
  // 焼き込みは toneCurve+toneAmount、プレビューは toneCurvePreviewCss の contrast() で近似する。
  {
    name: "翠露",
    color: "#76b65a",
    // 強の効きを上げ・中もずらす・弱は据置（#185 kako-jun 実機）。
    levels: [
      { filter: "none", toneCurve: "s", toneAmount: 0.2 },
      { filter: "none", toneCurve: "s", toneAmount: 0.42 },
      { filter: "none", toneCurve: "s", toneAmount: 0.6 },
    ],
  },
  {
    name: "土香",
    color: "#9b7047",
    // 翠露と対称に 強を上げ・中をずらす・弱は据置（#185）。
    levels: [
      { filter: "none", toneCurve: "reverse-s", toneAmount: 0.2 },
      { filter: "none", toneCurve: "reverse-s", toneAmount: 0.42 },
      { filter: "none", toneCurve: "reverse-s", toneAmount: 0.6 },
    ],
  },
  {
    name: "美華",
    color: "#d96d8b",
    // 彩度も 強を上げ・中をずらす・弱は据置（#185）。
    levels: [
      { filter: "saturate(1.14)" },
      { filter: "saturate(1.4)" },
      { filter: "saturate(1.7)" },
    ],
  },
  {
    name: "影暮",
    color: "#2f4028",
    levels: [
      { filter: "none", vignette: 0.5 },
      { filter: "none", vignette: 0.82 },
      { filter: "none", vignette: 1.0 },
    ],
  },
  {
    name: "霞幻",
    color: "#aebfcb",
    levels: [
      { filter: "none", edgeBlur: 0.35 },
      { filter: "none", edgeBlur: 0.6 },
      { filter: "none", edgeBlur: 0.85 },
    ],
  },
  {
    name: "線明",
    color: "#5e807c",
    // 線明は弱でも効きが強すぎたので、3段すべて下げる（#244 kako-jun 実機）。
    // 弱0.3→0.15 / 中0.5→0.3 / 強0.7→0.5。最終値は実機 blink で詰める。
    levels: [
      { filter: "none", sharpen: 0.15 },
      { filter: "none", sharpen: 0.3 },
      { filter: "none", sharpen: 0.5 },
    ],
  },
] as const;

/**
 * 選択中フィルタ（name + strength）を FILTER_PRESETS から解決し、該当段の FilterLevel を返す。
 * 名前が見つからない・段が不正な場合は null（合成側で無視される）。
 */
export function resolveLevel(selected: SelectedFilter): FilterLevel | null {
  const preset = FILTER_PRESETS.find((p) => p.name === selected.name);
  if (preset === undefined) return null;
  return preset.levels[selected.strength - 1] ?? null;
}

function resolvedLevels(selected: readonly SelectedFilter[]): FilterLevel[] {
  return selected.map(resolveLevel).filter((level): level is FilterLevel => level !== null);
}

export function composeFilterCss(selected: readonly SelectedFilter[]): string | null {
  const filters = resolvedLevels(selected)
    .map((level) => level.filter)
    .filter((filter): filter is string => filter !== undefined && filter !== "none");
  return filters.length > 0 ? filters.join(" ") : null;
}

/**
 * 重ねがけ後のトーンカーブを決める。S字（翠露）と逆S字（土香）を同時選択したときは、
 * 相反するので完全に相殺して `null`（＝トーン処理なし）にする。複数同種は同じ向きへ。
 */
export function composeToneCurve(selected: readonly SelectedFilter[]): "s" | "reverse-s" | null {
  const levels = resolvedLevels(selected);
  const hasS = levels.some((level) => level.toneCurve === "s");
  const hasReverse = levels.some((level) => level.toneCurve === "reverse-s");
  if (hasS && hasReverse) return null;
  if (hasS) return "s";
  if (hasReverse) return "reverse-s";
  return null;
}

/**
 * 採用されるトーンカーブ（相殺後に残った向き）の amount を返す（#171）。
 * 同じ向きが複数なら Max。残る向きが無ければ 0（＝焼き込みでトーン処理しない）。
 */
export function composeToneAmount(selected: readonly SelectedFilter[]): number {
  const tone = composeToneCurve(selected);
  if (tone === null) return 0;
  const amounts = resolvedLevels(selected)
    .filter((level) => level.toneCurve === tone)
    .map((level) => level.toneAmount ?? DEFAULT_TONE_AMOUNT);
  return amounts.length > 0 ? Math.max(...amounts) : DEFAULT_TONE_AMOUNT;
}

/** トーンカーブのプレビュー近似（焼き込みは canvas LUT、プレビューは CSS contrast で近似）。 */
export function toneCurvePreviewCss(tone: "s" | "reverse-s" | null, amount = DEFAULT_TONE_AMOUNT): string | null {
  if (tone === null) return null;
  // amount=0.32（既定）で旧来の contrast(1.16)/contrast(0.86) に一致するよう、振れ幅を amount に比例させる。
  const span = (amount / DEFAULT_TONE_AMOUNT) * 0.16;
  if (tone === "s") return `contrast(${(1 + span).toFixed(3)})`;
  return `contrast(${(1 - span).toFixed(3)})`;
}

export function composeVignette(selected: readonly SelectedFilter[]): number {
  return Math.max(0, ...resolvedLevels(selected).map((level) => level.vignette ?? 0));
}

export function composeSharpen(selected: readonly SelectedFilter[]): number {
  return Math.max(0, ...resolvedLevels(selected).map((level) => level.sharpen ?? 0));
}

export function composeEdgeBlur(selected: readonly SelectedFilter[]): number {
  return Math.max(0, ...resolvedLevels(selected).map((level) => level.edgeBlur ?? 0));
}
