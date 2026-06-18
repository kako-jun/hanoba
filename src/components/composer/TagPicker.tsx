import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { captionHasTag } from "../../lib/image/hashtag-complete.ts";
import type { RankedTag } from "../../lib/feed/popular.ts";
import { getRecentTags } from "../../lib/plants/recent-tags.ts";
import { TAG_CATEGORIES } from "../../lib/plants/tag-catalog.ts";
import type { Genus, VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import {
  findPickableGenus,
  findVarietyGenus,
  searchCatalog,
  tagsToUnpick,
} from "../../lib/plants/variety-search.ts";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import Icon from "../ui/Icon.tsx";
import SciName from "../ui/SciName.tsx";

interface Props {
  /** 人気タグ（relay 集計・上位）。空なら人気セクションは出さない。 */
  popular: RankedTag[];
  /** 現在の一言（選択済みタグ＝満たされた色 の判定に使う）。 */
  caption: string;
  /** チップを選んだとき（本文末尾へ挿入する）。 */
  onPick: (tag: string) => void;
  /** 選択済みチップを再タップしたとき（本文から外す）。 */
  onRemove: (tag: string) => void;
}

/**
 * 世話/記録のクイック行で、常時インライン表示するタグの上限（#169）。
 * これを超えた残りは行末「その他」ポップアップで全件見せる（幅で候補を消さない＝共通化）。
 */
const INLINE_LIMIT = 7;

/**
 * 品種追加リクエストの宛先（#169/#232）。市役所ハブ（#163）が整ったので GitHub をやめ、
 * `/vote` の「品種への要望」板（住民投票 BBS の先頭・Nostalgic）へ集約する。
 * 品種に関する要望（並び順・追加・その他）は全部この板で受ける＝一般ユーザーを GitHub に飛ばさない。
 */
const REQUEST_TAG_URL = "/vote";

/** 人気タグの出現回数を 3 段階の文字サイズに割り当てる（タグクラウドの強弱）。 */
function cloudSize(count: number, max: number): string {
  if (max <= 1) return "text-sm";
  const r = count / max;
  if (r > 0.66) return "text-base font-semibold";
  if (r > 0.33) return "text-sm font-medium";
  return "text-xs";
}

/** タグチップ。active（本文に入っている）なら満たされた緑塗りに変える。 */
function Chip({ label, onClick, sizeClass = "text-sm", context, sci, active = false }: {
  label: string;
  onClick: () => void;
  sizeClass?: string;
  /** 同名タグの曖昧さ回避に出す小さな文脈（属/カテゴリ）。 */
  context?: string;
  /** 学名（品種チップのみ・#200）。和名(#label)が主、学名は小さく薄いイタリックで従に併記する。 */
  sci?: string;
  active?: boolean;
}) {
  // 学名は補助情報なので 1 行に収め、長い学名は省略する（和名を押し出さない・#200）。
  const subClass = `text-[10px] ${active ? "text-ha-white/70" : "text-ha-ink/40"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex max-w-full items-baseline rounded-full px-3 py-1 ${sizeClass} transition-colors ${
        active
          ? "border border-ha-green bg-ha-green text-ha-white"
          : "glass text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep"
      }`}
    >
      <span className="shrink-0">#{label}</span>
      {context !== undefined && <span className={`ml-1 shrink-0 ${subClass}`}>{context}</span>}
      {sci !== undefined && sci !== "" && (
        // 学名は視覚的な補助（従）。アクセシブル名はタグ名(#label)＝主のままにするため
        // aria-hidden にする（読み上げは #品種名 で完結・既存の exact-match 契約も保つ）。
        // data-sci はテストの安定 hook（SciName 内部クラスに結合しない・#200 レビュー nit）。
        <span aria-hidden data-sci className="ml-1 inline-block min-w-0 max-w-full truncate">
          <SciName sci={sci} className={subClass} />
        </span>
      )}
    </button>
  );
}

