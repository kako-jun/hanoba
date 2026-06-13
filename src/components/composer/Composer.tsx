// 投稿コンポーザー（オーケストレータ）: 画像選択 → クロップ → フィルタ → 一言 → 投稿。
//
// 一言必須は 2 層で担保する:
//   - UI: 送信ボタンを !caption.trim() || !hasImage || posting で disabled
//   - ロジック: buildNoteTemplate（signAndPublishNote 内）が空一言を throw
// 出力 1:1 は renderSquareImage（canvas.width=height=size）で構造的に保証。

import { useEffect, useRef, useState } from "react";
import type { PixelCrop } from "react-image-crop";
import { renderSquareImage } from "../../lib/image/crop.ts";
import type { FilterPreset } from "../../lib/image/presets.ts";
import { fetchKnownHashtags, signAndPublishNote } from "../../lib/nostr/client.ts";
import { uploadImage } from "../../lib/nostr/upload.ts";
import CaptionInput from "./CaptionInput.tsx";
import CropFrame from "./CropFrame.tsx";
import FilterChips from "./FilterChips.tsx";
import ImagePicker from "./ImagePicker.tsx";

type Status = { kind: "idle" } | { kind: "posting" } | { kind: "done" } | { kind: "error"; message: string };

export default function Composer() {
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<PixelCrop | null>(null);
  const [filter, setFilter] = useState<FilterPreset | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pool, setPool] = useState<string[]>([]);

  const imgRef = useRef<HTMLImageElement>(null);

  // マウント時に過去タグを取得（失敗は空のまま＝補完が出ないだけ）。
  useEffect(() => {
    let alive = true;
    fetchKnownHashtags()
      .then((tags) => {
        if (alive) setPool(tags);
      })
      .catch(() => {
        // fetchKnownHashtags は内部で握り潰すが、念のため。
      });
    return () => {
      alive = false;
    };
  }, []);

  // 選択画像の Object URL を管理（差し替え・アンマウントで revoke）。
  useEffect(() => {
    if (file === null) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleSelectImage(picked: File) {
    setFile(picked);
    setCrop(null);
    setStatus({ kind: "idle" });
  }

  function resetAll() {
    setFile(null);
    setCrop(null);
    setFilter(null);
    setCaption("");
  }

  const hasImage = src !== null;
  const posting = status.kind === "posting";
  const canSubmit = caption.trim() !== "" && hasImage && !posting;

  async function handleSubmit() {
    if (!canSubmit) return;
    const image = imgRef.current;
    if (image === null || crop === null) {
      setStatus({ kind: "error", message: "クロップ範囲が未確定です。枠を調整してください。" });
      return;
    }
    setStatus({ kind: "posting" });
    try {
      const blob = await renderSquareImage(image, crop, filter?.filter ?? null);
      const squareFile = new File([blob], "hanoba.jpg", { type: "image/jpeg" });
      const { url } = await uploadImage(squareFile);
      await signAndPublishNote({ caption, imageUrls: [url] });
      resetAll();
      setStatus({ kind: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "投稿に失敗しました。";
      setStatus({ kind: "error", message });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!hasImage ? (
        <div className="rounded-2xl border border-dashed border-ha-green/40 bg-ha-green-soft/40 py-10">
          <ImagePicker onSelect={handleSelectImage} />
        </div>
      ) : (
        <>
          <CropFrame
            src={src}
            imgRef={imgRef}
            filter={filter?.filter ?? null}
            onCropComplete={setCrop}
          />

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-ha-green-deep">フィルタ</h2>
            <FilterChips selected={filter} onSelect={setFilter} />
          </section>

          <CaptionInput value={caption} onChange={setCaption} pool={pool} />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-2xl bg-ha-pink text-ha-white px-6 py-3 font-semibold enabled:hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posting ? "投稿中…" : "投稿する"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              disabled={posting}
              className="rounded-2xl bg-ha-white text-ha-ink border border-ha-ink/15 px-4 py-3 hover:border-ha-green disabled:opacity-40"
            >
              写真を選び直す
            </button>
          </div>
        </>
      )}

      {status.kind === "done" && (
        <p role="status" className="rounded-2xl bg-ha-green-soft text-ha-green-deep px-4 py-3 text-sm">
          投稿しました。mypace でも見られます。
        </p>
      )}
      {status.kind === "error" && (
        <p role="alert" className="rounded-2xl bg-ha-pink-soft text-ha-ink px-4 py-3 text-sm">
          {status.message}
        </p>
      )}
    </div>
  );
}
