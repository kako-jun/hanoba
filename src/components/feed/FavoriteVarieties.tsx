import { useEffect, useMemo, useState } from "react";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { buildVarietyIndex, fudaForName, type Fuda } from "../../lib/plants/fuda.ts";
import FudaList from "./FudaList.tsx";

/**
 * プロフィールの「好きな品種」（#343）を**投稿の札と同じ `FudaList`** で出す。各名称を品種カタログから
 * **学名の植物札**に解決し（#459＝札は学名のみ）、discover リンクも投稿の札と同じ（属＋品種の AND・属単独は属）。
 * **学名がどこからも引けない名前は札にしない**（所有札一覧に乗る資格は学名のある植物だけ・和名へ倒さない）。
 *
 * catalog は初期バンドルに載せず動的 import（PostGrid/CitizenStats と同型）。未ロード中は何も出さない
 * （和名を先に出して学名に差し替える二重表示はしない）＝ロード後に学名札が出る。
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
        /* 解決できない＝何も出さない（catalog は null のまま・グレースフル）。 */
      });
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => (catalog ? buildVarietyIndex(catalog) : null), [catalog]);
  // 学名が引ける名前だけ札にする（#459）。catalog 未ロード中は空（和名フォールバックを出さない）。
  const fuda: Fuda[] = useMemo(
    () =>
      index === null
        ? []
        : varieties.map((name) => fudaForName(name, index)).filter((f): f is Fuda => f !== null),
    [varieties, index],
  );

  if (fuda.length === 0) return null;
  return <FudaList fuda={fuda} />;
}