/** 見出し付きのチップ群（最近使った／世話／記録 等の小さなセクション）。 */
function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-ha-ink/45">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * タグピッカー（#22 / #143 / #144）。手打ちをやめ、最近・人気・世話/記録に加えて、
 * 1,400件超の品種カタログ（variety-catalog）を**動的 import で code-split**し、
 * カテゴリ→属→品種の多段ドリルダウン＋インクリメンタル検索で少クリック選択する。
 *
 * 規約（kako-jun 指示・#181 でタグと札を分離。#166 のタグ部分を撤回）:
 * - タグ=Twitter式ハッシュタグ＝**概要→詳細の全階層**を付けてよい。品種を選んだら
 *   `#属 #品種` の**両方**を入れる。属止まりなら `#属` だけ。
 *   **カテゴリ（塊根植物/花木 等）はタグにしない**（ドリルダウンの見出し専用）。
 *   札（鉢の名前＝具体1つ）はタグとは別概念（別 Issue）。
 * - 人気/最近/検索で**属をタップしたら階層に入る**（その属の品種一覧へ誘導）。属だけ欲しい時は
 *   ドリルダウン内の「#属 をこのまま使う」。
 * - 本文に入っているタグは**満たされた色**（緑塗り）にする。
 * - 値は本文に `#タグ` テキストとして末尾挿入されるだけ（DESIGN §6・t 化しない）。
 */
