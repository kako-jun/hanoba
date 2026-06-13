// レトロ加工フィルタのプリセット（DESIGN §3: ランダム適用でなく「選択式」）。
//
// 各プリセットは CSS の filter 文字列。プレビューでは style={{filter}} でライブ適用し、
// 投稿時は canvas に同じ filter を焼き込む（renderSquareImage）。
// color はチップに添えるスウォッチ色（雰囲気を伝える視覚ヒント）。

import type { FilterPreset } from "../nostr/types.ts";

// types.ts の FilterPreset を正とする（color を含む）。ここでは値だけ定義する。
export type { FilterPreset };

/**
 * 選択式フィルタの一覧（7 件）。ガチャではなくユーザーが選ぶ。
 * 「なし」は UI 側で別途用意する（このリストには含めない）。
 */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  { name: "Fuji", filter: "brightness(1.1) contrast(1.3) saturate(1.2) hue-rotate(-5deg)", color: "#00a86b" },
  { name: "Kodak", filter: "brightness(1.05) contrast(1.2) saturate(0.9) sepia(0.15)", color: "#e6a817" },
  { name: "Wash", filter: "brightness(1.15) contrast(0.85) saturate(0.7)", color: "#b8a9c9" },
  { name: "Xpro", filter: "brightness(1.05) contrast(1.4) saturate(1.3) hue-rotate(15deg)", color: "#e04070" },
  { name: "Mono", filter: "brightness(1.1) contrast(1.4) grayscale(1)", color: "#606060" },
  { name: "Cool", filter: "brightness(1.05) contrast(1.2) saturate(0.85) hue-rotate(20deg)", color: "#4a90d9" },
  { name: "Vivid", filter: "contrast(1.2) saturate(1.4)", color: "#ff6b35" },
] as const;
