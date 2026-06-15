// 一言（必須）の入力。入力中の #タグを過去使用タグから補完する（DESIGN §3）。
//
// detectHashtagQuery で「キャレット直前の #語」を見つけ、filterHashtagCandidates で pool から
// 前方一致候補を出す。pool に無くても「そのまま #query を使う」を末尾に出す（freeform）。
// 候補は ↑↓ で移動、Enter で確定、Esc で閉じる。

import { useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { detectHashtagQuery, filterHashtagCandidates } from "../../lib/image/hashtag-complete.ts";

interface CaptionInputProps {
  value: string;
  onChange: (value: string) => void;
  /** 補完候補プール（過去使用タグ）。親が fetchKnownHashtags で用意する。 */
  pool: string[];
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

export default function CaptionInput({ value, onChange, pool }: CaptionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popup, setPopup] = useState<PopupState | null>(null);

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

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    refreshPopup(text, e.target.selectionStart);
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
    <div className="relative flex flex-col gap-1">
      <label htmlFor="hanoba-caption" className="text-sm font-medium text-ha-green-deep">
        ひとこと（必須）
      </label>
      {/* キャレット/ハッシュタグ補完のため ClearableTextarea は使わず、× だけ共通の見た目で足す。
          ハンドラ（onChange/onSelect/onKeyDown）は触らず、× は値を空にして補完ポップアップも閉じる。 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          id="hanoba-caption"
          value={value}
          onChange={handleChange}
          onSelect={handleSelect}
          onKeyDown={handleKeyDown}
          onBlur={() => setPopup(null)}
          rows={3}
          placeholder="株のこと、ひとこと。#アガベ のようにタグも付けられます。"
          className="w-full glass rounded-2xl px-3.5 py-2.5 pr-10 text-ha-ink placeholder:text-ha-ink/45 resize-y focus:border-ha-green/60 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
        />
        {value !== "" && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setPopup(null);
              textareaRef.current?.focus();
            }}
            aria-label="入力をクリア"
            className="absolute right-2.5 top-2.5 grid place-items-center w-7 h-7 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors"
          >
            <Icon name="close" className="w-4 h-4" />
          </button>
        )}
      </div>
      {popup !== null && (
        <ul
          role="listbox"
          aria-label="ハッシュタグ候補"
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
    </div>
  );
}
