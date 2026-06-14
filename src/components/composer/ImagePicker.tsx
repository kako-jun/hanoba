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
  onSelect: (file: File) => void;
}

export default function ImagePicker({ onSelect }: ImagePickerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
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
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex items-center gap-2 rounded-2xl bg-ha-green text-ha-white px-6 py-3 font-semibold hover:brightness-110 transition-colors"
        >
          <Icon name="camera" className="w-5 h-5" />
          撮影
        </button>
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex items-center gap-2 glass rounded-2xl text-ha-ink px-6 py-3 font-semibold hover:border-ha-green/50 transition-colors"
        >
          <Icon name="image" className="w-5 h-5" />
          アルバム
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
        onChange={handleChange}
        className="sr-only"
        aria-label="アルバムから選ぶ"
      />
      <p className="text-xs text-ha-ink/60">植物の写真を撮るか、アルバムから選んでください。</p>
      {error !== null && <p className="text-sm text-ha-pink font-medium">{error}</p>}
    </div>
  );
}
