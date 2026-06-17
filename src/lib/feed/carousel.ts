// 複数写真カルーセルの純粋関数（定義先行・テスト対象・#184）。
// 次/前 index の計算とスワイプ判定だけを担い、React や DOM には依存しない。
// PostDetail の ←→ ボタン・キーボード矢印・タッチスワイプはすべてこれを共有する。

/**
 * 次の写真の index（端は wrap）。`(i + 1) % len`。
 * len <= 1 のときは切り替えない（i を返す）。
 */
export function nextPhotoIndex(i: number, len: number): number {
  if (len <= 1) return i;
  return (i + 1) % len;
}

/**
 * 前の写真の index（端は wrap）。`i === 0 ? len - 1 : i - 1`。
 * len <= 1 のときは切り替えない（i を返す）。
 */
export function prevPhotoIndex(i: number, len: number): number {
  if (len <= 1) return i;
  return i === 0 ? len - 1 : i - 1;
}

/**
 * スワイプの向き判定（純関数）。タッチ開始→終了の差分から方向を決める。
 *
 * - 水平優位（|dx| > |dy|）かつ |dx| がしきい値超のときだけ確定する
 *   （縦スクロール・ピンチ・微小なタップと競合させない）。
 * - 左スワイプ（dx < 0）＝ "next"（次の写真）、右スワイプ（dx > 0）＝ "prev"（前の写真）。
 * - それ以外（縦優位・しきい値未満）は null（何もしない）。
 *
 * @param dx 終点x - 始点x（左に動くと負）
 * @param dy 終点y - 始点y
 * @param threshold 確定とみなす最小の水平移動量（px）。既定 40。
 */
export function swipeDirection(dx: number, dy: number, threshold = 40): "next" | "prev" | null {
  if (Math.abs(dx) <= threshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? "next" : "prev";
}
