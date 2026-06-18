import { useEffect, useState } from "react";
import Icon from "../ui/Icon.tsx";
import {
  addTag,
  removeTag,
  sinceFromDateInput,
  unixToDate,
  untilFromDateInput,
  type DiscoverFilter,
  type DiscoverSort,
} from "../../lib/feed/discoverFilter.ts";

interface Props {
  /** 現在の多軸フィルタ（DiscoverGrid の単一情報源を素通し）。 */
  filter: DiscoverFilter;
  /**
   * 軸を変えたら呼ぶ（意図的操作＝DiscoverGrid 側で pushState＋再取得）。
   * テキスト系（タグ追加・投稿者）は Enter/blur で確定、選択系（期間・並び）は即時に呼ぶ。
   */
  onChange: (filter: DiscoverFilter) => void;
}

const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
  { value: "new", label: "新着" },
  { value: "old", label: "古い" },
  { value: "popular", label: "人気" },
];

/**
 * 多軸フィルタの折りたたみパネル（#131 / #139 段階2・discover 上部）。
 *
 * 検索欄の下に「絞り込み ▾」を置き、開くと 品種/タグ（複数チップ・AND）・投稿者（npub/@名前）・
 * 期間（since〜until）・並び（新着/古い/人気）を一画面で指定できる。普段は畳んでシンプルに保つ
 * （写真が主役・モバイル優先）。状態は持たず props.filter を単一情報源にする（§3 単一責務）。
 *
 * a11y: トグルは aria-expanded、パネルは region。並びは radiogroup、各軸はラベル付き。
 * 見た目（余白・色）は実機ライブ blink（ルール7）で詰める前提の素組み。
 */
export default function DiscoverFilterPanel({ filter, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  // 投稿者欄はローカル入力。外部（検索ボックス・ビュー適用）で filter.author が変わったら同期する。
  const [authorDraft, setAuthorDraft] = useState(filter.author);
  useEffect(() => {
    setAuthorDraft(filter.author);
  }, [filter.author]);

  // アクティブな軸の数（畳んだトグルにバッジで出す）。並びは既定(new)以外で1。
  const activeCount =
    filter.tags.length +
    (filter.author !== "" ? 1 : 0) +
    (filter.keyword !== "" ? 1 : 0) +
    (filter.since !== null || filter.until !== null ? 1 : 0) +
    (filter.sort !== "new" ? 1 : 0);

  function commitTag() {
    const next = addTag(filter.tags, tagDraft);
    setTagDraft("");
    if (next !== filter.tags) onChange({ ...filter, tags: next });
  }

  function commitAuthor() {
    const a = authorDraft.trim();
    if (a !== filter.author) onChange({ ...filter, author: a });
  }

  function fieldClass(extra = ""): string {
    return `glass rounded-lg px-3 py-2 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:border-ha-green/60 focus:ring-2 focus:ring-ha-green/30 ${extra}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="discover-filter-panel"
        className="self-start inline-flex items-center gap-1.5 rounded-full glass px-3.5 py-1.5 text-sm font-medium text-ha-green-deep hover:border-ha-green/50"
      >
        絞り込み
        {activeCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ha-green px-1.5 text-xs font-semibold text-ha-white">
            {activeCount}
          </span>
        )}
        <Icon name="chevron" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id="discover-filter-panel"
          className="glass flex flex-col gap-4 rounded-2xl p-4"
        >
          {/* 品種・タグ（複数・AND）。チップ＋追加入力。 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="filter-tag-input" className="text-xs font-semibold text-ha-ink/60">
              品種・タグ（複数指定で すべて含む 投稿）
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {filter.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-ha-green px-3 py-1 text-sm font-medium text-ha-white"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`タグ「${tag}」を外す`}
                    onClick={() => onChange({ ...filter, tags: removeTag(filter.tags, tag) })}
                    className="-mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-ha-white/80 hover:text-ha-white"
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full glass px-2 py-0.5">
                <input
                  id="filter-tag-input"
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitTag();
                    }
                  }}
                  placeholder="例: トマト"
                  className="w-24 bg-transparent px-1 py-1 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={commitTag}
                  disabled={tagDraft.trim() === ""}
                  aria-label="タグを追加する"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ha-green-deep disabled:opacity-30"
                >
                  <Icon name="plus" className="h-4 w-4" />
                </button>
              </span>
            </div>
          </div>

          {/* 投稿者（npub または @名前）。 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="filter-author-input" className="text-xs font-semibold text-ha-ink/60">
              投稿者（npub または @名前）
            </label>
            <input
              id="filter-author-input"
              type="text"
              value={authorDraft}
              onChange={(e) => setAuthorDraft(e.target.value)}
              onBlur={commitAuthor}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAuthor();
                }
              }}
              placeholder="npub1… / @ユーザー名"
              className={fieldClass("w-full")}
            />
          </div>

          {/* 期間（since 〜 until）。 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ha-ink/60">期間</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="期間の開始日"
                value={unixToDate(filter.since)}
                onChange={(e) => onChange({ ...filter, since: sinceFromDateInput(e.target.value) })}
                className={fieldClass()}
              />
              <span className="text-ha-ink/50">〜</span>
              <input
                type="date"
                aria-label="期間の終了日"
                value={unixToDate(filter.until)}
                onChange={(e) => onChange({ ...filter, until: untilFromDateInput(e.target.value) })}
                className={fieldClass()}
              />
            </div>
          </div>

          {/* 並び。 */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-ha-ink/60">並び</span>
            <div role="radiogroup" aria-label="並び順" className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => {
                const active = filter.sort === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange({ ...filter, sort: opt.value })}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green ${
                      active
                        ? "bg-ha-green text-ha-white shadow-sm shadow-ha-green/30"
                        : "glass text-ha-ink/75 hover:border-ha-green/50 hover:text-ha-green-deep"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
