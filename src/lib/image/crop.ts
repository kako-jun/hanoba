// 正方形クロップの計算（純粋）＋ canvas への焼き込み（ブラウザ専用）。
//
// 出力が常に 1:1 であることはこのモジュールの computeSquareCropRect が機械的に担保する
// （返り値は必ず幅=高さ=size）。renderSquareImage は canvas.width=canvas.height=size を
// 使うため、クロップ結果は構造的に正方形になる。フィルタも同じ 1 パスで焼き込む。

import type { PixelCrop } from "react-image-crop";

/** トーンカーブの種別（#156）。"s"=S字で締め、"reverse-s"=逆S字でやわらげる。null は無処理。 */
export type ToneCurve = "s" | "reverse-s" | null;

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
 * 出力 canvas の一辺の上限（#167）。クロップ正方形の実寸は最大 ~3000px に達するが、
 * 1:1 フィードでは nostr.build が配信時にどうせ縮小するので長辺 1440px で十分。
 * 巨大 JPEG の生成・CPU フィルタ・アップロードを短縮するためにここで上限を掛ける。
 */
export const MAX_OUTPUT_EDGE = 1440;

/**
 * 出力 canvas の一辺＝クロップ正方形の実寸を上限でクランプする（拡大はしない）純関数（#167）。
 * rectSize が maxEdge 以下ならそのまま（小さい画像を引き伸ばさない）、超えるなら maxEdge に縮める。
 */
export function outputEdge(rectSize: number, maxEdge = MAX_OUTPUT_EDGE): number {
  return Math.min(rectSize, maxEdge);
}

/**
 * 微調整（水平出し）スライダの範囲（±度・#314）。90度回転はボタン、これは細かい傾き補正。
 */
export const MAX_FINE_ROTATION = 15;

/**
 * 総回転角の **微調整成分**（最寄り90度からのズレ・±45内）を返す純関数（#314）。
 * 微調整スライダの値に使う（例 100°→ fine 10°／-95°→ fine -5°）。90度成分はボタンが担う。
 */
export function rotationFine(deg: number): number {
  return deg - Math.round(deg / 90) * 90;
}

/**
 * 画像を `degrees` だけ **その場で（natural サイズの canvas に中心回転で）** 描く（ブラウザ専用・#314）。
 * mypace ImageEditor と同方式: 出力 canvas は元画像と同寸で、中心を軸に回転して描く（四隅は欠けるが
 * 座標系が元画像と一致する）。これを `renderSquareImageFromRect` の image 引数に渡すと、**プレビューの
 * CSS `transform: rotate()` と同じ見え**で焼ける（crop 矩形は元画像の自然座標のままで一致＝枠ズレなし・
 * blob 再生成の遅延なし）。四隅の欠けは白で埋める（JPEG で黒にならないよう）。
 */
