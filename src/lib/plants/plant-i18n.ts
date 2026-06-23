// 品種カタログの表示名を閲覧言語で引く純関数（#409 P2 多言語）。
//
// hanoba はバックエンドレス・静的サイトなので i18n も zero-dep（locale.ts と同じ流儀）。
// ここは **表示専用** の薄いヘルパ＝relay 不関与・状態を持たない純関数（guidelines §3）。
//
// **独自化禁止（cross-language filter 要件）**: 本文に書き込むタグ・内部キー・`tagsToPick`/
// `tagsToPickAt` が返す値は常に ja 正準のまま。ここで訳すのは **画面に出す文字列だけ**。
// 誰がどの言語で見ても同じ canonical タグ（日本語）を書き込む＝言語を跨いでも同じ #タグで繋がる。

import type { Locale } from "../i18n/locale.ts";
import type { Genus, Loc, Variety, VarietyCategory } from "./variety-catalog.ts";

/**
 * base（ja 原典）と loc（閲覧言語ごとの表示名）から、locale の表示名を引く純関数。
 * - `ja` は常に base を返す（原典）。
 * - 非対応言語名（loc に無い）は base にフォールバックする（graceful・#384 t.ts と同じ方針）。
 * 表示専用＝書き込むタグ・内部キーには使わない（cross-language filter 要件）。
 */
export function pickLoc(base: string, loc: Loc | undefined, locale: Locale): string {
  if (locale === "ja") return base;
  return loc?.[locale] ?? base;
}

/** カテゴリの表示名（閲覧言語）。内部キーは `cat.label`（ja 正準）のまま使うこと。 */
export function categoryLabel(cat: VarietyCategory, locale: Locale): string {
  return pickLoc(cat.label, cat.loc, locale);
}

/** 属の表示名（閲覧言語）。本PR（PR1）では属 loc は未 populate＝base へ素通り（PR2 で属222を入れる）。 */
export function genusLabel(genus: Genus, locale: Locale): string {
  return pickLoc(genus.name, genus.loc, locale);
}

/** 品種の表示名（閲覧言語）。品種 loc は基本未 populate（大半が固有名詞）＝base へ素通り。 */
export function varietyLabel(variety: Variety, locale: Locale): string {
  return pickLoc(variety.name, variety.loc, locale);
}
