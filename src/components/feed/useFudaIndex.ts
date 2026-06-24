import { useEffect, useMemo, useState } from "react";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { buildVarietyIndex, type FudaIndex } from "../../lib/plants/fuda.ts";

/**
 * 札解決の索引（`FudaIndex`）を用意するフック（#257）。グリッド単位で**1回だけ**作り、
 * 各 PostCard へ配る（カードごとに索引を作り直さない＝旧 buildFuda はカード数ぶん再構築していた）。
 *
 * 品種カタログ（~2,000品種＋別名・重い chunk）は1回だけ動的 import する（カードごとに import しない）。
 * 非同期＝呼び出し側は即描画でき、札はロード後にふっと出る（グレースフル）。失敗時は null＝札を出さないだけ。
 * catalog は安定なので索引は `useMemo` でメモする（catalog 全走査を毎レンダーで繰り返さない）。
 *
 * VarietyFilter（discover の絞り込みチップ）も `hashtagLoc` 経由で #タグ表示の翻訳に使う（#460/#464）。
 */
export function useFudaIndex(): FudaIndex | null {
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    import("../../lib/plants/variety-catalog.ts")
      .then((mod) => {
        if (alive) setCatalog(mod.VARIETY_CATALOG);
      })
      .catch(() => {
        /* 札を出さないだけ（catalog は null のまま）。 */
      });
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(() => (catalog ? buildVarietyIndex(catalog) : null), [catalog]);
}
