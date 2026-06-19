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

/**
 * スワイプ進捗（純関数・#275）。ドラッグ中の横移動量 dx を [0,1] の進捗に正規化する。
 * 左右どちらに引いても同じだけ進むよう絶対値で見て、`maxDx` で 1 に飽和する。
 * = 「次画像が中央に来る直前」を 1 と見立てた、ぼかし量の元になる値。
 *
 * @param dx 始点からの横移動量（左へ動くと負・絶対値で評価）
 * @param maxDx 進捗が 1 に達する横移動量（px）。既定 120。
 */
export function swipeProgress(dx: number, maxDx = 120): number {
  return Math.min(Math.abs(dx) / maxDx, 1);
}

/**
 * 進捗（[0,1]）→ ぼかし量（px）の写像（純関数・#275）。線形に `maxBlur` まで開く。
 * 写真カルーセルと市民手帳のページ遷移で共有し、スワイプ量に応じて中身をぼかす。
 *
 * @param progress swipeProgress の戻り（[0,1] 前提・範囲外入力は [0,1] にクランプ）
 * @param maxBlur 進捗 1 のときのぼかし量（px）。既定 10（控えめ＝feel 調整しやすく）。
 */
export function swipeToBlur(progress: number, maxBlur = 10): number {
  const p = Math.max(0, Math.min(progress, 1));
  return p * maxBlur;
}