export default function TagPicker({ popular, caption, onPick, onRemove }: Props) {
  const max = popular.length > 0 ? Math.max(...popular.map((t) => t.count)) : 1;
  const panelRef = useRef<HTMLDivElement>(null);
  // 「その他」ポップアップ（世話/記録の行ごと）。ドリルダウンの open とは独立に管理する（#169）。
  const overflowRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  // どの行（label）の「その他」ポップアップが開いているか。同時に 1 つだけ（#169）。
  const [overflowOpen, setOverflowOpen] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  // 品種カタログは初期バンドルに載せず、検索/ドリルダウン/属タップ時だけ動的 import する。
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState(false);
  // ドリルダウンの開閉と現在地（カテゴリ→属→品種）。
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<VarietyCategory | null>(null);
  const [genus, setGenus] = useState<Genus | null>(null);

  // 最近使ったは localStorage（実行時状態）。SSR 安全にマウント後だけ読む。
  useEffect(() => {
    setRecent(getRecentTags());
  }, []);

  // 囲みの外をクリックしたらドリルダウンを閉じる（×を押さなくてよい・#144）。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current !== null && !panelRef.current.contains(e.target as Node)) closeDrilldown();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // 「その他」ポップアップは 囲み外クリック / Esc で閉じる（×でも閉じる・#169）。
  useEffect(() => {
    if (overflowOpen === null) return;
    const onDown = (e: MouseEvent) => {
      if (overflowRef.current !== null && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOverflowOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [overflowOpen]);

  const has = (tag: string) => captionHasTag(caption, tag);

  // 品種カタログを必要時に一度だけ読み込み、ロード済みの配列を返す（失敗時は null）。
  async function ensureCatalog(): Promise<VarietyCategory[] | null> {
    if (catalog !== null) return catalog;
    setLoadingCatalog(true);
    setCatalogError(false);
    try {
      const mod = await import("../../lib/plants/variety-catalog.ts");
      setCatalog(mod.VARIETY_CATALOG);
      return mod.VARIETY_CATALOG;
    } catch {
      setCatalogError(true);
      return null;
    } finally {
      setLoadingCatalog(false);
    }
  }

  // タグ挿入＝Twitter式ハッシュタグ。品種を選んだら **#属 #品種 の両方**を本文末尾へ入れる
  // （概要→詳細の全階層・#181 で #166 のタグ部分を撤回。タグ=全階層／札=具体1つ は別概念）。
  // 属を選んだとき（findVarietyGenus が null）は #属 のみ＝現状維持。
  // **カテゴリはタグにしない**（pick 経路にカテゴリ名は来ない＝ドリルダウン見出し専用）。
  // catalog 未ロード時（engage のフォールバック経路＝ensureCatalog 失敗）は属を引けないので
  // onPick(name) だけ＝属前置されない（null 安全・設計どおり。辞書が無ければ具体名のみ入る）。
  // 「最近使った」はここでは触らない＝**投稿成功後**に Composer が本文のタグを記録する
  // （タップしただけ・あとで消したタグは最近に残さない）。
  function pick(name: string) {
    const loc = catalog === null ? null : findVarietyGenus(catalog, name);
    // 品種なら先に #属 を入れる（pickable な見出し属のみ）。onPick を属→品種の順に2連発する。
    // 本文側 Composer.onPick は setCaption の関数型アップデータ＋insertTag（captionHasTag ガード）
    // なので、2連発でも属は二重挿入されず `#属 #品種` の順で並ぶ（この契約は hashtag-complete テストで固定）。
    if (loc !== null && loc.genus.pickable) onPick(loc.genus.name);
    onPick(name);
  }

  // 選択済みチップの再タップ＝解除。兄弟が残らなければ上位（属・カテゴリ）も連動して外す。
  // 未選択なら add()（通常の挿入/階層誘導）を実行する。
  function toggle(name: string, add: () => void) {
    if (has(name)) {
      for (const t of tagsToUnpick(caption, name, catalog)) onRemove(t);
    } else {
      add();
    }
  }

  // フラットなタグ（人気/最近）のタップ。属なら階層へ誘導、それ以外は葉として挿入（#166）。
  async function engage(name: string) {
    const loaded = await ensureCatalog();
    if (loaded === null) {
      pick(name);
      return;
    }
    const asGenus = findPickableGenus(loaded, name);
    if (asGenus !== null) {
      setQuery("");
      setOpen(true);
      setCat(asGenus.category);
      setGenus(asGenus.genus);
      return;
    }
    pick(name);
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    if (v.trim() !== "") void ensureCatalog();
  }

  function openDrilldown() {
    setOpen(true);
    void ensureCatalog();
  }

  // ‹戻る: 検索中はまず検索を消す。次に 品種→属→カテゴリ→閉じる の順に1段ずつ戻す。
  function goBack() {
    if (query.trim() !== "") setQuery("");
    else if (genus !== null) setGenus(null);
    else if (cat !== null) setCat(null);
    else setOpen(false);
  }

  function closeDrilldown() {
    setOpen(false);
    setQuery("");
    setCat(null);
    setGenus(null);
  }

  const searching = query.trim() !== "";

  // 検索は**植物カタログだけ**に集中する（世話/記録などの概念は混ぜない・kako-jun 指示）。
  // searchCatalog 内で fold（かな/カナ・大小・全半角無視）＋前方一致優先＋重複排除＋上限済み。
  const hits = searching ? searchCatalog(catalog ?? [], query) : [];
  const freeform = query.trim().replace(/^#+/, "").trim();
  const showFreeform =
    freeform !== "" && !hits.some((h) => h.name.toLowerCase() === freeform.toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ha-green-deep">タグを選ぶ</span>

      {!open ? (
        // ── 畳んだ状態: ドリルダウン入口を最上段に・最近・人気・世話/記録（0〜1タップ） ──────
        <>
          <button
            type="button"
            onClick={openDrilldown}
            aria-expanded={false}
            className="glass flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium text-ha-green-deep hover:border-ha-green/50 transition-colors"
          >
            <Icon name="sprout" className="h-4 w-4" />
            植物から選ぶ
            <span aria-hidden className="text-ha-ink/40">›</span>
          </button>

          {recent.length > 0 && (
            <ChipGroup label="最近使った">
              {recent.map((t) => (
                <Chip key={`recent-${t}`} label={t} active={has(t)} onClick={() => toggle(t, () => engage(t))} />
              ))}
            </ChipGroup>
          )}

          {popular.length > 0 && (
            <ChipGroup label="人気">
              {popular.map((t) => (
                <Chip
                  key={`pop-${t.tag}`}
                  label={t.tag}
                  sizeClass={cloudSize(t.count, max)}
                  active={has(t.tag)}
                  onClick={() => toggle(t.tag, () => engage(t.tag))}
                />
              ))}
            </ChipGroup>
          )}

          {TAG_CATEGORIES.map((c) => {
            // 頻度上位（先頭 N）だけ常時インライン。残りは「その他」ポップアップで全件見せる（#169）。
            const inline = c.tags.slice(0, INLINE_LIMIT);
            const hasOverflow = c.tags.length > INLINE_LIMIT;
            return (
              <ChipGroup key={c.label} label={c.label}>
                {inline.map((tag) => (
                  <Chip
                    key={`${c.label}-${tag}`}
                    label={tag}
                    active={has(tag)}
                    onClick={() => toggle(tag, () => pick(tag))}
                  />
                ))}
                {hasOverflow && (
                  // 「その他」ボタン。ポップアップは画面中央の portal モーダルで出す（#243）ので、
                  // ここはトリガーを inline 配置するだけ（旧 absolute 被せは廃止）。
                  <span className="inline-flex">
                    <button
                      type="button"
                      onClick={() => setOverflowOpen((o) => (o === c.label ? null : c.label))}
                      aria-haspopup="dialog"
                      aria-expanded={overflowOpen === c.label}
                      aria-label={`${c.label}のその他のタグ`}
                      className="glass flex items-center gap-1 rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      その他
                    </button>
                    {overflowOpen === c.label &&
                      typeof document !== "undefined" &&
                      createPortal(
                        // クリック位置に依らず画面中央の不透明モーダルで出す（#243）。トリガー基準の
                        // 半透明 absolute だと場所がばらつき、glass(白6%)が透明on透明で読めなかった。
                        // PostDetail と同じ portal＋scrim＋中央＋glass-strong(暗72%)。×/Esc/scrim で閉じる。
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                          <div
                            ref={overflowRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label={`${c.label}のタグ一覧`}
                            className="glass-strong flex max-h-[80vh] w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-2xl p-3 shadow-2xl"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-ha-ink/55">
                                {c.label}（ほか{c.tags.length - INLINE_LIMIT}件）
                              </span>
                              <button
                                type="button"
                                onClick={() => setOverflowOpen(null)}
                                aria-label="タグ一覧を閉じる"
                                className="grid h-7 w-7 place-items-center rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors"
                              >
                                <Icon name="close" className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {c.tags.slice(INLINE_LIMIT).map((tag) => (
                                <Chip
                                  key={`overflow-${c.label}-${tag}`}
                                  label={tag}
                                  active={has(tag)}
                                  onClick={() => toggle(tag, () => pick(tag))}
                                />
                              ))}
                            </div>
                          </div>
                        </div>,
                        document.body,
                      )}
                  </span>
                )}
              </ChipGroup>
            );
          })}

          {/* この植物が無い → 追加をリクエスト（控えめなテキストリンク・#169/#232・宛先は /vote の品種要望板）。 */}
          <a
            href={REQUEST_TAG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-xs text-ha-ink/45 underline decoration-dotted underline-offset-2 hover:text-ha-green-deep transition-colors"
          >
            この植物が無い → 追加をリクエスト
          </a>
        </>
      ) : (
        // ── 展開状態: 検索（パネル内・全件横断）＋ カテゴリ→属→品種 ドリルダウン ──────
        <div ref={panelRef} className="glass flex flex-col gap-2 rounded-2xl p-3">
          {/* ヘッダ: ‹戻る ＋ パンくず ＋ ×閉じる */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goBack}
              aria-label="一つ前に戻る"
              className="rounded-full px-2 py-1 text-sm text-ha-ink/70 hover:text-ha-green-deep transition-colors"
            >
              ‹ 戻る
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-xs text-ha-ink/55">
              植物{cat ? ` › ${cat.label}` : ""}{genus ? ` › ${genus.name}` : ""}
            </span>
            <button
              type="button"
              onClick={closeDrilldown}
              aria-label="ドリルダウンを閉じる"
              className="grid h-7 w-7 place-items-center rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          {/* インクリメンタル検索（パネル内・全件横断・フォーカスは保持される）。 */}
          <div className="relative mb-1.5">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ha-ink/40" />
            <ClearableInput
              value={query}
              onValueChange={handleQueryChange}
              aria-label="タグを検索"
              placeholder="品種・属を検索（例: チタノタ）"
              className="rounded-full border border-white/30 bg-white/5 py-2 pl-9 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:border-ha-green/50 focus:outline-none"
            />
          </div>

          {searching ? (
            // ── 検索結果（属→階層へ・品種→その葉だけ挿入・freeform→そのまま） ──
            <div className="flex flex-col gap-1.5">
              {loadingCatalog && catalog === null && (
                <span className="text-xs text-ha-ink/45">辞書を読み込み中…</span>
              )}
              {catalogError && (
                <span className="text-xs text-ha-pink">辞書を読み込めませんでした。もう一度お試しください。</span>
              )}
              {hits.length === 0 && !showFreeform && !loadingCatalog && (
                <span className="text-xs text-ha-ink/45">該当なし</span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {hits.map((h) =>
                  h.kind === "genus" ? (
                    <button
                      key={`g-${h.name}`}
                      type="button"
                      onClick={() => toggle(h.name, () => engage(h.name))}
                      aria-pressed={has(h.name)}
                      className={`rounded-full px-3 py-1 text-sm transition-colors ${
                        has(h.name)
                          ? "border border-ha-green bg-ha-green text-ha-white"
                          : "glass text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep"
                      }`}
                    >
                      #{h.name}
                      <span className={`ml-1 text-[10px] ${has(h.name) ? "text-ha-white/70" : "text-ha-ink/40"}`}>
                        {h.category}
                      </span>
                      {!has(h.name) && <span aria-hidden className="ml-1 text-ha-ink/40">›</span>}
                    </button>
                  ) : (
                    <Chip
                      key={`v-${h.name}`}
                      label={h.name}
                      context={h.genus ?? h.category}
                      sci={h.sci}
                      active={has(h.name)}
                      onClick={() => toggle(h.name, () => pick(h.name))}
                    />
                  ),
                )}
                {showFreeform && (
                  <button
                    type="button"
                    onClick={() => pick(freeform)}
                    className="rounded-full border border-dashed border-ha-green/50 px-3 py-1 text-sm text-ha-green-deep hover:bg-ha-green/10 transition-colors"
                  >
                    そのまま #{freeform} を使う
                  </button>
                )}
              </div>
            </div>
          ) : catalog === null ? (
            <span className="px-1 py-2 text-xs text-ha-ink/45">
              {catalogError ? "辞書を読み込めませんでした。もう一度お試しください。" : loadingCatalog ? "辞書を読み込み中…" : "—"}
            </span>
          ) : cat === null ? (
            // カテゴリ一覧
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => setCat(c)}
                  className="glass rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
                >
                  {c.label} <span aria-hidden className="text-ha-ink/40">›</span>
                </button>
              ))}
            </div>
          ) : genus === null ? (
            // 属一覧
            <div className="flex flex-wrap gap-1.5">
              {cat.genera.map((g) => (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => setGenus(g)}
                  className="glass rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
                >
                  {g.name}
                  <span className="ml-1 text-[10px] text-ha-ink/40">{g.varieties.length}</span>
                  <span aria-hidden className="ml-1 text-ha-ink/40">›</span>
                </button>
              ))}
            </div>
          ) : (
            // 品種一覧（pickable な属は「このまま使う」で属だけを葉として入れられる）
            <div className="flex flex-wrap gap-1.5">
              {genus.pickable && (
                <button
                  type="button"
                  onClick={() => toggle(genus.name, () => pick(genus.name))}
                  aria-pressed={has(genus.name)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    has(genus.name)
                      ? "border border-ha-green bg-ha-green text-ha-white"
                      : "border border-ha-green/60 bg-ha-green/10 text-ha-green-deep hover:bg-ha-green/20"
                  }`}
                >
                  #{genus.name} をこのまま使う
                </button>
              )}
              {genus.varieties.map((v) => (
                <Chip
                  key={v.name}
                  label={v.name}
                  sci={v.sci}
                  active={has(v.name)}
                  onClick={() => toggle(v.name, () => pick(v.name))}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
