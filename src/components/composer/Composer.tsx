// 投稿コンポーザー（オーケストレータ）: 画像選択 → クロップ → フィルタ → 一言 → 投稿。
//
// 一言必須は 2 層で担保する:
//   - UI: 送信ボタンを !caption.trim() || !hasImage || posting で disabled
//   - ロジック: buildNoteTemplate（signAndPublishNote 内）が空一言を throw
// 出力 1:1 は renderSquareImageFromRect（canvas.width=height=size）で構造的に保証。

import { useEffect, useRef, useState } from "react";
import { renderSquareImageFromRect, type SquareCropRect } from "../../lib/image/crop.ts";
import { insertTag } from "../../lib/image/hashtag-complete.ts";
import { composeFilterCss, composeSharpen, composeVignette, type FilterPreset } from "../../lib/image/presets.ts";
import type { RankedTag } from "../../lib/feed/popular.ts";
import { fetchKnownHashtags, fetchPopularHashtags, signAndPublishNote } from "../../lib/nostr/client.ts";
import { deleteImage, uploadImage } from "../../lib/nostr/upload.ts";
import AccountName from "../account/AccountName.tsx";
import CaptionInput from "./CaptionInput.tsx";
import CropFrame from "./CropFrame.tsx";
import FilterChips from "./FilterChips.tsx";
import ImagePicker from "./ImagePicker.tsx";
import PlantSuggest from "./PlantSuggest.tsx";
import TagPicker from "./TagPicker.tsx";

type Status = { kind: "idle" } | { kind: "posting" } | { kind: "done" } | { kind: "error"; message: string };
type DraftImage = {
  id: string;
  file: File;
  src: string;
  crop: SquareCropRect | null;
  filters: FilterPreset[];
};

const MAX_IMAGES = 4;

function makeDraftImage(file: File): DraftImage {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return { id, file, src: URL.createObjectURL(file), crop: null, filters: [] };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = src;
  });
}

function centeredSquareRect(image: HTMLImageElement): SquareCropRect {
  const size = Math.max(1, Math.round(Math.min(image.naturalWidth, image.naturalHeight) * 0.9));
  return {
    sx: Math.round((image.naturalWidth - size) / 2),
    sy: Math.round((image.naturalHeight - size) / 2),
    size,
  };
}

