// 画像の選択（カメラ/ライブラリ）。動画は受け付けない（DESIGN §1: 静止画のみ）。
//
// accept="image/*" でファイルダイアログから動画を除外し、さらに選択ファイルの type が
// image/ で始まらなければ拒否する（二重の防御）。

import { useId, useRef, useState } from "react";

interface ImagePickerProps {
  /** 画像ファイルが選択されたとき（image/ 以外は呼ばれない）。 */
  onSelect: (file: File) => void;
}

export default function ImagePicker({ onSelect }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選んでください（動画は投稿できません）。");
      e.target.value = "";
      return;
    }
    setError(null);
    onSelect(file);
    // 同じファイルを選び直せるよう値をリセット（change が再発火するように）。
    e.target.value = "";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <label
        htmlFor={inputId}
        className="cursor-pointer rounded-2xl bg-ha-green text-ha-white px-6 py-3 font-semibold hover:bg-ha-green-deep transition-colors"
      >
        写真を選ぶ
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="sr-only"
      />
      <p className="text-xs text-ha-ink/60">植物の写真を撮るか、ライブラリから選んでください。</p>
      {error !== null && <p className="text-sm text-ha-pink font-medium">{error}</p>}
    </div>
  );
}
