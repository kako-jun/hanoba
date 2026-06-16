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
  /** クロップ確定（resize/drag 終了）ごとに自然座標の正方形矩形を親へ。 */
  onCropComplete: (crop: SquareCropRect) => void;
}

/** 画像中央に最大の正方形クロップを作る（% 単位）。 */
function centeredSquareCrop(width: number, height: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, width, height), width, height);
}

export default function CropFrame({ src, imgRef, initialCrop, filter, vignette = 0, onCropComplete }: CropFrameProps) {
  const [crop, setCrop] = useState<Crop>();

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
          style={{ filter: filter ?? "none", maxHeight: "60vh", display: "block" }}
        />
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