export default function Composer() {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [pool, setPool] = useState<string[]>([]);
  const [popular, setPopular] = useState<RankedTag[]>([]);
  // ユーザー名（#28）。AccountName が表示・保存を担い、現在名だけ受け取って投稿ゲートに使う。
  const [name, setName] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const imagesRef = useRef<DraftImage[]>([]);

  // マウント時に過去タグ（補完プール）と人気タグ（ピッカー）を取得（失敗は空のまま）。
  useEffect(() => {
    let alive = true;
    fetchKnownHashtags()
      .then((tags) => {
        if (alive) setPool(tags);
      })
      .catch(() => {});
    fetchPopularHashtags()
      .then((tags) => {
        if (alive) setPopular(tags);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 選択画像の Object URL をアンマウント時に revoke。
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) URL.revokeObjectURL(image.src);
    };
  }, []);

  function handleSelectImages(picked: File[], rejectedCount = 0) {
    if (picked.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const nextImages = picked.slice(0, remaining).map(makeDraftImage);
    if (nextImages.length === 0) return;
    setImageNotice(rejectedCount > 0 ? "写真は4枚までです。追加できる分だけ追加しました。" : null);
    setImages((prev) => [...prev, ...nextImages]);
    if (currentId === null) setCurrentId(nextImages[0]!.id);
    for (const draft of nextImages) {
      void loadImage(draft.src).then((image) => {
        const crop = centeredSquareRect(image);
        setImages((prev) =>
          prev.map((item) => (item.id === draft.id && item.crop === null ? { ...item, crop } : item)),
        );
      });
    }
    setStatus({ kind: "idle" });
  }

  function updateCurrentImage(patch: Partial<Pick<DraftImage, "crop" | "filters">>) {
    if (currentId === null) return;
    setImages((prev) => prev.map((image) => (image.id === currentId ? { ...image, ...patch } : image)));
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const removed = prev.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.src);
      const next = prev.filter((image) => image.id !== id);
      if (currentId === id) setCurrentId(next[0]?.id ?? null);
      return next;
    });
    setStatus({ kind: "idle" });
    setImageNotice(null);
  }

  function resetAll() {
    for (const image of images) URL.revokeObjectURL(image.src);
    setImages([]);
    setCurrentId(null);
    setCaption("");
    setImageNotice(null);
  }

  const currentImage = images.find((image) => image.id === currentId) ?? images[0] ?? null;
  const hasImage = images.length > 0;
  const posting = status.kind === "posting";
  // 名前必須（#28）＝「ユーザー名を入れたら投稿できる」。設定は AccountName 側で完了済み。
  const hasName = name !== null && name.trim() !== "";
  const allCropsReady = images.length > 0 && images.every((image) => image.crop !== null);
  const canSubmit = caption.trim() !== "" && hasImage && hasName && allCropsReady && !posting;

  // 投稿ボタンが押せない理由（不足条件）。ボタン近くに出して「なぜ押せない？」を消す。
  const missing: string[] = [];
  if (!hasName) missing.push("ユーザー名");
  if (!hasImage) missing.push("写真");
  if (caption.trim() === "") missing.push("ひとこと");
  if (hasImage && !allCropsReady) missing.push("写真の枠");

  async function handleSubmit() {
    if (!canSubmit) return;
    if (!allCropsReady) {
      setStatus({ kind: "error", message: "クロップ範囲が未確定です。枠を調整してください。" });
      return;
    }
    setStatus({ kind: "posting" });
    const uploadedUrls: string[] = [];
    try {
      for (const [index, draft] of images.entries()) {
        if (draft.crop === null) throw new Error("クロップ範囲が未確定です。枠を調整してください。");
        const image = await loadImage(draft.src);
        const blob = await renderSquareImageFromRect(
          image,
          draft.crop,
          composeFilterCss(draft.filters),
          composeVignette(draft.filters),
          composeSharpen(draft.filters),
        );
        const squareFile = new File([blob], `hanoba-${index + 1}.jpg`, { type: "image/jpeg" });
        const { url } = await uploadImage(squareFile);
        uploadedUrls.push(url);
      }
      await signAndPublishNote({ caption, imageUrls: uploadedUrls });
      resetAll();
      setStatus({ kind: "done" });
      // 投稿直後は「自分の植物」へ遷移し、増えた1枚を一番上に見せる（時系列降順）。
      if (typeof window !== "undefined") window.location.href = "/me";
    } catch (err) {
      await Promise.allSettled(uploadedUrls.map((url) => deleteImage(url)));
      const message = err instanceof Error ? err.message : "投稿に失敗しました。";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <AccountName onChange={setName} promptLabel="はじめまして。ハンドルネームは？" />

      {!hasImage ? (
        <div className="py-6">
          <ImagePicker onSelect={handleSelectImages} remaining={MAX_IMAGES} />
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-ha-green-deep">写真</h2>
              <span className="text-xs text-ha-ink/55">{images.length}/{MAX_IMAGES}枚</span>
            </div>
            {imageNotice !== null && <p className="text-xs font-medium text-ha-pink">{imageNotice}</p>}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => setCurrentId(image.id)}
                  aria-pressed={image.id === currentImage?.id}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                    image.id === currentImage?.id ? "border-ha-green" : "border-ha-white/40"
                  }`}
                >
                  <img src={image.src} alt={`${index + 1}枚目`} className="h-full w-full object-cover" />
                  {image.crop === null && (
                    <span className="absolute inset-x-0 bottom-0 bg-ha-pink/85 py-0.5 text-[10px] font-semibold text-ha-white">
                      未設定
                    </span>
                  )}
                </button>
              ))}
              {images.length < MAX_IMAGES && (
                <div className="shrink-0 self-start">
                  <ImagePicker onSelect={handleSelectImages} remaining={MAX_IMAGES - images.length} compact />
                </div>
              )}
            </div>
          </section>

          {currentImage !== null && (
            <CropFrame
              key={currentImage.id}
              src={currentImage.src}
              imgRef={imgRef}
              initialCrop={currentImage.crop}
              filter={composeFilterCss(currentImage.filters)}
              vignette={composeVignette(currentImage.filters)}
              onCropComplete={(crop) => updateCurrentImage({ crop })}
            />
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ha-green-deep">フィルタ</h2>
            <FilterChips
              selected={currentImage?.filters ?? []}
              onChange={(filters) => updateCurrentImage({ filters })}
            />
          </section>

          <CaptionInput value={caption} onChange={setCaption} pool={pool} />

          {/* 書いた俗称/略を正規形タグで揃える（#23 Phase2）。 */}
          <PlantSuggest caption={caption} onAddTag={(tag) => setCaption((c) => insertTag(c, tag))} />

          {/* タグは手打ちせず選んで入れる（#22）。本文に #タグ テキストとして挿入される。 */}
          <TagPicker popular={popular} onPick={(tag) => setCaption((c) => insertTag(c, tag))} />

          {/* なぜ押せないかを明示（不足条件）。posting 中は出さない。 */}
          {!posting && missing.length > 0 && (
            <p className="text-right text-xs text-ha-ink/55">
              あと <span className="text-ha-pink font-medium">{missing.join("と")}</span>{" "}
              を入れると投稿できます
            </p>
          )}

          {/* 主アクション（投稿する）を右端に・グループは右寄せ（基本動線）。
              副アクション（選び直す）は左、主アクションは右。 */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => (images.length > 1 && currentImage ? removeImage(currentImage.id) : resetAll())}
              disabled={posting}
              className="glass rounded-full text-ha-ink px-4 py-3 hover:border-ha-green/50 disabled:opacity-40 transition-colors"
            >
              {images.length > 1 ? "この写真を外す" : "写真を選び直す"}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-full bg-ha-pink text-ha-white px-6 py-3 font-semibold shadow-sm shadow-ha-pink/30 enabled:hover:opacity-90 enabled:hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posting ? "投稿中…" : "投稿する"}
            </button>
          </div>
        </>
      )}

      {status.kind === "done" && (
        <p role="status" className="glass rounded-2xl text-ha-ink px-4 py-3 text-sm">
          投稿しました。あなたの植物へ移動します…
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="glass rounded-2xl text-ha-pink px-4 py-3 text-sm">
          {status.message}
        </p>
      )}
    </div>
  );
}
