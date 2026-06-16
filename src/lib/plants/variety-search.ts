// 品種カタログ（#143）の横断検索（純関数）。
//
// TagPicker（#144）の 🔍 検索ボックス＝1,400件からの抜け道。`catalog` を**引数で受ける**ことで
// このモジュールは variety-catalog を静的 import せず、データの code-split を壊さない
// （呼び出し側が `await import("./variety-catalog.ts")` してから渡す）。

import { captionHasTag } from "../image/hashtag-complete.ts";
import type { Genus, VarietyCategory } from "./variety-catalog.ts";

/** 属 or 品種の所在（カテゴリ＋属）。階層への誘導・上位属の補完に使う。 */
export interface CatalogLocation {
  category: VarietyCategory;
  genus: Genus;
}

/** name に完全一致する **pickable な属** の所在を返す（無ければ null・大小無視）。 */
export function findPickableGenus(catalog: VarietyCategory[], name: string): CatalogLocation | null {
  const n = name.trim().toLowerCase();
  for (const category of catalog) {
    for (const genus of category.genera) {
      if (!genus.pickable) continue;
      const names = [genus.name, ...(genus.aliases ?? [])].map((s) => s.toLowerCase());
      if (names.includes(n)) return { category, genus };
    }
  }
  return null;
}

/** name に完全一致する **品種** を含む属の所在を返す（無ければ null・大小無視）。 */
export function findVarietyGenus(catalog: VarietyCategory[], name: string): CatalogLocation | null {
  const n = name.trim().toLowerCase();
  for (const category of catalog) {
    for (const genus of category.genera) {
      for (const v of genus.varieties) {
        const names = [v.name, ...(v.aliases ?? [])].map((s) => s.toLowerCase());
        if (names.includes(n)) return { category, genus };
      }
    }
  }
  return null;
}

/** 検索結果の表示上限（TagPicker と共有）。 */
export const SEARCH_LIMIT = 40;

/** 検索ヒット1件（属 or 品種）。name がそのまま本文 # に入るタグ。 */
export interface VarietyHit {
  /** 挿入するタグ文字列（属名 or 品種名）。 */
  name: string;
  /** 由来カテゴリ名（文脈表示用）。 */
  category: string;
  /** 由来属名（品種ヒットのとき）。属ヒットでは undefined。 */
  genus?: string;
  /** 由来属が pickable か（品種ヒットで上位属タグを前置できるか）。 */
  genusPickable?: boolean;
  kind: "genus" | "variety";
}

/**
 * 検索用フォールド: ひらがな/カタカナ・大文字小文字・全角/半角の違いを無視する。
 * NFKC（全半角・半角カナを統一）→ 小文字化 → カタカナをひらがなへ寄せる。
 * 例: 「パキポ」「ぱきぽ」「ﾊﾟｷﾎﾟ」「ＰＡＣＨＹ」「pachy」が同じ土俵で一致する。
 */
export function foldForSearch(s: string): string {
  const nfkc = s.normalize("NFKC").toLowerCase();
  return nfkc.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 検索語の正規化（前後空白・先頭 # を落としてフォールド）。 */
function normalizeQuery(query: string): string {
  return foldForSearch(query.trim().replace(/^#+/, "").trim());
}

/**
 * `catalog` を query で横断検索する。属（pickable のみ）と品種の name・aliases を対象に、
 * 部分一致で拾い、**前方一致を先**に並べる。タグ文字列（name）でユニーク化し最大 `limit` 件。
 * 空クエリは空配列。
 */
export function searchCatalog(catalog: VarietyCategory[], query: string, limit = SEARCH_LIMIT): VarietyHit[] {
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
      const lc = foldForSearch(c);
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
          { name: v.name, category: cat.label, genus: g.name, genusPickable: g.pickable, kind: "variety" },
          [v.name, ...(v.aliases ?? [])],
        );
      }
    }
  }

  return [...prefix, ...substr].slice(0, limit);
}

/**
 * 選択済みの品種タグを外すとき、連動して外すタグ名の一覧を返す（兄弟ルール・#144）。
 * - name は必ず含む。
 * - name が**品種**で、外した後その属に**他の品種タグ**が本文に残らなければ、属タグも外す
 *   （pickable かつ本文にある時）。さらにそのカテゴリに他属の品種/属タグが残らなければカテゴリも外す。
 * - name が属/世話など品種でない、または catalog 未ロード時は name 単体（上位は触らない）。
 * `caption` は外す前の本文（name 以外の生存判定に使う）。
 */
export function tagsToUnpick(
  caption: string,
  name: string,
  catalog: VarietyCategory[] | null,
): string[] {
  if (catalog === null) return [name];
  const loc = findVarietyGenus(catalog, name);
  if (loc === null) return [name];
  const { category, genus } = loc;
  const result = [name];

  // 同属の他品種が残るなら上位はそのまま（兄弟が居れば残る）。
  const siblingRemains = genus.varieties.some((v) => v.name !== name && captionHasTag(caption, v.name));
  if (siblingRemains) return result;

  if (genus.pickable && captionHasTag(caption, genus.name)) result.push(genus.name);

  // カテゴリ内に他属の生存（他属タグ or 他属の品種）が残るならカテゴリは残す。
  const categoryRemains = category.genera.some((g) => {
    if (g === genus) return false;
    if (g.pickable && captionHasTag(caption, g.name)) return true;
    return g.varieties.some((v) => captionHasTag(caption, v.name));
  });
  if (!categoryRemains && captionHasTag(caption, category.label)) result.push(category.label);

  // 品種名＝カテゴリ名/属名が一致するデータ（例: エアプランツ）でも重複を返さない。
  return [...new Set(result)];
}