export function renderInPlaceRotation(image: HTMLImageElement | HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const w = "naturalWidth" in image ? image.naturalWidth || image.width : image.width;
  const h = "naturalHeight" in image ? image.naturalHeight || image.height : image.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (ctx === null) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(image, 0, 0, w, h);
  return canvas;
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

/** % 単位の正方形クロップ（react-image-crop の percentCrop と同じ x/y/width/height）。 */
export interface PercentCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 自然座標の正方形矩形（SquareCropRect）を react-image-crop の % クロップへ変換する純関数（#403）。
 *
 * 自然座標（sx/sy/size）を画像の自然寸法（naturalW/naturalH）で割って % に直す。CropFrame の onImageLoad
 * と undo 時の表示再同期（cropSyncToken effect）の両方が同じ変換を使うためにここへ切り出した（ロジック二重化を避ける）。
 * naturalW/naturalH が 0 以下なら 0 除算を避けて中央寄りの安全な既定（中央 90% 正方形相当ではなく素直に 0,0）を返す。
 */
export function squareRectToPercentCrop(rect: SquareCropRect, naturalW: number, naturalH: number): PercentCrop {
  if (naturalW <= 0 || naturalH <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: (rect.sx / naturalW) * 100,
    y: (rect.sy / naturalH) * 100,
    width: (rect.size / naturalW) * 100,
    height: (rect.size / naturalH) * 100,
  };
}

/**
 * 回転後の「見えている写真の領域」に正方形クロップ(%)を収める純関数（#348）。
 *
 * 焼き込み（`renderInPlaceRotation`）もプレビュー（CSS `transform: rotate()`）も**元画像と同寸（W×H）の
 * box に中心回転で描く**ので、90/270 回転だと写真は中心の `min(W,H)` 正方形だけが見え、左右（または上下）は
 * letterbox の空き帯になる。だが react-image-crop の操作領域は回転前の box（W×H）のままなので、クロップ枠を
 * **空き帯（写真外）までドラッグできてしまう**（#348）。これを見えている領域に clamp する。
 * - 0/180（`quarter` 偶数）: box 全体が見えているので素通し（微調整回転も含め退行させない）。
 * - 90/270（`quarter` 奇数）: 中心の `S=min(W,H)` 正方形に収める（位置・サイズとも）。
 *
 * `box{W,H}` は表示中の img（回転前）の px 寸法。返り値は % 単位（正方形＝px で width≈height）。
 */
export function clampCropToVisible(crop: PercentCrop, rotation: number, boxW: number, boxH: number): PercentCrop {
  if (boxW <= 0 || boxH <= 0) return crop;
  const quarter = ((Math.round(rotation / 90) % 4) + 4) % 4;
  const swapped = quarter === 1 || quarter === 3;
  // 0/180（および微調整回転＝quarter 偶数）は box 全体が見えている＝素通し（退行させない・react-image-crop の
  // aspect/bound 制約に委ねる）。clamp は写真が中心正方形に letterbox される 90/270 のときだけ行う。
  if (!swapped) return crop;

  // 見えている領域（px）＝中心の S=min(W,H) 正方形。
  const s = Math.min(boxW, boxH);
  const minX = (boxW - s) / 2;
  const minY = (boxH - s) / 2;

  // px に直して、領域に収まる最大の正方形辺へ詰める。
  const toPxX = (v: number) => (v / 100) * boxW;
  const toPxY = (v: number) => (v / 100) * boxH;
  const reqSide = Math.min(toPxX(crop.width), toPxY(crop.height)); // 正方形なので px は一致するはず
  const side = Math.max(1, Math.min(reqSide, s));

  // 原点を中心正方形の内側へ（右端・下端がはみ出さない）。
  const x = Math.min(Math.max(toPxX(crop.x), minX), minX + s - side);
  const y = Math.min(Math.max(toPxY(crop.y), minY), minY + s - side);

  return { x: (x / boxW) * 100, y: (y / boxH) * 100, width: (side / boxW) * 100, height: (side / boxH) * 100 };
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
  sharpen = 0,
  edgeBlur = 0,
  tone: ToneCurve = null,
  toneAmount = 0.32,
  type = "image/jpeg",
  quality = 0.85,
): Promise<Blob> {
  const naturalW = image.naturalWidth;
  const naturalH = image.naturalHeight;
  const displayW = image.width || naturalW;
  const displayH = image.height || naturalH;
  const scaleX = naturalW / displayW;
  const scaleY = naturalH / displayH;

  const { sx, sy, size } = computeSquareCropRect(crop, scaleX, scaleY, naturalW, naturalH);

  return renderSquareImageFromRect(image, { sx, sy, size }, filterCss, vignette, sharpen, edgeBlur, tone, toneAmount, type, quality);
}

/**
 * 自然座標系の正方形矩形から canvas に焼き込む。
 * 複数画像投稿では、表示中でない画像も Object URL から再ロードして同じ rect で処理する。
 *
 * 出力サイズは長辺 1440px 上限（outputEdge）に縮小する（#167）。クロップ実寸が大きくても
 * out×out（out=min(rect.size, 1440)）の小 canvas に縮小描画し、フィルタもその小 canvas へ掛ける
 * （CPU が軽くなる・相対強度なので見えは維持）。JPEG quality は既定 0.85（nostr.build がどうせ
 * 縮小配信するため。生成と POST を短縮）。出力は引き続き正方形（out×out）＝1:1 保証は不変。
 */
export function renderSquareImageFromRect(
  // 回転（#314）では回転済み canvas を渡せる（drawImage の source・rect は回転後座標系）。
  image: HTMLImageElement | HTMLCanvasElement,
  rect: SquareCropRect,
  filterCss: string | null,
  vignette = 0,
  sharpen = 0,
  edgeBlur = 0,
  tone: ToneCurve = null,
  toneAmount = 0.32,
  type = "image/jpeg",
  quality = 0.85,
): Promise<Blob> {
  // 出力一辺はクロップ実寸を 1440px 上限でクランプ（拡大はしない）。
  const out = outputEdge(rect.size);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return Promise.reject(new Error("2D コンテキストを取得できませんでした"));
  }

  // canvas は呼び出しごとに新規生成するため、filter のリセット（"none" へ戻す）は不要。
  ctx.filter = filterCss ?? "none";
  // ソース矩形（rect.size）を出力一辺（out）へ縮小描画する。
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, out, out);
  // 以降のピクセル処理は縮小後の小 canvas（out）に掛ける（速い・相対強度なので見えは維持）。
  // トーンカーブ（翠露/土香）は CSS filter と同じ tonal 段として、シャープ/ぼかしより前に焼く。
  applyToneCurve(ctx, out, tone, toneAmount);
  applySharpen(ctx, out, sharpen);
  // 影暮（減光）の前に霞幻（周辺ぼかし）を合成する。中央はシャープのまま外周だけ柔らかくし、
  // その上から vignette が外周を暗く締める順にする。
  applyEdgeBlur(ctx, out, edgeBlur);
  drawVignette(ctx, out, vignette);

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

