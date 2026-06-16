import { useEffect, useState, type ReactNode } from "react";
import { captionHasTag } from "../../lib/image/hashtag-complete.ts";
import type { RankedTag } from "../../lib/feed/popular.ts";
import { getRecentTags, pushRecentTag } from "../../lib/plants/recent-tags.ts";
import { TAG_CATEGORIES } from "../../lib/plants/tag-catalog.ts";
import type { Genus, VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import {
  findPickableGenus,
  findVarietyGenus,
  searchCatalog,
  SEARCH_LIMIT,
  type VarietyHit,
} from "../../lib/plants/variety-search.ts";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import Icon from "../ui/Icon.tsx";

interface Props {
  /** 人気タグ（relay 集計・上位）。空なら人気セクションは出さない。 */
  popular: RankedTag[];
  /** 現在の一言（選択済みタグ＝満たされた色 の判定に使う）。 */
  caption: string;
  /** チップを選んだとき（本文末尾へ挿入する）。 */
  onPick: (tag: string) => void;
}

/** 人気タグの出現回数を 3 段階の文字サイズに割り当てる（タグクラウドの強弱）。 */
function cloudSize(count: number, max: number): string {
  if (max <= 1) return "text-sm";
  const r = count / max;
  if (r > 0.66) return "text-base font-semibold";
  if (r > 0.33) return "text-sm font-medium";
  return "text-xs";
}

/** タグチップ。active（本文に入っている）なら満たされた緑塗りに変える。 */
function Chip({ label, onClick, sizeClass = "text-sm", context, active = false }: {
  label: string;
  onClick: () => void;
  sizeClass?: string;
  /** 同名タグの曖昧さ回避に出す小さな文脈（属/カテゴリ）。 */
  context?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 ${sizeClass} transition-colors ${
        active
          ? "border border-ha-green bg-ha-green text-ha-white"
          : "glass text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep"
      }`}
    >
      #{label}
      {context !== undefined && (
        <span className={`ml-1 text-[10px] ${active ? "text-ha-white/70" : "text-ha-ink/40"}`}>{context}</span>
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
 * 規約（kako-jun 指示・#144）:
 * - 品種を選ぶと**上位の属タグも前置**して `#属 #品種` の順で入れる（属は pickable な時だけ）。
 * - 人気/最近/検索で**属をタップしたら階層に入る**（その属の品種一覧へ誘導）。属だけ欲しい時は
 *   ドリルダウン内の「#属 をこのまま使う」。
 * - 本文に入っているタグは**満たされた色**（緑塗り）にする。
 * - 値は本文に `#タグ` テキストとして末尾挿入されるだけ（DESIGN §6・t 化しない）。
 */
export default function TagPicker({ popular, caption, onPick }: Props) {
  const max = popular.length > 0 ? Math.max(...popular.map((t) => t.count)) : 1;

  const [query, setQuery] = useState("");
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

  // タグ挿入＝本文末尾へ入れて最近使ったを更新する（全ピック経路で通す）。
  // parent（pickable な上位属）があれば先に入れて `#属 #品種` の順にする。
  function pick(name: string, parent?: string | null) {
    if (parent) onPick(parent);
    onPick(name);
    let next = recent;
    if (parent) next = pushRecentTag(parent);
    next = pushRecentTag(name);
    setRecent(next);
  }

  // フラットなタグ（人気/最近）のタップ。属なら階層へ誘導、品種なら上位属を補って挿入。
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
    const parent = findVarietyGenus(loaded, name);
    pick(name, parent !== null && parent.genus.pickable ? parent.genus.name : null);
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
  const q = query.trim().toLowerCase();

  // 検索: 品種カタログ＋世話/記録のクイックタグを横断（カタログ未読でもクイックは効く）。
  // 前方一致を先に: クイックの前方一致 → カタログ（内部で前方一致優先済）→ クイックの部分一致。
  const quickHits: VarietyHit[] = searching
    ? TAG_CATEGORIES.flatMap((c) =>
        c.tags
          .filter((t) => t.toLowerCase().includes(q))
          .map((t) => ({ name: t, category: c.label, kind: "variety" as const })),
      )
    : [];
  const quickPrefix = quickHits.filter((h) => h.name.toLowerCase().startsWith(q));
  const quickRest = quickHits.filter((h) => !h.name.toLowerCase().startsWith(q));
  const catalogHits = searching ? searchCatalog(catalog ?? [], query) : [];

  const hits: VarietyHit[] = [];
  const seen = new Set<string>();
  for (const h of [...quickPrefix, ...catalogHits, ...quickRest]) {
    const key = h.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(h);
    if (hits.length >= SEARCH_LIMIT) break;
  }
  const freeform = query.trim().replace(/^#+/, "").trim();
  const showFreeform = freeform !== "" && !hits.some((h) => h.name.toLowerCase() === freeform.toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ha-green-deep">タグを選ぶ</span>

      {!open ? (
        // ── 畳んだ状態: 最近・人気・世話/記録（0〜1タップ）＋ ドリルダウン入口 ──────
        <>
          {recent.length > 0 && (
            <ChipGroup label="最近使った">
              {recent.map((t) => (
                <Chip key={`recent-${t}`} label={t} active={has(t)} onClick={() => engage(t)} />
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
                  onClick={() => engage(t.tag)}
                />
              ))}
            </ChipGroup>
          )}

          {TAG_CATEGORIES.map((c) => (
            <ChipGroup key={c.label} label={c.label}>
              {c.tags.map((tag) => (
                <Chip key={`${c.label}-${tag}`} label={tag} active={has(tag)} onClick={() => pick(tag)} />
              ))}
            </ChipGroup>
          ))}

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
        </>
      ) : (
        // ── 展開状態: 検索（パネル内・全件横断）＋ カテゴリ→属→品種 ドリルダウン ──────
        <div className="glass flex flex-col gap-2 rounded-2xl p-3">
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
          <div className="relative">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ha-ink/40" />
            <ClearableInput
              value={query}
              onValueChange={handleQueryChange}
              aria-label="タグを検索"
              placeholder="品種・属・世話を検索（例: チタノタ）"
              className="rounded-full border border-white/30 bg-white/5 py-2 pl-9 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:border-ha-green/50 focus:outline-none"
            />
          </div>

          {searching ? (
            // ── 検索結果（属→階層へ・品種→上位属を補って挿入・freeform→そのまま） ──
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
                      onClick={() => engage(h.name)}
                      className="glass rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
                    >
                      #{h.name}
                      <span className="ml-1 text-[10px] text-ha-ink/40">{h.category}</span>
                      <span aria-hidden className="ml-1 text-ha-ink/40">›</span>
                    </button>
                  ) : (
                    <Chip
                      key={`v-${h.name}`}
                      label={h.name}
                      context={h.genus ?? h.category}
                      active={has(h.name)}
                      onClick={() => pick(h.name, h.genusPickable === true ? (h.genus ?? null) : null)}
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
            // 品種一覧（pickable な属はその属タグも先頭で使える）
            <div className="flex flex-wrap gap-1.5">
              {genus.pickable && (
                <button
                  type="button"
                  onClick={() => pick(genus.name)}
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
                  active={has(v.name)}
                  onClick={() => pick(v.name, genus.pickable ? genus.name : null)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
