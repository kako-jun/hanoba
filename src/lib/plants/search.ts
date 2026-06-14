// 植物の別名 OR 検索（#23 Phase 2）の純粋関数。
//
// 「パキポ」「Pachypodium」「グラキリス」のどれで検索/クリックしても、その植物の
// 全表記（名前・学名・別名）を横断して拾えるよう、検索語を植物エントリへ解決し、
// タグ OR フィルタ用の値群を返す。relay 呼び出しは client の責務。

import { PLANTS, type PlantEntry } from "./dictionary.ts";

/**
 * 検索語（先頭 # は無視）に一致する植物を返す。完全一致（大小無視）。無ければ null。
 * 例: "パキポ" / "#pachypodium" / "グラキリス" → 対応エントリ。
 */
export function findPlantByTerm(term: string): PlantEntry | null {
  const t = term
    .trim()
    .replace(/^#+/, "")
    .trim()
    .toLowerCase();
  if (t === "") return null;
  for (const p of PLANTS) {
    const needles = [p.name, p.sci, ...p.aliases].map((s) => s.toLowerCase());
    if (needles.includes(t)) return p;
  }
  return null;
}

/**
 * `#t` フィルタ（OR 検索）用のタグ値。名前＋別名＋単語の学名のうち、
 * **空白を含まない**もの（＝タグになり得るもの）だけを重複なしで返す。
 * 学名の "Pachypodium rosulatum var. gracilius" のような空白入りは除外。
 */
export function plantTagValues(entry: PlantEntry): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of [entry.name, entry.sci, ...entry.aliases]) {
    if (v.includes(" ")) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