function applySharpen(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  if (amount <= 0 || size < 3) return;
  const strength = Math.min(Math.max(amount, 0), 1);
  const edge = 1.5 * strength;
  const centerWeight = 1 + edge * 4;
  const imageData = ctx.getImageData(0, 0, size, size);
  const src = imageData.data;
  const out = new Uint8ClampedArray(src);

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4;
      const top = ((y - 1) * size + x) * 4;
      const bottom = ((y + 1) * size + x) * 4;
      const left = (y * size + x - 1) * 4;
      const right = (y * size + x + 1) * 4;
      for (let c = 0; c < 3; c++) {
        const center = src[i + c] ?? 0;
        const sharpened =
          center * centerWeight -
          (src[top + c] ?? 0) * edge -
          (src[bottom + c] ?? 0) * edge -
          (src[left + c] ?? 0) * edge -
          (src[right + c] ?? 0) * edge;
        out[i + c] = sharpened;
      }
    }
  }

  ctx.putImageData(new ImageData(out, size, size), 0, 0);
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

/**
 * 周辺ぼかし「霞幻」（#155）。中央はシャープのまま、外周だけを canvas でぼかす。
 *
 * 1. 別 canvas に現 canvas を `filter: blur(r)` で描画してぼかしレイヤーを作る
 *    （blur は端で透明にフェードするため、少し拡大して描き外周フリンジを可視域の外へ逃がす）。
 * 2. `destination-in` ＋ ラジアルグラデ（中心 透明 → 外周 不透明）で**外周リングだけ**を残す。
 * 3. 元 canvas に `source-over` で重ねる → 中央は元のシャープ、外周はぼかしへ滑らかに移行する。
 */
function applyEdgeBlur(ctx: CanvasRenderingContext2D, size: number, amount: number): void {
  if (amount <= 0 || size < 4) return;
  const strength = Math.min(Math.max(amount, 0), 1);
  const radius = Math.max(1, Math.round(size * 0.02 * strength));

  const layer = document.createElement("canvas");
  layer.width = size;
  layer.height = size;
  const lctx = layer.getContext("2d");
  if (lctx === null) return;

  // 1. ぼかしレイヤー。blur 半径ぶん拡大して描き、端のフェードを可視域外へ追い出す。
  const pad = radius * 2;
  lctx.filter = `blur(${radius}px)`;
  lctx.drawImage(ctx.canvas, -pad, -pad, size + pad * 2, size + pad * 2);

  // 2. 外周リングだけ残す（中心は透明にして元のシャープを透けさせる）。
  lctx.filter = "none";
  lctx.globalCompositeOperation = "destination-in";
  const mask = lctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  mask.addColorStop(0, "rgba(0, 0, 0, 0)");
  mask.addColorStop(0.6, "rgba(0, 0, 0, 0.5)");
  mask.addColorStop(1, "rgba(0, 0, 0, 1)");
  lctx.fillStyle = mask;
  lctx.fillRect(0, 0, size, size);

  // 3. 元 canvas に外周ぼかしを重ねる。
  ctx.save();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/**
 * トーンカーブの 256 段 LUT を作る（純関数・テスト可能）。#156。
 *
 * - "s": 暗部を落とし明部を上げる S 字。smoothstep（3x²−2x³）へ寄せ、両端は固定（0→0, 255→255）で
 *   白飛び/黒つぶれを避ける。中点傾き > 1（締まる）。
 * - "reverse-s": 暗部を上げ明部を抑える逆S字。smoothstep の逆関数へ寄せる。中点傾き < 1（やわらぐ）。
 * - null: 恒等。
 *
 * `amount`（0〜1）でカーブの強さを原画と混ぜる。控えめが既定（中点傾きが現 CSS 近似に近い）。
 */
export function buildToneLut(tone: ToneCurve, amount = 0.32): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const a = Math.min(Math.max(amount, 0), 1);
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    let curved = x;
    if (tone === "s") {
      const s = x * x * (3 - 2 * x); // smoothstep(0, 1, x)
      curved = (1 - a) * x + a * s;
    } else if (tone === "reverse-s") {
      // smoothstep の逆関数。暗部を持ち上げ、明部を寝かせる（コントラストを下げる）。
      const u = Math.min(Math.max(1 - 2 * x, -1), 1);
      const inv = 0.5 - Math.sin(Math.asin(u) / 3);
      curved = (1 - a) * x + a * inv;
    }
    lut[i] = Math.round(curved * 255);
  }
  return lut;
}

/**
 * トーンカーブ（翠露=S字／土香=逆S字・#156）を canvas に焼き込む。RGB 各チャンネルへ LUT を当てる
 * （彩度は美華だけが扱う方針なので、ここでは色相を動かさず明暗のカーブだけ）。
 * jsdom では getImageData が動かないため、純関数 buildToneLut のみユニットテストする。
 */
function applyToneCurve(ctx: CanvasRenderingContext2D, size: number, tone: ToneCurve, amount = 0.32): void {
  if (tone === null || size < 1) return;
  const lut = buildToneLut(tone, amount);
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    data[i] = lut[r] ?? r;
    data[i + 1] = lut[g] ?? g;
    data[i + 2] = lut[b] ?? b;
    // alpha（i+3）はそのまま
  }
  ctx.putImageData(imageData, 0, 0);
}
