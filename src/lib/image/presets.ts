// 植物写真向けフィルタのプリセット（DESIGN §3: ランダム適用でなく「選択式」）。
//
// 各プリセットは CSS の filter 文字列。プレビューでは style={{filter}} でライブ適用し、
// 投稿時は canvas に同じ filter を焼き込む（renderSquareImageFromRect）。
// color はチップに添えるスウォッチ色（雰囲気を伝える視覚ヒント）。

import type { FilterPreset } from "../nostr/types.ts";

// types.ts の FilterPreset を正とする（color を含む）。ここでは値だけ定義する。
export type { FilterPreset };

/**
 * 選択式フィルタの一覧。畑で迷わないよう、細かな調整ではなく用途が違うプリセットだけにする。
 * 葉の階調は潰さず、必要な時だけ周辺減光で見せたくない範囲を落とす。
 * 「なし」は UI 側で別途用意する（このリストには含めない）。
 */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { name: "葉を残す", filter: "brightness(1.03) contrast(1.07) saturate(1.1)", color: "#76b65a" },
  { name: "花を出す", filter: "brightness(1.08) contrast(1.03) saturate(1.22)", color: "#d96d8b" },
  { name: "土を温かく", filter: "brightness(1.02) contrast(1.12) saturate(0.95) sepia(0.14)", color: "#a5794f" },
  { name: "周辺を隠す", filter: "brightness(0.98) contrast(1.14) saturate(1.04)", color: "#2f4028", vignette: 0.82 },
  { name: "記録モノ", filter: "brightness(1.04) contrast(1.24) saturate(0.15) grayscale(0.85)", color: "#777777" },
] as const;
