// 画像の選択（撮影/アルバム）。動画は受け付けない（DESIGN §1: 静止画のみ）。
//
// スマホで「撮影」と「アルバム」を別ボタンに分ける（#29）。単一 input に
// capture="environment" を付けるとモバイルでカメラ起動が優先され、アルバムから
// 選べなくなるため、capture 付き input（撮影）と capture 無し input（アルバム）を
// 別々に持ち、それぞれボタンから叩く（machigai-salad ImageUpload に倣う）。
//
// accept="image/*" でファイルダイアログから動画を除外し、さらに選択ファイルの type が
// image/ で始まらなければ拒否する（二重の防御）。

import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";

interface ImagePickerProps {
  /** 画像ファイルが選択されたとき（image/ 以外は呼ばれない）。 */
  onSelect: (files: File[], rejectedCount?: number) => void;
  /** 追加できる残り枚数。 */
  remaining?: number;
  /** サムネイル列の中に置く省スペース表示。 */
  compact?: boolean;
}

export default function ImagePicker({ onSelect, remaining = 4, compact = false }: ImagePickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const compactWrapRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [compactOpen, setCompactOpen] = useState(false);

  useEffect(() => {
    if (!compact || !compactOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (compactWrapRef.current?.contains(e.target as Node)) return;
      setCompactOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [compact, compactOpen]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    if (files.some((file) => !file.type.startsWith("image/"))) {
      setError("画像ファイルを選んでください（動画は投稿できません）。");
      e.target.value = "";
      return;
    }
    if (remaining <= 0) {
      setError("写真は4枚までです。");
      e.target.value = "";
      return;
    }
    const accepted = files.slice(0, remaining);
    setError(null);
    onSelect(accepted, files.length - accepted.length);
    setCompactOpen(false);
    if (files.length > accepted.length) {
      setError("写真は4枚までです。追加できる分だけ追加しました。");
    }
    // 同じファイルを選び直せるよう値をリセット（change が再発火するように）。
    e.target.value = "";
  }

  const controls = (
    <>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={remaining <= 0}
          className="flex items-center justify-center gap-2 rounded-2xl bg-ha-green px-6 py-3 font-semibold text-ha-white transition-colors hover:brightness-110 disabled:opacity-40"
        >
          <Icon name="camera" className="h-5 w-5" />
          撮影
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={remaining <= 0}
          className="glass flex items-center justify-center gap-2 rounded-2xl px-6 py-3 font-semibold text-ha-ink transition-colors hover:border-ha-green/50 disabled:opacity-40"
        >
          <Icon name="image" className="h-5 w-5" />
          アルバム
        </button>
      </div>
      {!compact && (
        <p className="text-xs text-ha-ink/60">
          植物の写真を撮るか、アルバムから選んでください。最大4枚まで。
        </p>
      )}
    </>
  );

  return (
    <div
      ref={compact ? compactWrapRef : undefined}
      className={compact ? "relative flex flex-col items-start gap-2" : "flex flex-col items-center gap-3"}
    >
      {compact ? (
        <button
          type="button"
          onClick={() => setCompactOpen(true)}
          disabled={remaining <= 0}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border-2 border-dashed border-ha-green/45 bg-ha-white/25 text-ha-green-deep transition-colors hover:border-ha-green hover:bg-ha-white/40 disabled:opacity-40"
          aria-label="写真を追加"
        >
          <Icon name="plus" className="h-5 w-5" />
        </button>
      ) : (
        controls
      )}
      {compact && compactOpen && (
        <div
          className="glass-strong absolute left-0 top-full z-50 mt-2 flex w-52 flex-col gap-2 rounded-2xl p-2 shadow-2xl"
          role="dialog"
          aria-label="写真を追加"
        >
          <button
            type="button"
            onClick={() => setCompactOpen(false)}
            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full text-ha-white/70 transition-colors hover:bg-ha-white/15"
            aria-label="閉じる"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
          <div className="flex flex-col gap-2 pt-7">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={remaining <= 0}
              className="flex items-center justify-center gap-2 rounded-2xl bg-ha-green px-5 py-3 font-semibold text-ha-white transition-colors hover:brightness-110 disabled:opacity-40"
            >
              <Icon name="camera" className="h-5 w-5" />
              撮影
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              disabled={remaining <= 0}
              className="flex items-center justify-center gap-2 rounded-2xl border border-ha-green/45 bg-ha-base px-5 py-3 font-semibold text-ha-green-deep shadow-sm transition-colors hover:border-ha-green/80 disabled:opacity-40"
            >
              <Icon name="image" className="h-5 w-5" />
              アルバム
            </button>
          </div>
        </div>
      )}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
        aria-label="カメラで撮影"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="sr-only"
        aria-label="アルバムから選ぶ"
      />
      {error !== null && <p className="text-sm text-ha-pink font-medium">{error}</p>}
    </div>
  );
}
