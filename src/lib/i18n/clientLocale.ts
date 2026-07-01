// クライアント側の表示言語の解決・保存（#147 段階2 go-live）。
//
// hanoba はバックエンドレス・静的サイト（殻は既定言語＝go-live で en でビルド）。表示言語の切替は
// localStorage に保存した「ユーザーが選んだ言語」をクライアントで読むだけ＝Twitter モデル
// （URL は同じ・/en/ ルーティングは作らない）。サーバ（.astro）は触らない（単一責務）。
//
// 保存が無い初回は navigator の優先言語から対応言語を auto-detect する（#482）。日本語 OS/ブラウザなら
// 最初から ja を当てる（en に落とさない）。検出結果は localStorage に書かない（＝「ユーザーが明示的に
// 選んだ」状態と「自動検出で当たっただけ」を混同しない・Twitter モデル維持。保存は setClientLocale だけ）。

import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale.ts";

/** 表示言語の保存キー（is:inline 殻入替スクリプトとも一致させる＝文字列を二重持ちしない）。 */
export const LOCALE_STORAGE_KEY = "hanoba:lang";

/**
 * navigator の優先言語（`navigator.languages` を優先、無ければ `navigator.language`）を走査し、
 * 対応言語（`LOCALES`）に一致する最初のものを返す。無ければ `DEFAULT_LOCALE`（#482）。
 *
 * `navigator.languages`（優先リスト全体）を見るのは、Android Chrome が `navigator.language` に
 * ブラウザ UI 言語を返すため（OS が ja でもブラウザ設定が en だと ja を取りこぼす）。`ja-JP` 等は
 * 先頭 subtag（`ja`）へ正規化して判定する。is:inline 殻入替スクリプト（MainLayout.astro）とロジックを
 * 揃える（島と殻で解決が食い違うとフラッシュ・不一致になる）。
 */
export function detectClientLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const langs: readonly string[] =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : typeof navigator.language === "string"
        ? [navigator.language]
        : [];
  for (const l of langs) {
    const primary = String(l).toLowerCase().split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}

/**
 * 表示言語を解決する。localStorage の保存値（＝ユーザーが選んだ言語）を最優先、無ければ navigator から
 * auto-detect（#482）、それも対応外なら `DEFAULT_LOCALE`（go-live で en）。
 */
export function resolveClientLocale(): Locale {
  if (typeof localStorage === "undefined") return detectClientLocale();
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(v)) return v;
    return detectClientLocale();
  } catch {
    return detectClientLocale();
  }
}

/** 言語を保存して反映（静的 .astro 殻のため確実なフルリロードで切り替える）。 */
export function setClientLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    /* private mode */
  }
  if (typeof location !== "undefined") location.reload();
}
