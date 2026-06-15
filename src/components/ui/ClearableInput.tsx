// 右端（input）/右上（textarea）に × クリアボタンを備えた共通入力（#98 フォローアップ）。
// AccountName の name 入力・DiscoverGrid の検索欄に各々あった「アドホックな ×」を1箇所に集約し、
// nsec・プロフィール URL/サイト・自己紹介/ひとこと まで横断で同じ操作感に揃える。
//
// 使い方:
//   <ClearableInput value={v} onValueChange={setV} aria-label="…" placeholder="…" className="rounded-full …" />
//   <ClearableTextarea value={v} onValueChange={setV} rows={3} className="rounded-2xl … resize-y" />
//
// className には見た目（角丸・余白 pl-*/py-*・bg/border/focus）だけを渡す。`w-full` と
// 右側の余白（pr-10）は ×ボタンの座席として本コンポーネントが必ず付ける（呼び出し側で重ねない）。

import { useRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Icon from "./Icon.tsx";

// value/onChange/className は本コンポーネントが制御するので、ネイティブ属性からは除いて渡してもらう。
type InputRest = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">;
type TextareaRest = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "className">;

interface ClearableInputProps extends InputRest {
  value: string;
  onValueChange: (v: string) => void;
  /** ×ボタンの aria-label（既定「入力をクリア」）。 */
  clearLabel?: string;
  /** 見た目のクラス（角丸・余白・bg/border/focus 等）。w-full / pr-10 は不要。 */
  className?: string;
}

interface ClearableTextareaProps extends TextareaRest {
  value: string;
  onValueChange: (v: string) => void;
  clearLabel?: string;
  className?: string;
}

// ×ボタン本体（input は縦中央、textarea は上寄せ）。値が空のときは描かない。
function ClearButton({
  clearLabel,
  position,
  onClear,
}: {
  clearLabel: string;
  position: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={clearLabel}
      className={`absolute right-2.5 ${position} grid place-items-center w-7 h-7 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors`}
    >
      <Icon name="close" className="w-4 h-4" />
    </button>
  );
}

/** ×を右端中央に置く単行入力。 */
export function ClearableInput({
  value,
  onValueChange,
  clearLabel = "入力をクリア",
  className = "",
  ...rest
}: ClearableInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <input
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={`w-full pr-10 ${className}`}
        {...rest}
      />
      {value !== "" && (
        <ClearButton
          clearLabel={clearLabel}
          position="top-1/2 -translate-y-1/2"
          onClear={() => {
            onValueChange("");
            ref.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/** ×を右上に置く複数行入力。 */
export function ClearableTextarea({
  value,
  onValueChange,
  clearLabel = "入力をクリア",
  className = "",
  ...rest
}: ClearableTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className={`w-full pr-10 ${className}`}
        {...rest}
      />
      {value !== "" && (
        <ClearButton
          clearLabel={clearLabel}
          position="top-2.5"
          onClear={() => {
            onValueChange("");
            ref.current?.focus();
          }}
        />
      )}
    </div>
  );
}
