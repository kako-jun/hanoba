// 品種カタログの表示名を閲覧言語で引く純関数（#409 P2 多言語）。
//
// hanoba はバックエンドレス・静的サイトなので i18n も zero-dep（locale.ts と同じ流儀）。
// ここは **表示専用** の薄いヘルパ＝relay 不関与・状態を持たない純関数（guidelines §3）。
//
// **独自化禁止（cross-language filter 要件）**: 本文に書き込むタグ・内部キー・`tagsToPick`/
// `tagsToPickAt` が返す値は常に ja 正準のまま。ここで訳すのは **画面に出す文字列だけ**。
// 誰がどの言語で見ても同じ canonical タグ（日本語）を書き込む＝言語を跨いでも同じ #タグで繋がる。

import type { Locale } from "../i18n/locale.ts";
import { normFudaKey } from "./fuda.ts";
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

/**
 * ハッシュタグ（投稿の #タグ）の**表示**を閲覧言語に訳す（#460）。`hashtagLoc` は `buildVarietyIndex` が
 * 作る「正規化キー → Loc」マップ（カテゴリ label・pickable 属名+alias だけが入る）。
 *
 * - `ja` は常に原典 `tag` を返す（#409 cross-language filter＝ja 正準）。
 * - 非 ja は `hashtagLoc.get(normFudaKey(tag))` を引き、`loc[locale]` が非空文字列ならそれを返す
 *   （カテゴリ → loc.en・属 → 学名/英属名）。
 * - マップに無い（品種・様式・世話・辞書外）タグや、その言語の loc が無い/空文字のタグは `tag` のまま。
 *
 * **表示専用**＝戻り値は画面に出す文字列だけに使う。`onSelectHashtag`・href・React key・filter には
 * 常に元の ja 正準 `tag` を使うこと（言語を跨いでも同じ #タグで繋がる＝独自化禁止）。
 */
export function localizeHashtag(tag: string, locale: Locale, hashtagLoc: Map<string, Loc>): string {
  if (locale === "ja") return tag;
  const loc = hashtagLoc.get(normFudaKey(tag));
  const localized = loc?.[locale];
  return typeof localized === "string" && localized !== "" ? localized : tag;
}
