import { useEffect, useMemo, useState } from "react";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { buildVarietyIndex, fudaForName, type Fuda } from "../../lib/plants/fuda.ts";
import FudaList from "./FudaList.tsx";

/**
 * プロフィールの「好きな品種」（#343）を**投稿の札と同じ `FudaList`** で出す。各名称を品種カタログから
 * 学名＋和名の植物札に解決し、discover リンクも投稿の札と同じ（属＋品種の AND・属単独は属）。
 * カタログ外の自由入力品種は**消さず**和名のみの札へフォールバックする。
 *
 * catalog は初期バンドルに載せず動的 import（PostGrid/CitizenStats と同型）。未ロード中は和名のみの札を
 * 先に出す（チップが消えてから出る flash を避ける）＝ロード後に学名が補われる。
 */
export default function FavoriteVarieties({ varieties }: { varieties: string[] }) {
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    import("../../lib/plants/variety-catalog.ts")
      .then((mod) => {
        if (alive) setCatalog(mod.VARIETY_CATALOG);
      })
      .catch(() => {
        /* 和名のみで出す（catalog は null のまま・グレースフル）。 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => (catalog ? buildVarietyIndex(catalog) : null), [catalog]);
  const fuda: Fuda[] = useMemo(
    () =>
      varieties.map((name) =>
        index !== null ? fudaForName(name, index) : { key: name, name, sci: null, filterTags: [name] },
      ),
    [varieties, index],
  );

  if (varieties.length === 0) return null;
  return <FudaList fuda={fuda} />;
}
