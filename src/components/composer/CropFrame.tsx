// 正方形クロップ枠（react-image-crop）。aspect=1 で正方形ロック・ドラッグで位置決め。
// プレビューには選択中フィルタを style={{filter}} でライブ適用する。
//
// 画像 <img> の ref は親（Composer）から受け取り、投稿時の renderSquareImage に使う。

import { useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

interface CropFrameProps {
  /** 選択画像の Object URL。 */
  src: string;
  /** 投稿時に焼き込む <img> 要素を親が掴むための ref。 */
  imgRef: React.RefObject<HTMLImageElement | null>;
  /** プレビューにライブ適用する CSS filter（未選択は null）。 */
  filter: string | null;
  /** クロップ確定（resize/drag 終了）ごとに自然座標ではない表示 px の PixelCrop を親へ。 */
  onCropComplete: (crop: PixelCrop) => void;
}

/** 画像中央に最大の正方形クロップを作る（% 単位）。 */
function centeredSquareCrop(width: number, height: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, width, height), width, height);
}

export default function CropFrame({ src, imgRef, filter, onCropComplete }: CropFrameProps) {
  const [crop, setCrop] = useState<Crop>();

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initial = centeredSquareCrop(width, height);
    setCrop(initial);
    // 初期クロップも親へ反映（ユーザーが触らず投稿しても正方形が確定する）。
    const naturalCrop: PixelCrop = {
      unit: "px",
      x: ((initial.x ?? 0) / 100) * width,
      y: ((initial.y ?? 0) / 100) * height,
      width: ((initial.width ?? 0) / 100) * width,
      height: ((initial.height ?? 0) / 100) * height,
    };
    onCropComplete(naturalCrop);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <ReactCrop
        crop={crop}
        onChange={(pixelCrop) => setCrop(pixelCrop)}
        onComplete={(pixelCrop) => onCropComplete(pixelCrop)}
        aspect={1}
        keepSelection
        className="max-w-full rounded-2xl overflow-hidden"
      >
        <img
          ref={imgRef}
          src={src}
          alt="クロップ対象の写真"
          onLoad={handleImageLoad}
          style={{ filter: filter ?? "none", maxHeight: "60vh", display: "block" }}
        />
      </ReactCrop>
      <p className="text-xs text-ha-ink/60">枠をドラッグして位置を決めてください。</p>
    </div>
  );
}
