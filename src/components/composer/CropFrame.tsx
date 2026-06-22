// 正方形クロップ枠（react-image-crop）。aspect=1 で正方形ロック・ドラッグで位置決め。
// プレビューには選択中フィルタを style={{filter}} でライブ適用する。
//
// 画像 <img> の ref は親（Composer）から受け取り、クロップ確定時の自然座標計算に使う。

import { useEffect, useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { MAX_FINE_ROTATION, clampCropToVisible, computeSquareCropRect, rotationFine, type SquareCropRect, type ToneCurve } from "../../lib/image/crop.ts";
import { toneCurvePreviewCss } from "../../lib/image/presets.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

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
  /** トーンカーブ（翠露=S字/土香=逆S字）。焼き込みは canvas、プレビューは contrast() で近似。 */
  toneCurve?: ToneCurve;
  /** トーンカーブの効き具合（#171・弱/中/強）。プレビューの contrast 近似に反映する。 */
  toneAmount?: number;
  /**
   * クロップ確定（resize/drag 終了）ごとに自然座標の正方形矩形を親へ。
   * fromUser=true はユーザーのドラッグ/リサイズ操作由来（#393・1手アンドゥ対象）、
   * false は画像ロード時の初期 commit・90度成分(quarter)変更の clamp 再 commit などプログラム由来（アンドゥ対象外）。
   */
  onCropComplete: (crop: SquareCropRect, fromUser: boolean) => void;
  /** 現在の総回転角（度・#314）。プレビューは CSS `transform: rotate()` で即時に当てる。 */
  rotation?: number;
  /** 回転角を更新する（絶対値・#314）。指定時だけ回転コントロールを出す。 */
  onRotate?: (nextRotation: number) => void;
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
  toneCurve = null,
  toneAmount = 0.32,
  onCropComplete,
  rotation = 0,
  onRotate,
}: CropFrameProps) {
  const t = useT(useLocale());
  const [crop, setCrop] = useState<Crop>();
  // 画像の表示幅（px）。霞幻プレビューの blur 半径を焼き込み（出力の2%）と同じ縮尺で出すため。
  const [renderedW, setRenderedW] = useState(0);
  // 表示高さ（px・#348）。90/270 回転後にクロップを見えている写真領域へ clamp する基準に使う。
  const [renderedH, setRenderedH] = useState(0);

  // 表示中の img box（回転前）の px 寸法。resize に追従するため imgRef を優先し、未測定時は load 時の値。
  const boxDims = () => ({ w: imgRef.current?.width || renderedW, h: imgRef.current?.height || renderedH });
  // % クロップを box px の正方形 PixelCrop へ。clamp 後の commit に使う。
  const toPixelCrop = (c: { x: number; y: number; width: number; height: number }, w: number, h: number): PixelCrop => ({
    unit: "px",
    x: (c.x / 100) * w,
    y: (c.y / 100) * h,
    width: (c.width / 100) * w,
    height: (c.height / 100) * h,
  });
  const sharpenAmount = Math.min(Math.max(sharpen, 0), 1);
  const sharpenEdge = -1.5 * sharpenAmount;
  const sharpenCenter = 1 + 6 * sharpenAmount;
  // トーンカーブ（翠露/土香）は焼き込みが canvas LUT、プレビューは従来どおり contrast() で近似する。
  const previewFilter = [filter, toneCurvePreviewCss(toneCurve, toneAmount), sharpenAmount > 0 ? "url(#hanoba-sharpen-preview)" : null]
    .filter((item): item is string => item !== null && item !== "")
    .join(" ") || "none";

  // fromUser=true はユーザーのドラッグ/リサイズ終了由来（#393・1手アンドゥ対象）。初期 commit・quarter clamp は false。
  function commitCrop(pixelCrop: PixelCrop, image: HTMLImageElement | null, fromUser: boolean) {
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
      fromUser,
    );
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setRenderedW(width);
    setRenderedH(height);
    const base =
      initialCrop === undefined || initialCrop === null
        ? centeredSquareCrop(width, height)
        : {
            unit: "%" as const,
            x: (initialCrop.sx / e.currentTarget.naturalWidth) * 100,
            y: (initialCrop.sy / e.currentTarget.naturalHeight) * 100,
            width: (initialCrop.size / e.currentTarget.naturalWidth) * 100,
            height: (initialCrop.size / e.currentTarget.naturalHeight) * 100,
          };
    // 復元時に回転が付いている（restored draft 等）と初期クロップが見えている領域外になりうるので clamp（#348）。
    const initial = { unit: "%" as const, ...clampCropToVisible(base, rotation, width, height) };
    setCrop(initial);
    // 初期クロップも親へ反映（ユーザーが触らず投稿しても正方形が確定する）。プログラム由来＝fromUser=false（#393・アンドゥ対象外）。
    commitCrop(toPixelCrop(initial, width, height), e.currentTarget, false);
  }

  // #348: 90度成分（quarter）が変わったら、既存クロップを新しい見えている領域へ収め直して commit する
  // （例: 横長で広く取った枠は 90度回転で中心正方形を超えるので縮めて中へ寄せる）。微調整回転は quarter が
  // 変わらないので走らない＝0/180・微調整を退行させない。
  const quarter = ((Math.round(rotation / 90) % 4) + 4) % 4;
  useEffect(() => {
    if (crop === undefined) return;
    const { w, h } = boxDims();
    if (w === 0 || h === 0) return;
    const clamped = clampCropToVisible(crop, rotation, w, h);
    setCrop({ unit: "%", ...clamped });
    // 回転(quarter)の副作用＝fromUser=false（#393）。回転自体は別途 onRotate が1手アンドゥ対象なので、ここで crop を別に積まない。
    commitCrop(toPixelCrop(clamped, w, h), imgRef.current, false);
    // quarter が変わった時だけ走らせる（crop/rotation の都度ではない＝微調整ティックで commit を連発しない）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarter]);

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
        // #348: 90/270 回転後は写真が中心正方形に letterbox されるので、ドラッグ中も見えている領域へ clamp
        // （空き帯=写真外へ枠を出さない）。0/180・微調整回転は clampCropToVisible が素通し（退行なし）。
        onChange={(_pixelCrop, percentCrop) => {
          const { w, h } = boxDims();
          setCrop({ unit: "%", ...clampCropToVisible(percentCrop, rotation, w, h) });
        }}
        onComplete={(_pixelCrop, percentCrop) => {
          const { w, h } = boxDims();
          const clamped = clampCropToVisible(percentCrop, rotation, w, h);
          // ユーザーのドラッグ/リサイズ終了＝fromUser=true（#393・本命の1手アンドゥ対象）。
          commitCrop(toPixelCrop(clamped, w, h), imgRef.current, true);
        }}
        aspect={1}
        keepSelection
        className="max-w-full rounded-2xl overflow-hidden"
      >
        <div className="relative">
        <img
          ref={imgRef}
          src={src}
          alt={t("crop.image.alt")}
          onLoad={handleImageLoad}
          // 回転は CSS transform で即時プレビュー（#314・mypace 方式・blob 再生成の遅延なし）。
          // クロップ枠は元画像の box（軸整列）に引かれ、焼き込みは renderInPlaceRotation で同じ見えを再現する。
          style={{ filter: previewFilter, maxHeight: "60vh", display: "block", transform: rotation !== 0 ? `rotate(${rotation}deg)` : undefined }}
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
                // 合わせ、画像サイズに依らず焼き上がりと同じ強さで見せる。トーン（翠露/土香）も
                // 重ねて、外周リングが中央と同じ明暗になるようにする。
                filter: [filter, toneCurvePreviewCss(toneCurve, toneAmount), `blur(${(((crop.width / 100) * renderedW) * 0.02 * edgeBlur).toFixed(2)}px)`]
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
      {/* 角度回転（#314・mypace 方式）。配置: [左90°][−0.5°][===微調整スライダ===][+0.5°][右90°]。
          90度ボタンは向き直し、スライダ＋0.5刻みボタンは水平出し。プレビューは即時の CSS transform。 */}
      {onRotate !== undefined &&
        (() => {
          const quarter = Math.round(rotation / 90) * 90; // 最寄りの90度成分（ボタンが担う向き）
          const fine = rotationFine(rotation); // 微調整成分（±MAX）
          const clampFine = (v: number) => Math.max(-MAX_FINE_ROTATION, Math.min(MAX_FINE_ROTATION, v));
          const setFine = (v: number) => onRotate(quarter + clampFine(v));
          const stepBtn = "glass grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors";
          const quarterBtn = "glass inline-flex min-h-9 shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-medium text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors";
          return (
            <div className="flex w-full max-w-full flex-col gap-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-xs text-ha-ink/45">{t("crop.rotate.label")}</span>
                <span className="text-xs tabular-nums text-ha-ink/55">{fine.toFixed(1)}°</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => onRotate(rotation - 90)} aria-label={t("crop.rotate.left90.aria")} className={quarterBtn}>
                  {t("crop.rotate.left90")}
                </button>
                <button type="button" onClick={() => setFine(fine - 0.5)} aria-label={t("crop.rotate.fineLeft.aria")} className={stepBtn}>
                  −
                </button>
                <input
                  type="range"
                  min={-MAX_FINE_ROTATION}
                  max={MAX_FINE_ROTATION}
                  step={0.5}
                  value={fine}
                  onChange={(e) => setFine(Number(e.target.value))}
                  aria-label={t("crop.rotate.slider.aria")}
                  className="h-9 min-w-0 flex-1 accent-ha-green"
                />
                <button type="button" onClick={() => setFine(fine + 0.5)} aria-label={t("crop.rotate.fineRight.aria")} className={stepBtn}>
                  ＋
                </button>
                <button type="button" onClick={() => onRotate(rotation + 90)} aria-label={t("crop.rotate.right90.aria")} className={quarterBtn}>
                  {t("crop.rotate.right90")}
                </button>
              </div>
            </div>
          );
        })()}
      <p className="text-xs text-ha-ink/60">{t("crop.dragHint")}</p>
    </div>
  );
}
