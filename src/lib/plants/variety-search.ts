// 品種カタログ（#143）の横断検索（純関数）。
//
// TagPicker（#144）の 🔍 検索ボックス＝1,400件からの抜け道。`catalog` を**引数で受ける**ことで
// このモジュールは variety-catalog を静的 import せず、データの code-split を壊さない
// （呼び出し側が `await import("./variety-catalog.ts")` してから渡す）。

import type { VarietyCategory } from "./variety-catalog.ts";

/** 検索ヒット1件（属 or 品種）。name がそのまま本文 # に入るタグ。 */
export interface VarietyHit {
  /** 挿入するタグ文字列（属名 or 品種名）。 */
  name: string;
  /** 由来カテゴリ名（文脈表示用）。 */
  category: string;
  /** 由来属名（品種ヒットのとき）。属ヒットでは undefined。 */
  genus?: string;
  kind: "genus" | "variety";
}

/** 検索語の正規化（前後空白・先頭 # を落として小文字化）。 */
function normalizeQuery(query: string): string {
  return query.trim().replace(/^#+/, "").trim().toLowerCase();
}

/**
 * `catalog` を query で横断検索する。属（pickable のみ）と品種の name・aliases を対象に、
 * 部分一致で拾い、**前方一致を先**に並べる。タグ文字列（name）でユニーク化し最大 `limit` 件。
 * 空クエリは空配列。
 */
export function searchCatalog(catalog: VarietyCategory[], query: string, limit = 40): VarietyHit[] {
  const q = normalizeQuery(query);
  if (q === "") return [];

  const prefix: VarietyHit[] = [];
  const substr: VarietyHit[] = [];
  const seen = new Set<string>();

  const consider = (hit: VarietyHit, candidates: string[]) => {
    const key = hit.name.toLowerCase();
    if (seen.has(key)) return;
    let matched = false;
    let isPrefix = false;
    for (const c of candidates) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q)) {
        matched = true;
        isPrefix = true;
        break;
      }
      if (lc.includes(q)) matched = true;
    }
    if (!matched) return;
    seen.add(key);
    (isPrefix ? prefix : substr).push(hit);
  };

  for (const cat of catalog) {
    for (const g of cat.genera) {
      if (g.pickable) {
        consider(
          { name: g.name, category: cat.label, kind: "genus" },
          [g.name, ...(g.aliases ?? [])],
        );
      }
      for (const v of g.varieties) {
        consider(
          { name: v.name, category: cat.label, genus: g.name, kind: "variety" },
          [v.name, ...(v.aliases ?? [])],
        );
      }
    }
  }

  return [...prefix, ...substr].slice(0, limit);
}
