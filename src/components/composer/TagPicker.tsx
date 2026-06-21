import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { captionHasTag } from "../../lib/image/hashtag-complete.ts";
import type { RankedTag } from "../../lib/feed/popular.ts";
import { getRecentTags } from "../../lib/plants/recent-tags.ts";
import { TAG_CATEGORIES } from "../../lib/plants/tag-catalog.ts";
import type { Genus, VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import {
  findPickableGenus,
  searchCatalog,
  tagsToPick,
  tagsToPickAt,
  tagsToUnpick,
} from "../../lib/plants/variety-search.ts";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import Icon from "../ui/Icon.tsx";
import SciName from "../ui/SciName.tsx";
import { useT, useLocale } from "../../lib/i18n/index.ts";

interface Props {
  /** 人気タグ（relay 集計・上位）。空なら人気セクションは出さない。 */
  popular: RankedTag[];
  /** 現在の一言（選択済みタグ＝満たされた色 の判定に使う）。filter モードでは選択タグを `#a #b` で渡す。 */
  caption: string;
  /** チップを選んだとき（compose=本文末尾へ挿入／filter=絞り込みタグに追加）。 */
  onPick: (tag: string) => void;
  /** 選択済みチップを再タップしたとき（本文/絞り込みから外す）。 */
  onRemove: (tag: string) => void;
  /**
   * 用途（#239）。既定 `compose`＝投稿画面（従来どおり）。`filter`＝discover の品種絞り込み:
   * - 投稿専用セクション（最近/人気/世話・記録/リクエスト）を畳んだ状態で出さない＝品種ドリルダウン＋検索だけ。
   * - 品種を選んでも **#属を前置しない（葉タグのみ）**。絞り込みは AND なので属を足すと過剰に絞る（属タグの無い投稿が落ちる）。
   * - 解除は連動撤去（兄弟チェック）でなく **そのタグ1つだけ外す**（filter は葉のみ入れているため）。
   * - 見出しを「品種で絞る」にする。
   */
  mode?: "compose" | "filter";
}

/**
 * 世話/記録のクイック行で、常時インライン表示するタグの上限（#169）。
 * これを超えた残りは行末「その他」ポップアップで全件見せる（幅で候補を消さない＝共通化）。
 */
const INLINE_LIMIT = 7;

/**
 * 「その他」ポップアップを出す最小あふれ件数（#251）。あふれが MIN_OVERFLOW 未満なら
 * 中途半端な数件のためにポップアップを作らず、その行は全件インラインで見せる。
 * これで「下のカテゴリにその他が無い／開いても2件だけ」のガタつきを消し、
 * 残った『その他』は常に中身が充実する（隠す価値があるときだけ隠す）。
 */
const MIN_OVERFLOW = 4;

/**
 * 「最近使った」「人気」の近道行で出すチップ数の上限（kako-jun「数が多すぎてスクロールが大変」）。
 * 人気は relay 集計で最大30件、最近は最大12件まで溜まるが、近道は**さっと選ぶ少数**でよい
 * （網羅は植物ドリルダウン＋検索が担う）。先頭=最頻/最新の数件に絞る。
 */
const QUICK_SHORTCUT_LIMIT = 8;

/**
 * 品種追加リクエストの宛先（#169/#232）。市役所ハブ（#163）が整ったので GitHub をやめ、
 * `/vote` の「品種への要望」板（住民投票 BBS の先頭・Nostalgic）へ集約する。
 * 品種に関する要望（並び順・追加・その他）は全部この板で受ける＝一般ユーザーを GitHub に飛ばさない。
 */
const REQUEST_TAG_URL = "/vote";

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
 * 規約（kako-jun 指示・#181 でタグと札を分離。#166 のタグ部分を撤回。#312 でカテゴリも反転）:
 * - タグ=Twitter式ハッシュタグ＝**概要→詳細の全階層**を付けてよい。品種を選んだら
 *   `#カテゴリ #属 #品種` を入れる。属止まりなら `#カテゴリ #属`、**カテゴリ単独でも `#カテゴリ`**。
 *   **カテゴリ（塊根植物/ハーブ 等）もタグにする**（#312＝「ドリルダウンで1回押した言葉が
 *   タグにならないのは直感に反する」／品種名が分からない人はカテゴリで止めてタグにできる）。
 *   階層展開は純関数 `tagsToPick`。札（鉢の名前＝具体1つ）はタグとは別概念で、札は
 *   カテゴリを出さない（`resolveFuda` がカテゴリ label を札化しない＝無回帰）。
 * - 人気/最近/検索で**属をタップしたら階層に入る**（その属の品種一覧へ誘導）。属だけ欲しい時は
 *   ドリルダウン内の「#属 をこのまま使う」。
 * - 本文に入っているタグは**満たされた色**（緑塗り）にする。
 * - 値は本文に `#タグ` テキストとして末尾挿入されるだけ（DESIGN §6・t 化しない）。
 */
export default function TagPicker({ popular, caption, onPick, onRemove, mode = "compose" }: Props) {
  const t = useT(useLocale());
  const isFilter = mode === "filter";
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
  // 中央モーダル（#243）は scrim が全面を覆うので「囲み外」＝実質 scrim クリック＝この mousedown で閉じる。
  // aria-modal 宣言と実挙動を一致させるため、開いたらモーダルへフォーカスを移し、閉じたら元（トリガー）へ戻す。
  useEffect(() => {
    if (overflowOpen === null) return;
    const prevFocused = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    overflowRef.current?.focus();
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
      // 閉じたらフォーカスをトリガーへ戻す（キーボード/SR の文脈を失わせない）。
      prevFocused?.focus?.();
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

  // タグ挿入＝Twitter式ハッシュタグ。**概要→詳細の全階層**を本文末尾へ入れる（#181 で #166 の
  // タグ部分を撤回。タグ=全階層／札=具体1つ は別概念）。#312 で **カテゴリもタグにする**:
  // 品種を選んだら `#カテゴリ #属 #品種`、属を選んだら `#カテゴリ #属`、カテゴリ単独なら `#カテゴリ`。
  // この階層展開は純関数 `tagsToPick` に集約する（pickable 判定・dedupe を一元化）。
  // catalog 未ロード時（engage のフォールバック経路＝ensureCatalog 失敗）は階層を引けないので
  // onPick(name) だけ＝前置されない（null 安全・設計どおり。辞書が無ければ具体名のみ入る）。
  // 「最近使った」はここでは触らない＝**投稿成功後**に Composer が本文のタグを記録する
  // （タップしただけ・あとで消したタグは最近に残さない）。
  // `context` を渡せる経路（ドリルダウン/検索）は**選んだ経路どおりのカテゴリ/属**で階層化する
  // （#315・同名品種のカテゴリ跨ぎ誤同定を避ける）。文脈の無い経路（freeform/人気/最近）は
  // 名前先勝ち解決にフォールバックする。`genusName` は前置する pickable 属名（無ければ null）。
  function pick(name: string, context?: { categoryLabel: string; genusName: string | null }) {
    // filter は葉タグのみ（AND 絞り込みで上位を足すと、上位タグを持たない投稿が落ちて過剰に絞るため）。
    // catalog 未ロードも葉のみ（階層を引けない）。
    if (isFilter || catalog === null) {
      onPick(name);
      return;
    }
    // compose は概要→詳細の全階層を onPick で順に挿入する（#312）。本文側 Composer.onPick は
    // setCaption の関数型アップデータ＋insertTag（captionHasTag ガード）なので、複数連発でも
    // 重複挿入されず `#カテゴリ #属 #品種` の順で並ぶ（この契約は hashtag-complete テストで固定）。
    const tags =
      context !== undefined
        ? tagsToPickAt(context.categoryLabel, context.genusName, name)
        : tagsToPick(catalog, name);
    for (const tag of tags) onPick(tag);
  }

  // 選択済みチップの再タップ＝解除。兄弟が残らなければ上位（属・カテゴリ）も連動して外す。
  // 未選択なら add()（通常の挿入/階層誘導）を実行する。
  function toggle(name: string, add: () => void) {
    if (has(name)) {
      // filter は葉のみ入れるので、そのタグ1つだけ外す。compose は兄弟が残らなければ上位も連動撤去。
      if (isFilter) onRemove(name);
      else for (const tag of tagsToUnpick(caption, name, catalog)) onRemove(tag);
    } else {
      add();
    }
  }

  // ドリルダウンを指定地点（カテゴリ／属）で開く（#364・カテゴリは常に品種選択へ入る）。
  function drillTo(category: VarietyCategory, genusObj: Genus | null) {
    setQuery("");
    setOpen(true);
    setCat(category);
    setGenus(genusObj);
  }

  // フラットなタグ（人気/最近）のタップ。属なら階層へ誘導、**カテゴリも常に階層へドリルイン**（#364・
  // kako-jun「カテゴリのクリックは常に品種選択と同じ動き／カテゴリ単体タグを打ちたい場合はない」）。
  // それ以外（品種/辞書外）は葉として挿入（#166）。
  async function engage(name: string) {
    const loaded = await ensureCatalog();
    if (loaded === null) {
      pick(name);
      return;
    }
    const asGenus = findPickableGenus(loaded, name);
    if (asGenus !== null) {
      drillTo(asGenus.category, asGenus.genus);
      return;
    }
    // #364: カテゴリ名なら、そのカテゴリの階層へドリルイン（単体タグにしない）。
    const asCat = loaded.find((c) => c.label === name);
    if (asCat !== undefined) {
      drillTo(asCat, null);
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
  // カテゴリヒット（#312）は compose だけに出す＝filter で `#カテゴリ` 単独だと旧投稿
  // （カテゴリタグ無し）にほぼ当たらず絞りが空振りするため（葉で絞る方針を維持）。
  const hits = searching
    ? searchCatalog(catalog ?? [], query).filter((h) => !isFilter || h.kind !== "category")
    : [];
  const freeform = query.trim().replace(/^#+/, "").trim();
  const showFreeform =
    freeform !== "" && !hits.some((h) => h.name.toLowerCase() === freeform.toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ha-green-deep">{isFilter ? t("tag.heading.filter") : t("tag.heading.compose")}</span>

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
            {t("tag.fromPlants")}
            <span aria-hidden className="text-ha-ink/40">›</span>
          </button>

          {/* 投稿専用のクイック行（最近/人気/世話・記録/リクエスト）は filter モードでは出さない＝
              品種ドリルダウン＋検索だけにする（#239・kako-jun 指示）。 */}
          {!isFilter && (
            <>
          {recent.length > 0 && (
            <ChipGroup label={t("tag.group.recent")}>
              {/* 多すぎてスクロールが大変なので先頭 QUICK_SHORTCUT_LIMIT 件だけ出す（kako-jun）。 */}
              {recent.slice(0, QUICK_SHORTCUT_LIMIT).map((tag) => (
                <Chip key={`recent-${tag}`} label={tag} active={has(tag)} onClick={() => toggle(tag, () => engage(tag))} />
              ))}
            </ChipGroup>
          )}

          {popular.length > 0 && (
            <ChipGroup label={t("tag.group.popular")}>
              {popular.slice(0, QUICK_SHORTCUT_LIMIT).map((pop) => (
                <Chip
                  key={`pop-${pop.tag}`}
                  label={pop.tag}
                  active={has(pop.tag)}
                  onClick={() => toggle(pop.tag, () => engage(pop.tag))}
                />
              ))}
            </ChipGroup>
          )}

          {TAG_CATEGORIES.map((c) => {
            // あふれが MIN_OVERFLOW 以上あるときだけ「その他」を作る（#251）。それ未満なら全件インライン。
            // → 仕立て・特徴のような小さい行は全部見せ、世話・記録だけ先頭 N をインライン＋残りをポップアップ。
            const hasOverflow = c.tags.length - INLINE_LIMIT >= MIN_OVERFLOW;
            const inline = hasOverflow ? c.tags.slice(0, INLINE_LIMIT) : c.tags;
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
                      aria-label={t("tag.overflow.aria", { label: c.label })}
                      className="glass flex items-center gap-1 rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      {t("tag.overflow.button")}
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
                            aria-label={t("tag.overflow.dialog.aria", { label: c.label })}
                            tabIndex={-1}
                            className="glass-strong flex max-h-[80vh] w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 overflow-y-auto rounded-2xl p-3 shadow-2xl focus:outline-none"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs text-ha-ink/55">
                                {t("tag.overflow.count", { label: c.label, n: c.tags.length - INLINE_LIMIT })}
                              </span>
                              <button
                                type="button"
                                onClick={() => setOverflowOpen(null)}
                                aria-label={t("tag.overflow.close.aria")}
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
            {t("tag.request")}
          </a>
            </>
          )}
        </>
      ) : (
        // ── 展開状態: 検索（パネル内・全件横断）＋ カテゴリ→属→品種 ドリルダウン ──────
        <div ref={panelRef} className="glass flex flex-col gap-2 rounded-2xl p-3">
          {/* ヘッダ: ‹戻る ＋ パンくず ＋ ×閉じる */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={goBack}
              aria-label={t("tag.back.aria")}
              className="rounded-full px-2 py-1 text-sm text-ha-ink/70 hover:text-ha-green-deep transition-colors"
            >
              {t("tag.back")}
            </button>
            <span className="min-w-0 flex-1 truncate text-center text-xs text-ha-ink/55">
              {t("tag.breadcrumb.root")}{cat ? ` › ${cat.label}` : ""}{genus ? ` › ${genus.name}` : ""}
            </span>
            <button
              type="button"
              onClick={closeDrilldown}
              aria-label={t("tag.close.aria")}
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
              aria-label={t("tag.search.aria")}
              placeholder={t("tag.search.placeholder")}
              className="rounded-full border border-white/30 bg-white/5 py-2 pl-9 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:border-ha-green/50 focus:outline-none"
            />
          </div>

          {searching ? (
            // ── 検索結果（属→階層へ・品種→その葉だけ挿入・freeform→そのまま） ──
            <div className="flex flex-col gap-1.5">
              {loadingCatalog && catalog === null && (
                <span className="text-xs text-ha-ink/45">{t("tag.dict.loading")}</span>
              )}
              {catalogError && (
                <span className="text-xs text-ha-pink">{t("tag.dict.error")}</span>
              )}
              {hits.length === 0 && !showFreeform && !loadingCatalog && (
                <span className="text-xs text-ha-ink/45">{t("tag.noResults")}</span>
              )}
              <div className="flex flex-wrap gap-1.5">
                {hits.map((h) =>
                  h.kind === "category" ? (
                    // カテゴリヒット（#364）。タップで**そのカテゴリの階層へドリルイン**（#312 の単体タグ化は撤回・
                    // kako-jun「カテゴリのクリックは常に品種選択と同じ動き／単体タグを打ちたい場合はない」）。
                    <button
                      key={`c-${h.name}`}
                      type="button"
                      onClick={() => engage(h.name)}
                      className="rounded-full px-3 py-1 text-sm glass text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
                    >
                      {h.name}
                      <span className="ml-1 text-[10px] text-ha-ink/40">{t("tag.category.label")}</span>
                      <span aria-hidden className="ml-1 text-ha-ink/40">›</span>
                    </button>
                  ) : h.kind === "genus" ? (
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
                      onClick={() =>
                        toggle(h.name, () =>
                          // 検索ヒットの由来カテゴリ/属で階層化（#315・名前先勝ちで別カテゴリに化けない）。
                          pick(h.name, {
                            categoryLabel: h.category,
                            genusName: h.genusPickable === true ? (h.genus ?? null) : null,
                          }),
                        )
                      }
                    />
                  ),
                )}
                {showFreeform && (
                  <button
                    type="button"
                    onClick={() => pick(freeform)}
                    className="rounded-full border border-dashed border-ha-green/50 px-3 py-1 text-sm text-ha-green-deep hover:bg-ha-green/10 transition-colors"
                  >
                    {t("tag.useFreeform", { tag: freeform })}
                  </button>
                )}
              </div>
            </div>
          ) : catalog === null ? (
            <span className="px-1 py-2 text-xs text-ha-ink/45">
              {catalogError ? t("tag.dict.error") : loadingCatalog ? t("tag.dict.loading") : "—"}
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
            // 属一覧（pickable な属へドリル）。#364 で「このカテゴリをこのまま使う」（#312 のカテゴリ単独タグ）は
            // 撤去＝カテゴリは単体エンドポイントにせず、必ず属/品種まで降りて選ぶ（カテゴリは前置タグとしてだけ付く）。
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
                  onClick={() => toggle(genus.name, () => pick(genus.name, { categoryLabel: cat.label, genusName: null }))}
                  aria-pressed={has(genus.name)}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    has(genus.name)
                      ? "border border-ha-green bg-ha-green text-ha-white"
                      : "border border-ha-green/60 bg-ha-green/10 text-ha-green-deep hover:bg-ha-green/20"
                  }`}
                >
                  {t("tag.useGenus", { name: genus.name })}
                </button>
              )}
              {genus.varieties.map((v) => (
                <Chip
                  key={v.name}
                  label={v.name}
                  sci={v.sci}
                  active={has(v.name)}
                  // ドリルダウンで降りた属/カテゴリで階層化（#315・同名品種が別カテゴリに化けない）。
                  onClick={() =>
                    toggle(v.name, () =>
                      pick(v.name, { categoryLabel: cat.label, genusName: genus.pickable ? genus.name : null }),
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
