// 「緑の総面積」スタッツの純粋ロジック（#310・脱ゲーム化の称号置換）。
//
// kako-jun: 称号（エゴ）でなく「自分が街に足した緑」を静かに出す。写真は茶色（鉢・塊根）か
// 緑（葉）が多いので、**緑のピクセル割合**を積む＝緑の貢献を可視化（茶色は数えない＝意図どおりの偏り）。
// 見た目は GitHub の草グリッド（1マス=1投稿・濃淡=その写真の緑割合・合計の面積感で「足した緑」）。
//
// canvas のサンプリング（getImageData）は browser 側（GreenArea.tsx）の責務。ここは **rgba 配列を
// 受ける純関数**だけにして単体テスト可能にする（crop.ts と同方針＝jsdom は getImageData 不可なので
// 画素読みは純関数に切り出してテストする）。**概算でよい**（kako-jun）＝厳密な色科学はしない。

/**
 * 1画素が「緑」か（純関数・概算）。緑が最も強く、赤・青より明確に高い画素を緑とみなす。
 * - 茶色（鉢・塊根＝赤優勢）・灰/白/黒（均等）は除外＝「緑の貢献」だけ数える（#310 意図どおりの偏り）。
 * - `g > 40` で暗すぎる画素（夜の影・黒土）を除外、`g > r+8 / g > b+8` で赤優勢・無彩色を除外。
 *   マージン 8 は概算の安全幅（オリーブ/カーキの境界は緩く落とす）。
 */
export function isGreenPixel(r: number, g: number, b: number): boolean {
  return g > 40 && g > r + 8 && g > b + 8;
}

/**
 * RGBA 画素配列（`getImageData().data`＝4byte/px）から**緑画素の割合** [0,1] を返す（純関数）。
 * - 完全透明（alpha 0）の画素は分母から除外する（切り抜き等で透過があっても歪めない）。
 * - 画素が無い（空配列／全透明）は 0。
 */
export function greenRatio(rgba: Uint8ClampedArray | number[]): number {
  let green = 0;
  let opaque = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    const a = rgba[i + 3]!;
    if (a === 0) continue; // 透明は数えない
    opaque++;
    if (isGreenPixel(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!)) green++;
  }
  return opaque === 0 ? 0 : green / opaque;
}

/**
 * 全写真の緑割合（`null`＝非CORS等で読めない写真）から「街に足した緑の累計」を出す純関数（#344）。
 * - `equivalent`: 読めた写真の緑割合の総和＝**緑100%の写真に換算して何枚分**か（例 0.5 が 12 枚→6.0）。
 * - `readable`: 緑割合を読めた写真数（読めない写真は除外し、ここに数えない＝累計の分母を歪めない）。
 * 草グリッド・濃淡レベルは #344 で廃止（先頭写真限定・60件上限もやめ、全投稿の全写真の累計にした）。
 */
export function cumulativeGreen(
  ratios: ReadonlyArray<number | null>,
): { equivalent: number; readable: number } {
  let equivalent = 0;
  let readable = 0;
  for (const r of ratios) {
    if (r === null) continue;
    equivalent += r;
    readable += 1;
  }
  return { equivalent, readable };
}
