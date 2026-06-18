import { useEffect, useState, type ReactNode } from "react";
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
  /** 保存した絞り込み（名前付き）の切替 UI。展開エリアの最上部に出す（#139 段階3）。 */
  savedFilters?: ReactNode;
  /** 現在の絞り込みの共有 UI。展開エリアの最下部に出す（#139 段階2）。 */
  share?: ReactNode;
}

const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
  { value: "new", label: "新着" },
  { value: "old", label: "古い" },
  { value: "popular", label: "人気" },
];

// セクション見出しの共通クラス。
const LABEL = "text-xs font-semibold text-ha-ink/60";
// 入力・チップの共通高さ（入力中と確定後・チップとで高さがブレないように揃える・#10 blink）。
const CONTROL_H = "h-9";

/**
 * 絞り込みの折りたたみパネル（discover 上部）。**絞り込みに関わる UI は全部ここに入れる**
 * （#131/#139・kako-jun 指示「絞り込みで増える領域に絞り込み関係は全部入れろ」）。
 *
 * 検索欄の下に「絞り込み ▾」を置き、開くと縦に:
 *   1. 保存した絞り込み（名前付き・切替／保存／削除＝savedFilters スロット・最上部・#139 段階3）
 *   2. 品種/タグ（複数チップ・AND）・投稿者（npub/@名前）・期間（since〜until）・並び（新着/古い/人気）
 *   3. この絞り込みを共有（share スロット・最下部・#139 段階2）
 * 普段は畳んでシンプルに保つ（写真が主役・モバイル優先）。状態は持たず props を単一情報源にする。
 *
 * 用語は「絞り込み」で統一する（「ビュー」と呼ばない・kako-jun 指示）。
 * 日本語 IME の変換確定 Enter を誤って確定操作に拾わないよう、テキスト入力は `isComposing` 中の
 * Enter を無視する（#4 blink）。入力中と確定後で高さが変わらないよう各コントロールを `h-9` に揃える。
 *
 * a11y: トグルは aria-expanded、パネルは region。並びは radiogroup、各軸はラベル付き。
 */
export default function DiscoverFilterPanel({ filter, onChange, savedFilters, share }: Props) {
  const [open, setOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  // 投稿者欄はローカル入力。外部（検索ボックス・保存した絞り込み適用）で filter.author が変わったら同期。
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

  // IME 変換確定の Enter（isComposing 中）は確定操作に使わない（#4・日本語入力で誤発火を防ぐ）。
  function onEnterCommit(e: React.KeyboardEvent, commit: () => void) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit();
    }
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
        <div id="discover-filter-panel" className="glass flex flex-col gap-4 rounded-2xl p-4">
          {/* 1. 保存した絞り込み（名前付き）。展開エリアの最上部（#9 指示＝絞り込みより下に出さない）。 */}
          {savedFilters !== undefined && (
            <div className="flex flex-col gap-2">
              <span className={LABEL}>保存した絞り込み</span>
              {savedFilters}
            </div>
          )}

          {/* 2. 品種・タグ（複数・AND）。チップ＋追加入力。 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="filter-tag-input" className={LABEL}>
              品種・タグ（複数指定で すべて含む 投稿）
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {filter.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex ${CONTROL_H} items-center gap-1 rounded-full bg-ha-green px-3 text-sm font-medium text-ha-white`}
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
              <span className={`inline-flex ${CONTROL_H} items-center gap-1 rounded-full glass px-2`}>
                <input
                  id="filter-tag-input"
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => onEnterCommit(e, commitTag)}
                  placeholder="例: トマト"
                  className="w-24 bg-transparent px-1 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none"
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

          {/* 3. 投稿者（npub または @名前）。 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="filter-author-input" className={LABEL}>
              投稿者（npub または @名前）
            </label>
            <input
              id="filter-author-input"
              type="text"
              value={authorDraft}
              onChange={(e) => setAuthorDraft(e.target.value)}
              onBlur={commitAuthor}
              onKeyDown={(e) => onEnterCommit(e, commitAuthor)}
              placeholder="npub1… / @ユーザー名"
              className={`glass ${CONTROL_H} w-full rounded-lg px-3 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:border-ha-green/60 focus:ring-2 focus:ring-ha-green/30`}
            />
          </div>

          {/* 4. 期間（since 〜 until）。 */}
          <div className="flex flex-col gap-2">
            <span className={LABEL}>期間</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                aria-label="期間の開始日"
                value={unixToDate(filter.since)}
                onChange={(e) => onChange({ ...filter, since: sinceFromDateInput(e.target.value) })}
                className={`ha-date glass ${CONTROL_H} rounded-lg px-3 text-sm text-ha-ink focus:outline-none focus:border-ha-green/60 focus:ring-2 focus:ring-ha-green/30`}
              />
              <span className="text-ha-ink/50">〜</span>
              <input
                type="date"
                aria-label="期間の終了日"
                value={unixToDate(filter.until)}
                onChange={(e) => onChange({ ...filter, until: untilFromDateInput(e.target.value) })}
                className={`ha-date glass ${CONTROL_H} rounded-lg px-3 text-sm text-ha-ink focus:outline-none focus:border-ha-green/60 focus:ring-2 focus:ring-ha-green/30`}
              />
            </div>
          </div>

          {/* 5. 並び。 */}
          <div className="flex flex-col gap-2">
            <span className={LABEL}>並び</span>
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
                    className={`inline-flex ${CONTROL_H} items-center rounded-full px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green ${
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

          {/* 6. この絞り込みを共有（最下部・#139 段階2）。何も絞っていない時は share 側が null を返す。 */}
          {share}
        </div>
      )}
    </div>
  );
}
