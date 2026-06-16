// 一言（必須）の入力。入力中の #タグを過去使用タグから補完する（DESIGN §3）。
//
// detectHashtagQuery で「キャレット直前の #語」を見つけ、filterHashtagCandidates で pool から
// 前方一致候補を出す。pool に無くても「そのまま #query を使う」を末尾に出す（freeform）。
// 候補は ↑↓ で移動、Enter で確定、Esc で閉じる。

import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { detectHashtagQuery, filterHashtagCandidates } from "../../lib/image/hashtag-complete.ts";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [height, setHeight] = useState(124);
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

  function resizeCaption(nextHeight: number) {
    setHeight(Math.min(Math.max(nextHeight, 104), 360));
  }

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
        ひとこと
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
          placeholder="株のこと。ひとことでも、じっくりでも。#アガベ のようにタグも。"
          className="w-full glass resize-none rounded-2xl px-3.5 py-2.5 pb-9 pr-10 text-ha-ink placeholder:text-ha-ink/45 focus:border-ha-green/60 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
          style={{ height }}
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
        <div
          role="separator"
          tabIndex={0}
          aria-label="入力欄の高さを調整"
          aria-orientation="horizontal"
          aria-valuemin={104}
          aria-valuemax={360}
          aria-valuenow={height}
          onPointerDown={(e) => {
            dragRef.current = { startY: e.clientY, startHeight: height };
            e.currentTarget.setPointerCapture(e.pointerId);
            e.preventDefault();
          }}
          onPointerMove={(e) => {
            if (dragRef.current === null) return;
            resizeCaption(dragRef.current.startHeight + e.clientY - dragRef.current.startY);
          }}
          onPointerUp={(e) => {
            dragRef.current = null;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              resizeCaption(height + 16);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              resizeCaption(height - 16);
            }
          }}
          className="absolute inset-x-4 bottom-2 flex h-7 cursor-ns-resize touch-none items-center justify-center rounded-full text-ha-green-deep/75 transition-colors hover:bg-ha-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green/40"
        >
          <span className="h-1.5 w-14 rounded-full bg-ha-green/45" aria-hidden="true" />
        </div>
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
