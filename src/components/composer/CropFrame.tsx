// 正方形クロップ枠（react-image-crop）。aspect=1 で正方形ロック・ドラッグで位置決め。
// プレビューには選択中フィルタを style={{filter}} でライブ適用する。
//
// 画像 <img> の ref は親（Composer）から受け取り、クロップ確定時の自然座標計算に使う。

import { useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { computeSquareCropRect, type SquareCropRect } from "../../lib/image/crop.ts";

interface CropFrameProps {
  /** 選択画像の Object URL。 */
  src: string;
  /** 投稿時に焼き込む <img> 要素を親が掴むための ref。 */
  imgRef: React.RefObject<HTMLImageElement | null>;
  /** 保存済みの自然座標クロップ。写真を切り替えて戻った時に復元する。 */
  initialCrop?: SquareCropRect | null;
  /** プレビューにライブ適用する CSS filter（未選択は null）。 */
  filter: string | null;
  /** プレビューに重ねる周辺減光の強さ（0〜1）。 */
  vignette?: number;
  /** プレビューに適用するシャープ処理の強さ（0〜1）。 */
  sharpen?: number;
  /** プレビューに重ねる周辺ぼかしの強さ（0〜1）。中央はそのまま、外周だけぼかす。 */
  edgeBlur?: number;
  /** クロップ確定（resize/drag 終了）ごとに自然座標の正方形矩形を親へ。 */
  onCropComplete: (crop: SquareCropRect) => void;
}

/** 画像中央に最大の正方形クロップを作る（% 単位）。 */
function centeredSquareCrop(width: number, height: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, width, height), width, height);
}

export default function CropFrame({
  src,
  imgRef,
  initialCrop,
  filter,
  vignette = 0,
  sharpen = 0,
  edgeBlur = 0,
  onCropComplete,
}: CropFrameProps) {
  const [crop, setCrop] = useState<Crop>();
  // 画像の表示幅（px）。霞幻プレビューの blur 半径を焼き込み（出力の2%）と同じ縮尺で出すため。
  const [renderedW, setRenderedW] = useState(0);
  const sharpenAmount = Math.min(Math.max(sharpen, 0), 1);
  const sharpenEdge = -1.5 * sharpenAmount;
  const sharpenCenter = 1 + 6 * sharpenAmount;
  const previewFilter = [filter, sharpenAmount > 0 ? "url(#hanoba-sharpen-preview)" : null]
    .filter((item): item is string => item !== null && item !== "")
    .join(" ") || "none";

  function commitCrop(pixelCrop: PixelCrop, image: HTMLImageElement | null) {
    if (image === null) return;
    const displayW = image.width || image.naturalWidth;
    const displayH = image.height || image.naturalHeight;
    onCropComplete(
      computeSquareCropRect(
        pixelCrop,
        image.naturalWidth / displayW,
        image.naturalHeight / displayH,
        image.naturalWidth,
        image.naturalHeight,
      ),
    );
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setRenderedW(width);
    const initial =
      initialCrop === undefined || initialCrop === null
        ? centeredSquareCrop(width, height)
        : {
            unit: "%" as const,
            x: (initialCrop.sx / e.currentTarget.naturalWidth) * 100,
            y: (initialCrop.sy / e.currentTarget.naturalHeight) * 100,
            width: (initialCrop.size / e.currentTarget.naturalWidth) * 100,
            height: (initialCrop.size / e.currentTarget.naturalHeight) * 100,
          };
    setCrop(initial);
    // 初期クロップも親へ反映（ユーザーが触らず投稿しても正方形が確定する）。
    const initialPixelCrop: PixelCrop = {
      unit: "px",
      x: ((initial.x ?? 0) / 100) * width,
      y: ((initial.y ?? 0) / 100) * height,
      width: ((initial.width ?? 0) / 100) * width,
      height: ((initial.height ?? 0) / 100) * height,
    };
    commitCrop(initialPixelCrop, e.currentTarget);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {sharpenAmount > 0 && (
        <svg aria-hidden="true" className="absolute h-0 w-0">
          <filter id="hanoba-sharpen-preview" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              preserveAlpha="true"
              kernelMatrix={`0 ${sharpenEdge} 0 ${sharpenEdge} ${sharpenCenter} ${sharpenEdge} 0 ${sharpenEdge} 0`}
            />
          </filter>
        </svg>
      )}
      <ReactCrop
        crop={crop}
        onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
        onComplete={(pixelCrop) => commitCrop(pixelCrop, imgRef.current)}
        aspect={1}
        keepSelection
        className="max-w-full rounded-2xl overflow-hidden"
      >
        <div className="relative">
        <img
          ref={imgRef}
          src={src}
          alt="クロップ対象の写真"
          onLoad={handleImageLoad}
          style={{ filter: previewFilter, maxHeight: "60vh", display: "block" }}
        />
        {edgeBlur > 0 && crop !== undefined && crop.width > 0 && crop.height > 0 && (
          // 焼き込みと同じ「中央シャープ・外周ぼかし」をクロップ枠にクリップして近似する。
          // 枠サイズの clip 内にぼかした複製 <img> を元画像と同じ位置で重ね、ラジアル mask で
          // 外周だけ見せる（中央は透明にして下の元画像が透ける）。
          <div
            aria-hidden="true"
            className="pointer-events-none absolute overflow-hidden"
            style={{
              left: `${crop.x}%`,
              top: `${crop.y}%`,
              width: `${crop.width}%`,
              height: `${crop.height}%`,
              WebkitMaskImage: "radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.55) 62%, #000 80%)",
              maskImage: "radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.55) 62%, #000 80%)",
            }}
          >
            <img
              src={src}
              alt=""
              style={{
                position: "absolute",
                left: `${-(crop.x / crop.width) * 100}%`,
                top: `${-(crop.y / crop.height) * 100}%`,
                width: `${(100 / crop.width) * 100}%`,
                height: "auto",
                maxWidth: "none",
                display: "block",
                // 焼き込みは出力の2%（applyEdgeBlur）。プレビューも表示中のクロップ枠の2%に
                // 合わせ、画像サイズに依らず焼き上がりと同じ強さで見せる。
                filter: [filter, `blur(${(((crop.width / 100) * renderedW) * 0.02 * edgeBlur).toFixed(2)}px)`]
                  .filter((item): item is string => item !== null && item !== "")
                  .join(" "),
              }}
            />
          </div>
        )}
        {vignette > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute"
            style={{
              left: `${crop?.x ?? 0}%`,
              top: `${crop?.y ?? 0}%`,
              width: `${crop?.width ?? 0}%`,
              height: `${crop?.height ?? 0}%`,
              background: `radial-gradient(circle at center, rgba(0,0,0,0) 34%, rgba(0,0,0,${vignette * 0.18}) 68%, rgba(0,0,0,${vignette * 0.72}) 100%)`,
            }}
          />
        )}
        </div>
      </ReactCrop>
      <p className="text-xs text-ha-ink/60">枠をドラッグして位置を決めてください。</p>
    </div>
  );
}
