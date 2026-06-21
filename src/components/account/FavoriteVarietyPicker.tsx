import { useEffect, useRef, useState } from "react";
import { searchCatalog } from "../../lib/plants/variety-search.ts";
import type { Genus, VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import Icon from "../ui/Icon.tsx";
import SciName from "../ui/SciName.tsx";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 好きな品種ピッカー（#141・複数選択）。TagPicker（投稿タグ＝本文へ挿入）の**選択ロジックを
 * テキスト挿入から分離**し、品種名のリスト（`selected`）を出し入れするだけにする
 * （プロフィール kind:0 の `favorite_varieties` 用・同好の士の手がかり・#131 人軸）。
 *
 * `variety-catalog`/`variety-search` の純ロジックを再利用し、カテゴリ→属→品種のドリルダウン＋
 * インクリメンタル検索で選ぶ。catalog は初期バンドルに載せず**動的 import**（TagPicker と同方針）。
 * タグでなく「好きな品種」なので**葉（品種/属）名だけ**を持つ＝カテゴリ前置はしない。
 */
export default function FavoriteVarietyPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT(useLocale());
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<VarietyCategory | null>(null);
  const [genus, setGenus] = useState<Genus | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const has = (name: string) => selected.includes(name);
  const toggle = (name: string) =>
    onChange(has(name) ? selected.filter((n) => n !== name) : [...selected, name]);

  async function ensureCatalog(): Promise<VarietyCategory[] | null> {
    if (catalog !== null) return catalog;
    setLoading(true);
    setError(false);
    try {
      const mod = await import("../../lib/plants/variety-catalog.ts");
      setCatalog(mod.VARIETY_CATALOG);
      return mod.VARIETY_CATALOG;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }

  // 囲みの外をクリックしたらドリルダウンを閉じる（TagPicker と同作法）。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current !== null && !panelRef.current.contains(e.target as Node)) closeDrill();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function openDrill() {
    setOpen(true);
    void ensureCatalog();
  }
  function closeDrill() {
    setOpen(false);
    setQuery("");
    setCat(null);
    setGenus(null);
  }
  function goBack() {
    if (query.trim() !== "") setQuery("");
    else if (genus !== null) setGenus(null);
    else if (cat !== null) setCat(null);
    else setOpen(false);
  }
  function handleQuery(v: string) {
    setQuery(v);
    if (v.trim() !== "") void ensureCatalog();
  }

  const searching = query.trim() !== "";
  const hits = searching ? searchCatalog(catalog ?? [], query) : [];
  const freeform = query.trim().replace(/^#+/, "").trim();
  // 既にヒットにある／既に選択済みの語には「そのまま追加」を出さない（押すと逆に外れる混乱を防ぐ）。
  const showFreeform =
    freeform !== "" &&
    !hits.some((h) => h.name.toLowerCase() === freeform.toLowerCase()) &&
    !selected.some((s) => s.toLowerCase() === freeform.toLowerCase());

  // トグル用の小さな選択チップ（選択済み＝緑塗り・再タップで外す）。
  const itemClass = (name: string) =>
    `inline-flex items-baseline rounded-full px-3 py-1 text-sm transition-colors ${
      has(name)
        ? "border border-ha-green bg-ha-green text-ha-white"
        : "glass text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep"
    }`;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ha-green-deep">{t("profile.favorites")}</span>
      <p className="text-xs text-ha-ink/55">
        {t("account.favorites.hint")}
      </p>

      {/* 選択済みの好きな品種（× で外す）。 */}
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((name) => (
            <li key={name}>
              <button
                type="button"
                onClick={() => toggle(name)}
                aria-label={t("account.favorites.removeAria", { name })}
                className="inline-flex items-center gap-1 rounded-full border border-ha-green bg-ha-green px-3 py-1 text-sm text-ha-white hover:brightness-110 transition"
              >
                {name}
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button
          type="button"
          onClick={openDrill}
          aria-expanded={false}
          className="glass flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium text-ha-green-deep hover:border-ha-green/50 transition-colors"
        >
          <Icon name="sprout" className="h-4 w-4" />
          {t("tag.fromPlants")}
          <span aria-hidden className="text-ha-ink/40">›</span>
        </button>
      ) : (
        <div ref={panelRef} className="glass flex flex-col gap-2 rounded-2xl p-3">
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
              onClick={closeDrill}
              aria-label={t("common.close")}
              className="grid h-7 w-7 place-items-center rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition-colors"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mb-1.5">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ha-ink/40" />
            <ClearableInput
              value={query}
              onValueChange={handleQuery}
              aria-label={t("account.favorites.search.aria")}
              placeholder={t("tag.search.placeholder")}
              className="rounded-full border border-white/30 bg-white/5 py-2 pl-9 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:border-ha-green/50 focus:outline-none"
            />
          </div>

          {searching ? (
            <div className="flex flex-wrap gap-1.5">
              {loading && catalog === null && <span className="text-xs text-ha-ink/45">{t("tag.dict.loading")}</span>}
              {error && <span className="text-xs text-ha-pink">{t("tag.dict.error")}</span>}
              {hits.length === 0 && !showFreeform && !loading && (
                <span className="text-xs text-ha-ink/45">{t("tag.noResults")}</span>
              )}
              {hits.map((h) => (
                <button key={`${h.kind}-${h.name}`} type="button" onClick={() => toggle(h.name)} aria-pressed={has(h.name)} className={itemClass(h.name)}>
                  <span className="shrink-0">{h.name}</span>
                  <span className={`ml-1 text-[10px] ${has(h.name) ? "text-ha-white/70" : "text-ha-ink/40"}`}>
                    {h.kind === "variety" ? (h.genus ?? h.category) : h.category}
                  </span>
                  {h.sci !== undefined && h.sci !== "" && (
                    <span aria-hidden data-sci className="ml-1 inline-block min-w-0 max-w-full truncate">
                      <SciName sci={h.sci} className={`text-[10px] ${has(h.name) ? "text-ha-white/70" : "text-ha-ink/40"}`} />
                    </span>
                  )}
                </button>
              ))}
              {showFreeform && (
                <button
                  type="button"
                  onClick={() => toggle(freeform)}
                  className="rounded-full border border-dashed border-ha-green/50 px-3 py-1 text-sm text-ha-green-deep hover:bg-ha-green/10 transition-colors"
                >
                  {t("account.favorites.useFreeform", { freeform })}
                </button>
              )}
            </div>
          ) : catalog === null ? (
            <span className="px-1 py-2 text-xs text-ha-ink/45">
              {error ? t("tag.dict.error") : loading ? t("tag.dict.loading") : t("account.favorites.dict.empty")}
            </span>
          ) : cat === null ? (
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((c) => (
                <button key={c.label} type="button" onClick={() => setCat(c)} className="glass rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors">
                  {c.label} <span aria-hidden className="text-ha-ink/40">›</span>
                </button>
              ))}
            </div>
          ) : genus === null ? (
            <div className="flex flex-wrap gap-1.5">
              {cat.genera.map((g) => (
                <button key={g.name} type="button" onClick={() => setGenus(g)} className="glass rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors">
                  {g.name}
                  <span className="ml-1 text-[10px] text-ha-ink/40">{g.varieties.length}</span>
                  <span aria-hidden className="ml-1 text-ha-ink/40">›</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {genus.pickable && (
                <button type="button" onClick={() => toggle(genus.name)} aria-pressed={has(genus.name)} className={itemClass(genus.name)}>
                  {genus.name}
                </button>
              )}
              {genus.varieties.map((v) => (
                <button key={v.name} type="button" onClick={() => toggle(v.name)} aria-pressed={has(v.name)} className={itemClass(v.name)}>
                  <span className="shrink-0">{v.name}</span>
                  {v.sci !== undefined && v.sci !== "" && (
                    <span aria-hidden data-sci className="ml-1 inline-block min-w-0 max-w-full truncate">
                      <SciName sci={v.sci} className={`text-[10px] ${has(v.name) ? "text-ha-white/70" : "text-ha-ink/40"}`} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
