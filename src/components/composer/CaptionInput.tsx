// 一言（必須）の入力。入力中の #タグを過去使用タグから補完する（DESIGN §3）。
//
// detectHashtagQuery で「キャレット直前の #語」を見つけ、filterHashtagCandidates で pool から
// 前方一致候補を出す。pool に無くても「そのまま #query を使う」を末尾に出す（freeform）。
// 候補は ↑↓ で移動、Enter で確定、Esc で閉じる。
//
// glass・×クリア・下辺ドラッグバーで高さ調整、という見た目/操作は共通部品 ResizableTextarea
// に委ね（自己紹介欄と同一・#188）、ここはハッシュタグ補完（一言専用）だけを上に載せる。

import { useEffect, useRef, useState } from "react";
import ResizableTextarea from "../ui/ResizableTextarea.tsx";
import { detectHashtagQuery, filterHashtagCandidates } from "../../lib/image/hashtag-complete.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

interface CaptionInputProps {
  value: string;
  onChange: (value: string) => void;
  /** 補完候補プール（過去使用タグ）。親が fetchKnownHashtags で用意する。 */
  pool: string[];
  /**
   * タグチップ挿入/解除のたびに親が increment する合図（#165）。値が変わったら textarea を
   * focus してキャレットを本文末尾へ移す。0（初期値）では発火しない。手打ち補完
   * （applyCandidate）はこの経路を通らず、従来どおりキャレット位置で確定する。
   */
  focusEndSignal?: number;
}

interface PopupState {
  /** 表示する候補（pool 由来 + freeform）。 */
  items: string[];
  /** ハイライト中の index。 */
  active: number;
  /** 置換対象の # 開始位置。 */
  start: number;
  /** 置換対象トークンの終端（キャレット位置）。 */
  end: number;
}

export default function CaptionInput({ value, onChange, pool, focusEndSignal = 0 }: CaptionInputProps) {
  const t = useT(useLocale());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

  // タグチップ挿入/解除後にキャレットを本文末尾へ送る（#165）。初期値 0 では発火しない。
  // value 更新（setCaption）と同フレームの再レンダリング後に textarea の現在長へ寄せる。
  useEffect(() => {
    if (focusEndSignal === 0) return;
    const el = textareaRef.current;
    if (el === null) return;
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (node === null) return;
      const end = node.value.length;
      node.focus();
      node.setSelectionRange(end, end);
    });
  }, [focusEndSignal]);

  function buildItems(query: string): string[] {
    const candidates = filterHashtagCandidates(pool, query);
    // freeform（そのまま #query を使う）を、まだ候補に無ければ先頭に出す。
    const freeform = `#${query}`;
    const hasExact = candidates.some((c) => c.toLowerCase() === query.toLowerCase());
    const items = candidates.map((c) => `#${c}`);
    if (query !== "" && !hasExact) {
      items.unshift(freeform);
    }
    return items;
  }

  function refreshPopup(text: string, caret: number) {
    const detected = detectHashtagQuery(text, caret);
    if (detected === null) {
      setPopup(null);
      return;
    }
    const items = buildItems(detected.query);
    if (items.length === 0) {
      setPopup(null);
      return;
    }
    setPopup({ items, active: 0, start: detected.start, end: caret });
  }

  function handleValueChange(text: string) {
    onChange(text);
    // 変更時のキャレット位置は textarea の現在値で取る（onChange は入力反映後に発火）。
    const caret = textareaRef.current?.selectionStart ?? text.length;
    refreshPopup(text, caret);
  }

  function handleSelect(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    refreshPopup(el.value, el.selectionStart);
  }

  function applyCandidate(item: string) {
    if (popup === null) return;
    // item は "#tag"。# 開始位置から現在のキャレットまでを置換し、末尾に半角空白を付ける。
    const before = value.slice(0, popup.start);
    const after = value.slice(popup.end);
    const inserted = `${item} `;
    const next = before + inserted + after;
    onChange(next);
    setPopup(null);
    // キャレットを挿入直後へ。
    const caret = before.length + inserted.length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (popup === null) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPopup({ ...popup, active: (popup.active + 1) % popup.items.length });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPopup({ ...popup, active: (popup.active - 1 + popup.items.length) % popup.items.length });
    } else if (e.key === "Enter") {
      const item = popup.items[popup.active];
      if (item !== undefined) {
        e.preventDefault();
        applyCandidate(item);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPopup(null);
    }
  }

  return (
    <ResizableTextarea
      ref={textareaRef}
      id="hanoba-caption"
      label={t("caption.label")}
      value={value}
      onValueChange={handleValueChange}
      onSelect={handleSelect}
      onKeyDown={handleKeyDown}
      onBlur={() => setPopup(null)}
      aria-required="true"
      rows={3}
      placeholder={t("caption.placeholder")}
    >
      {popup !== null && (
        <ul
          role="listbox"
          aria-label={t("caption.suggest.aria")}
          className="glass-strong absolute z-10 left-0 right-0 top-full mt-1 max-h-56 overflow-auto rounded-2xl shadow-2xl"
        >
          {popup.items.map((item, i) => (
            <li key={item} role="option" aria-selected={i === popup.active}>
              <button
                type="button"
                // onMouseDown（blur より先に発火）で選択を確定する。
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyCandidate(item);
                }}
                className={`block w-full text-left px-3 py-1.5 text-sm ${
                  i === popup.active
                    ? "bg-ha-green/20 text-ha-green-deep"
                    : "text-ha-ink hover:bg-white/10"
                }`}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ResizableTextarea>
  );
}
