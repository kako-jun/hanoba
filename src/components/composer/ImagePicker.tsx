// 画像の選択（撮影/アルバム）。動画は受け付けない（DESIGN §1: 静止画のみ）。
//
// スマホで「撮影」と「アルバム」を別ボタンに分ける（#29）。単一 input に
// capture="environment" を付けるとモバイルでカメラ起動が優先され、アルバムから
// 選べなくなるため、capture 付き input（撮影）と capture 無し input（アルバム）を
// 別々に持ち、それぞれボタンから叩く（machigai-salad ImageUpload に倣う）。
//
// accept="image/*" でファイルダイアログから動画を除外し、さらに選択ファイルの type が
// image/ で始まらなければ拒否する（二重の防御）。

import { useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  const cameraLabel = compact ? (
    <span className="flex flex-col leading-none">
      <span>追加で</span>
      <span>撮影</span>
    </span>
  ) : (
    "撮影"
  );
  const galleryLabel = compact ? (
    <span className="flex flex-col leading-none">
      <span>追加で</span>
      <span>選ぶ</span>
    </span>
  ) : (
    "アルバム"
  );

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
    if (files.length > accepted.length) {
      setError("写真は4枚までです。追加できる分だけ追加しました。");
    }
    // 同じファイルを選び直せるよう値をリセット（change が再発火するように）。
    e.target.value = "";
  }

  return (
    <div className={compact ? "flex flex-col items-center gap-2" : "flex flex-col items-center gap-3"}>
      <div className={compact ? "flex flex-col items-stretch gap-1.5" : "flex items-center gap-3"}>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={remaining <= 0}
          className={`flex items-center justify-center gap-2 bg-ha-green text-ha-white font-semibold hover:brightness-110 transition-colors disabled:opacity-40 ${
            compact ? "min-h-8 w-24 rounded-lg px-2 py-1.5 text-[11px]" : "rounded-2xl px-6 py-3"
          }`}
        >
          <Icon name="camera" className={compact ? "h-4 w-4 shrink-0" : "w-5 h-5"} />
          {cameraLabel}
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={remaining <= 0}
          className={`flex items-center justify-center gap-2 glass text-ha-ink font-semibold hover:border-ha-green/50 transition-colors disabled:opacity-40 ${
            compact ? "min-h-8 w-24 rounded-lg px-2 py-1.5 text-[11px]" : "rounded-2xl px-6 py-3"
          }`}
        >
          <Icon name="image" className={compact ? "h-4 w-4 shrink-0" : "w-5 h-5"} />
          {galleryLabel}
        </button>
      </div>
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
      {!compact && (
        <p className="text-xs text-ha-ink/60">
          植物の写真を撮るか、アルバムから選んでください。最大4枚まで。
        </p>
      )}
      {error !== null && <p className="text-sm text-ha-pink font-medium">{error}</p>}
    </div>
  );
}
