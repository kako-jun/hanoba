import { useEffect, useState, type ReactNode } from "react";
import type { RankedTag } from "../../lib/feed/popular.ts";
import { getRecentTags, pushRecentTag } from "../../lib/plants/recent-tags.ts";
import { TAG_CATEGORIES } from "../../lib/plants/tag-catalog.ts";
import type { Genus, VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { searchCatalog, type VarietyHit } from "../../lib/plants/variety-search.ts";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import Icon from "../ui/Icon.tsx";

interface Props {
  /** 人気タグ（relay 集計・上位）。空なら人気セクションは出さない。 */
  popular: RankedTag[];
  /** チップを選んだとき（本文へ挿入する）。 */
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

function Chip({ label, onClick, sizeClass = "text-sm", context }: {
  label: string;
  onClick: () => void;
  sizeClass?: string;
  /** 同名タグの曖昧さ回避に出す小さな文脈（属/カテゴリ）。 */
  context?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass rounded-full px-3 py-1 ${sizeClass} text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors`}
    >
      #{label}
      {context !== undefined && <span className="ml-1 text-[10px] text-ha-ink/40">{context}</span>}
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
 * タグピッカー（#22 / #143 / #144）。手打ちをやめ、検索・最近・人気・世話/記録に加えて、
 * 1,400件超の品種カタログ（variety-catalog）を**動的 import で code-split**し、
 * カテゴリ→属→品種の多段ドリルダウンで少クリック選択する。
 * 値は本文に `#タグ` テキストとして入るだけ（DESIGN §6・t 化しない）。
 */
export default function TagPicker({ popular, onPick }: Props) {
  const max = popular.length > 0 ? Math.max(...popular.map((t) => t.count)) : 1;

  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  // 品種カタログは初期バンドルに載せず、検索/ドリルダウンを開いた時だけ動的 import する。
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  // ドリルダウンの開閉と現在地（カテゴリ→属→品種）。
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<VarietyCategory | null>(null);
  const [genus, setGenus] = useState<Genus | null>(null);

  // 最近使ったは localStorage（実行時状態）。SSR 安全にマウント後だけ読む。
  useEffect(() => {
    setRecent(getRecentTags());
  }, []);

  // 品種カタログを必要時に一度だけ読み込む（既読/読込中なら何もしない）。
  async function ensureCatalog() {
    if (catalog !== null || loadingCatalog) return;
    setLoadingCatalog(true);
    try {
      const mod = await import("../../lib/plants/variety-catalog.ts");
      setCatalog(mod.VARIETY_CATALOG);
    } finally {
      setLoadingCatalog(false);
    }
  }

  // タグ挿入＝本文へ入れて最近使ったを更新する（全ピック経路で通す）。
  function pick(tag: string) {
    onPick(tag);
    setRecent(pushRecentTag(tag));
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    if (v.trim() !== "") void ensureCatalog();
  }

  function openDrilldown() {
    setOpen(true);
    void ensureCatalog();
  }

  // ‹戻る: 品種→属→カテゴリ→閉じる の順に1段ずつ戻す。
  function goBack() {
    if (genus !== null) setGenus(null);
    else if (cat !== null) setCat(null);
    else setOpen(false);
  }

  function closeDrilldown() {
    setOpen(false);
    setCat(null);
    setGenus(null);
  }

  const searching = query.trim() !== "";

  // 検索: 品種カタログ＋世話/記録のクイックタグを横断（カタログ未読でもクイックは効く）。
  const quickHits: VarietyHit[] = searching
    ? TAG_CATEGORIES.flatMap((c) =>
        c.tags
          .filter((t) => t.toLowerCase().includes(query.trim().toLowerCase()))
          .map((t) => ({ name: t, category: c.label, kind: "variety" as const })),
      )
    : [];
  const catalogHits = searching ? searchCatalog(catalog ?? [], query) : [];
  const hits: VarietyHit[] = [];
  const seen = new Set<string>();
  for (const h of [...quickHits, ...catalogHits]) {
    const key = h.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(h);
    if (hits.length >= 40) break;
  }
  const freeform = query.trim().replace(/^#+/, "").trim();
  const showFreeform = freeform !== "" && !hits.some((h) => h.name.toLowerCase() === freeform.toLowerCase());

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ha-green-deep">タグを選ぶ</span>

      {/* 🔍 全件横断の検索（抜け道）。常設。 */}
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ha-ink/40" />
        <ClearableInput
          value={query}
          onValueChange={handleQueryChange}
          aria-label="タグを検索"
          placeholder="品種・属・世話を検索（例: チタノタ）"
          className="glass rounded-full bg-transparent py-2 pl-9 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:border-ha-green/50 focus:outline-none"
        />
      </div>

      {searching ? (
        // ── 検索結果（ドリルダウンより優先） ──────────────────────────
        <div className="flex flex-col gap-1.5">
          {loadingCatalog && catalog === null && (
            <span className="text-xs text-ha-ink/45">辞書を読み込み中…</span>
          )}
          {hits.length === 0 && !showFreeform && !loadingCatalog && (
            <span className="text-xs text-ha-ink/45">該当なし</span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {hits.map((h) => (
              <Chip
                key={`${h.kind}-${h.name}`}
                label={h.name}
                context={h.genus ?? h.category}
                onClick={() => pick(h.name)}
              />
            ))}
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
      ) : (
        // ── 通常（最近・人気・クイック・ドリルダウン入口） ──────────────
        <>
          {recent.length > 0 && (
            <ChipGroup label="最近使った">
              {recent.map((t) => (
                <Chip key={`recent-${t}`} label={t} onClick={() => pick(t)} />
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
                  onClick={() => pick(t.tag)}
                />
              ))}
            </ChipGroup>
          )}

          {TAG_CATEGORIES.map((c) => (
            <ChipGroup key={c.label} label={c.label}>
              {c.tags.map((tag) => (
                <Chip key={`${c.label}-${tag}`} label={tag} onClick={() => pick(tag)} />
              ))}
            </ChipGroup>
          ))}

          {/* 植物（1,400件超）はドリルダウンの中だけに置き、常時は小さく畳む。 */}
          {!open ? (
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
          ) : (
            <Drilldown
              catalog={catalog}
              loading={loadingCatalog}
              cat={cat}
              genus={genus}
              onBack={goBack}
              onClose={closeDrilldown}
              onSelectCategory={setCat}
              onSelectGenus={setGenus}
              onPick={pick}
            />
          )}
        </>
      )}
    </div>
  );
}

/** ドリルダウン本体（カテゴリ→属→品種・パンくず＋戻る・面積節約のインライン展開）。 */
function Drilldown({
  catalog,
  loading,
  cat,
  genus,
  onBack,
  onClose,
  onSelectCategory,
  onSelectGenus,
  onPick,
}: {
  catalog: VarietyCategory[] | null;
  loading: boolean;
  cat: VarietyCategory | null;
  genus: Genus | null;
  onBack: () => void;
  onClose: () => void;
  onSelectCategory: (c: VarietyCategory) => void;
  onSelectGenus: (g: Genus) => void;
  onPick: (tag: string) => void;
}) {
  return (
    <div className="glass flex flex-col gap-2 rounded-2xl p-3">
      {/* ヘッダ: ‹戻る ＋ パンくず ＋ ×閉じる */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-2 py-1 text-sm text-ha-ink/70 hover:text-ha-green-deep transition-colors"
        >
          ‹ 戻る
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-xs text-ha-ink/55">
          植物{cat ? ` › ${cat.label}` : ""}{genus ? ` › ${genus.name}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="ドリルダウンを閉じる"
          className="grid h-7 w-7 place-items-center rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors"
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>

      {catalog === null ? (
        <span className="px-1 py-2 text-xs text-ha-ink/45">{loading ? "辞書を読み込み中…" : "—"}</span>
      ) : cat === null ? (
        // カテゴリ一覧
        <div className="flex flex-wrap gap-1.5">
          {catalog.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => onSelectCategory(c)}
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
              onClick={() => onSelectGenus(g)}
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
              onClick={() => onPick(genus.name)}
              className="rounded-full border border-ha-green/60 bg-ha-green/10 px-3 py-1 text-sm font-medium text-ha-green-deep hover:bg-ha-green/20 transition-colors"
            >
              #{genus.name} をこのまま使う
            </button>
          )}
          {genus.varieties.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => onPick(v.name)}
              className="glass rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors"
            >
              #{v.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
