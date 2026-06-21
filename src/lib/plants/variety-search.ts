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

/**
 * 選んだタグ `name` を本文へ入れるとき、**概要→詳細の全階層**を順に返す（#312・kako-jun
 * 「ドリルダウンで1回押した言葉がタグにならないのは直感に反する」＝カテゴリ・属もタグにする。
 * #181/#166 の『カテゴリはタグにしない』を反転）。
 * - 品種: `[カテゴリ, 属(pickable のみ), 品種]`（例 グラキリス → 塊根植物・パキポディウム・グラキリス）
 * - pickable 属: `[カテゴリ, 属]`
 * - カテゴリ: `[カテゴリ]`
 * - catalog に無い（世話/記録/freeform 等）: `[name]`（前置しない）
 * 重複は畳む（品種名＝属名/カテゴリ名が一致するデータでも二重に返さない）。
 * filter モード・catalog 未ロードは呼び出し側で `[name]` に倒す（葉のみ＝AND で過剰に絞らない）。
 */
export function tagsToPick(catalog: VarietyCategory[], name: string): string[] {
  const vloc = findVarietyGenus(catalog, name);
  if (vloc !== null) {
    const out = [vloc.category.label];
    if (vloc.genus.pickable) out.push(vloc.genus.name);
    out.push(name);
    return [...new Set(out)];
  }
  const gloc = findPickableGenus(catalog, name);
  if (gloc !== null) return [...new Set([gloc.category.label, name])];
  // カテゴリ単独（pickable 属/品種でない＝カテゴリ label）はそれ自身を1タグに。
  if (catalog.some((c) => c.label === name)) return [name];
  return [name];
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
  /** 学名（品種ヒットで catalog に sci があるとき・併記表示用 #200）。属ヒット・sci 無しでは undefined。 */
  sci?: string;
  kind: "genus" | "variety" | "category";
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
    // カテゴリ自身もヒット対象にする（#312・「ハーブ」と打って `#ハーブ` を直接付けられる＝
    // ドリルダウンで止めるのと同じ・品種名が分からない人のため）。タグ文字列＝カテゴリ label。
    consider({ name: cat.label, category: cat.label, kind: "category" }, [cat.label]);
    for (const g of cat.genera) {
      if (g.pickable) {
        consider(
          { name: g.name, category: cat.label, kind: "genus" },
          [g.name, ...(g.aliases ?? [])],
        );
      }
      for (const v of g.varieties) {
        consider(
          { name: v.name, category: cat.label, genus: g.name, genusPickable: g.pickable, sci: v.sci, kind: "variety" },
          [v.name, ...(v.aliases ?? [])],
        );
      }
    }
  }

  return [...prefix, ...substr].slice(0, limit);
}

/**
 * `category` 内で `targetGenus` 以外に生存（他属の属タグ or 他属の品種タグ）が残るか。
 * カテゴリタグを連動撤去してよいか（＝他に何も残らないか）の判定に使う（#144/#312）。
 */
function categoryHasOtherSurvivor(
  caption: string,
  category: VarietyCategory,
  targetGenus: Genus,
): boolean {
  return category.genera.some((g) => {
    if (g === targetGenus) return false;
    // 属タグ。ただし属名がカテゴリ label と同字なら、その `#タグ` はカテゴリタグと文字列で
    // 区別できない（#312 衝突ガード）＝独立した属の証拠にならないので数えない。
    if (g.pickable && g.name !== category.label && captionHasTag(caption, g.name)) return true;
    // 品種タグ。カテゴリ label・その属名と同字の品種は、カテゴリ/属タグと区別できないので数えない。
    return g.varieties.some(
      (v) => v.name !== category.label && v.name !== g.name && captionHasTag(caption, v.name),
    );
  });
}

/**
 * 選択済みのタグを外すとき、連動して外すタグ名の一覧を返す（兄弟ルール・#144・#312）。
 * - name は必ず含む。
 * - name が**品種**で、外した後その属に**他の品種タグ**が本文に残らなければ、属タグも外す
 *   （pickable かつ本文にある時）。さらにそのカテゴリに他属の品種/属タグが残らなければカテゴリも外す。
 * - name が**pickable 属**（#312・属もカテゴリと一緒に付くようになった）で、そのカテゴリに
 *   他属の生存が残らなければ**カテゴリも連動撤去**する（属だけ残してカテゴリを孤立させない）。
 * - name がカテゴリ/世話など属でも品種でもない、または catalog 未ロード時は name 単体（上位は触らない）。
 * `caption` は外す前の本文（name 以外の生存判定に使う）。
 */
export function tagsToUnpick(
  caption: string,
  name: string,
  catalog: VarietyCategory[] | null,
): string[] {
  if (catalog === null) return [name];

  // ── 品種を外す: 兄弟が残らなければ属→カテゴリへ連動撤去（既存ロジック・#144） ──
  const vloc = findVarietyGenus(catalog, name);
  if (vloc !== null) {
    const { category, genus } = vloc;
    const result = [name];
    // 同属の他品種が残るなら上位はそのまま（兄弟が居れば残る）。ただし **カテゴリ label・属名と
    // 同字の品種**（例 エアプランツ›チランジア›「エアプランツ」／ビカクシダ›原種›「ビカクシダ」）は、
    // その `#タグ` が #312 で入るカテゴリ/属タグと文字列で区別できない＝偽の兄弟として数えない
    // （これを数えると、品種を外してもカテゴリ/属が孤立して残る #312 のリグレッションになる）。
    const siblingRemains = genus.varieties.some(
      (v) =>
        v.name !== name &&
        v.name !== category.label &&
        v.name !== genus.name &&
        captionHasTag(caption, v.name),
    );
    if (siblingRemains) return result;
    if (genus.pickable && captionHasTag(caption, genus.name)) result.push(genus.name);
    if (!categoryHasOtherSurvivor(caption, category, genus) && captionHasTag(caption, category.label)) {
      result.push(category.label);
    }
    // 品種名＝カテゴリ名/属名が一致するデータ（例: エアプランツ）でも重複を返さない。
    return [...new Set(result)];
  }

  // ── 属を外す（#312・属はカテゴリと一緒に付くのでカテゴリも連動撤去） ──
  const gloc = findPickableGenus(catalog, name);
  if (gloc !== null) {
    const { category, genus } = gloc;
    const result = [name];
    if (!categoryHasOtherSurvivor(caption, category, genus) && captionHasTag(caption, category.label)) {
      result.push(category.label);
    }
    return [...new Set(result)];
  }

  // カテゴリ直/世話/freeform は自分だけ（上位は無い・下位は触らない）。
  return [name];
}
