// 高さ調整つき glass textarea（#188）。ひとこと入力欄（CaptionInput）と自己紹介欄（ProfileEditor）が
// 同じ見た目・同じ操作感（glass・×クリア・下辺ドラッグバーで高さ調整・矢印キーでも調整）を共有するための
// 共通部品。CaptionInput のハッシュタグ補完は一言専用なので本部品には含めず、CaptionInput 側で
// textareaRef・onKeyDown・children（候補ポップアップ）を渡して載せる。
//
// 使い方:
//   <ResizableTextarea id="hanoba-about" label="自己紹介" value={v} onValueChange={setV} placeholder="…" />
//   // ↑ label を渡すと内蔵 <label> で id と紐付ける（CaptionInput も label="ひとこと" を内蔵で渡す）。
//   //   label を省くなら aria-label 等の a11y 名をネイティブ属性（{...rest}）で渡すこと。
//
// 高さは本部品が state で持つ。初期/最小/最大/キーボードのステップは props で上書きできる
// （既定は CaptionInput 由来の 124/104/360/16）。クランプ計算は clampHeight に切り出してある。

import {
  forwardRef,
  useRef,
  useState,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import Icon from "./Icon.tsx";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/** 高さを [min, max] にクランプする純関数（テスト容易化のため切り出し・#188）。 */
export function clampHeight(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// value/onChange/className/style/ref は本部品が制御するのでネイティブ属性から除く。
type TextareaRest = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange" | "className" | "style"
>;

interface ResizableTextareaProps extends TextareaRest {
  value: string;
  onValueChange: (v: string) => void;
  /** ラベルを内蔵する場合の文言。id と組で <label htmlFor> を描く。CaptionInput のように外で持つなら省略。 */
  label?: string;
  /** ×ボタンの aria-label（既定「入力をクリア」）。 */
  clearLabel?: string;
  /** 初期高さ（px）。既定 124。 */
  initialHeight?: number;
  /** 最小高さ（px）。既定 104。 */
  minHeight?: number;
  /** 最大高さ（px）。既定 360。 */
  maxHeight?: number;
  /** 矢印キー1回の増減（px）。既定 16。 */
  step?: number;
  /** 見た目の追加クラス（角丸・余白等を上書き・追加したいとき）。 */
  textareaClassName?: string;
  /** textarea と兄弟で relative ラッパ内に描く要素（CaptionInput の補完ポップアップ等）。 */
  children?: ReactNode;
}

/**
 * 高さ調整つき glass textarea。ref は内部 textarea へ転送する（CaptionInput がキャレット制御に使う）。
 */
const ResizableTextarea = forwardRef<HTMLTextAreaElement, ResizableTextareaProps>(function ResizableTextarea(
  {
    value,
    onValueChange,
    label,
    clearLabel,
    initialHeight = 124,
    minHeight = 104,
    maxHeight = 360,
    step = 16,
    textareaClassName = "",
    children,
    id,
    ...rest
  },
  ref,
) {
  const t = useT(useLocale());
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const [height, setHeight] = useState(initialHeight);

  // 外から渡された ref と内部 ref の両方へ設定する（×フォーカス用に内部参照が要る）。
  function setRefs(node: HTMLTextAreaElement | null) {
    innerRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref !== null) ref.current = node;
  }

  function resize(nextHeight: number) {
    setHeight(clampHeight(nextHeight, minHeight, maxHeight));
  }

  return (
    <div className="relative flex flex-col gap-1">
      {label !== undefined && (
        <label htmlFor={id} className="text-sm font-medium text-ha-green-deep">
          {label}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={setRefs}
          id={id}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={`w-full glass resize-none rounded-2xl px-3.5 py-2.5 pb-9 pr-10 text-ha-ink placeholder:text-ha-ink/45 focus:border-ha-green/60 focus:outline-none focus:ring-2 focus:ring-ha-green/30 ${textareaClassName}`}
          style={{ height }}
          {...rest}
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => {
              onValueChange("");
              innerRef.current?.focus();
            }}
            aria-label={clearLabel ?? t("input.clear")}
            className="absolute right-2.5 top-2.5 grid place-items-center w-7 h-7 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        )}
        <div
          role="separator"
          tabIndex={0}
          aria-label={t("input.resizeHandle.aria")}
          aria-orientation="horizontal"
          aria-valuemin={minHeight}
          aria-valuemax={maxHeight}
          aria-valuenow={height}
          onPointerDown={(e) => {
            dragRef.current = { startY: e.clientY, startHeight: height };
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (dragRef.current === null) return;
            resize(dragRef.current.startHeight + e.clientY - dragRef.current.startY);
          }}
          onPointerUp={(e) => {
            dragRef.current = null;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              resize(height + step);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              resize(height - step);
            }
          }}
          className="absolute inset-x-4 bottom-2 flex h-7 cursor-ns-resize touch-none items-center justify-center rounded-full text-ha-green-deep/75 transition-colors hover:bg-ha-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green/40"
        >
          <span className="h-1.5 w-14 rounded-full bg-ha-green/45" aria-hidden="true" />
        </div>
      </div>
      {children}
    </div>
  );
});

export default ResizableTextarea;
