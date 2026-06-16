// 正方形クロップの計算（純粋）＋ canvas への焼き込み（ブラウザ専用）。
//
// 出力が常に 1:1 であることはこのモジュールの computeSquareCropRect が機械的に担保する
// （返り値は必ず幅=高さ=size）。renderSquareImage は canvas.width=canvas.height=size を
// 使うため、クロップ結果は構造的に正方形になる。フィルタも同じ 1 パスで焼き込む。

import type { PixelCrop } from "react-image-crop";

/** computeSquareCropRect の返り値（自然座標系の正方形矩形）。 */
export interface SquareCropRect {
  /** ソース画像内 x（自然座標 px・整数） */
  sx: number;
  /** ソース画像内 y（自然座標 px・整数） */
  sy: number;
  /** 一辺の長さ（自然座標 px・整数。幅=高さ=size＝1:1 の保証点） */
  size: number;
}

function clampInt(value: number, min: number, max: number): number {
  const v = Math.round(value);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * react-image-crop の PixelCrop（表示 px）から、ソース画像内の正方形矩形を計算する純粋関数。
 *
 * @param crop  表示 px の x/y/width/height（aspect=1 なので原則 width≈height だが、非正方形でも安全）
 * @param scaleX naturalWidth / displayWidth
 * @param scaleY naturalHeight / displayHeight
 * @param naturalW 画像の自然幅
 * @param naturalH 画像の自然高さ
 *
 * 手順:
 *   1. 表示座標を自然座標へ変換（nx,ny,nw,nh）
 *   2. size = round(min(nw, nh)) で正方形を保証
 *   3. sx,sy を画像境界内にクランプ（sx+size<=naturalW, sy+size<=naturalH, size>=1）
 * 返り値は必ず正方形（幅=高さ=size）。これが「出力が常に 1:1」の保証点。
 */
export function computeSquareCropRect(
  crop: PixelCrop,
  scaleX: number,
  scaleY: number,
  naturalW: number,
  naturalH: number,
): SquareCropRect {
  const nx = crop.x * scaleX;
  const ny = crop.y * scaleY;
  const nw = crop.width * scaleX;
  const nh = crop.height * scaleY;

  // 一辺は短い方に合わせて正方形化。画像より大きくならないよう全体上限も掛ける。
  const maxSide = Math.min(naturalW, naturalH);
  let size = Math.round(Math.min(nw, nh));
  if (size > maxSide) size = Math.floor(maxSide);
  if (size < 1) size = 1;

  // 正方形が画像内に収まるよう原点をクランプ（右端・下端がはみ出さない）。
  const sx = clampInt(nx, 0, naturalW - size);
  const sy = clampInt(ny, 0, naturalH - size);

  return { sx, sy, size };
}

/**
 * クロップ＋フィルタを 1 パスで canvas に焼き込み、正方形の画像 Blob を返す。
 * ブラウザ専用（HTMLCanvasElement / toBlob を使う）。SSR では呼ばない。
 *
 * - computeSquareCropRect で source 矩形（自然座標）を得る
 * - canvas.width = canvas.height = size（出力は常に 1:1）
 * - ctx.filter = filterCss ?? "none" を設定してから drawImage（クロップとフィルタを同時に適用）
 * - toBlob を Promise 化して返す。blob が null なら reject
 *
 * アップロードされる画像が実際にフィルタ済み・正方形であることをここで保証する。
 */
export function renderSquareImage(
  image: HTMLImageElement,
  crop: PixelCrop,
  filterCss: string | null,
  vignette = 0,
  type = "image/jpeg",
  quality = 0.95,
): Promise<Blob> {
  const naturalW = image.naturalWidth;
  const naturalH = image.naturalHeight;
  const displayW = image.width || naturalW;
  const displayH = image.height || naturalH;
  const scaleX = naturalW / displayW;
  const scaleY = naturalH / displayH;

  const { sx, sy, size } = computeSquareCropRect(crop, scaleX, scaleY, naturalW, naturalH);

  return renderSquareImageFromRect(image, { sx, sy, size }, filterCss, vignette, type, quality);
}

/**
 * 自然座標系の正方形矩形から canvas に焼き込む。
 * 複数画像投稿では、表示中でない画像も Object URL から再ロードして同じ rect で処理する。
 */
export function renderSquareImageFromRect(
  image: HTMLImageElement,
  rect: SquareCropRect,
  filterCss: string | null,
  vignette = 0,
  type = "image/jpeg",
  quality = 0.95,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = rect.size;
  canvas.height = rect.size;

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return Promise.reject(new Error("2D コンテキストを取得できませんでした"));
  }

  // canvas は呼び出しごとに新規生成するため、filter のリセット（"none" へ戻す）は不要。
  ctx.filter = filterCss ?? "none";
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, rect.size, rect.size);
  drawVignette(ctx, rect.size, vignette);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error("画像の生成に失敗しました（toBlob が null）"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

function drawVignette(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  if (amount <= 0) return;
  const opacity = Math.min(Math.max(amount, 0), 1);
  const gradient = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.72);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.62, `rgba(0, 0, 0, ${opacity * 0.18})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${opacity * 0.72})`);
  ctx.save();
  ctx.filter = "none";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
}
