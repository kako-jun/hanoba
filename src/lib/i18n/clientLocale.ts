// クライアント側の表示言語の解決・保存（#147 段階2 go-live）。
//
// hanoba はバックエンドレス・静的サイト（殻は既定言語＝go-live で en でビルド）。表示言語の切替は
// localStorage に保存した「ユーザーが選んだ言語」をクライアントで読むだけ＝Twitter モデル
// （URL は同じ・/en/ ルーティングは作らない）。サーバ（.astro）は触らない（単一責務）。
//
// auto-detect（navigator.language）はしない（段階2 のスコープ外）。既定は常に DEFAULT_LOCALE（go-live で en）。

import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale.ts";

/** 表示言語の保存キー（is:inline 殻入替スクリプトとも一致させる＝文字列を二重持ちしない）。 */
export const LOCALE_STORAGE_KEY = "hanoba:lang";

/** ユーザーが選んだ表示言語。localStorage 優先、無ければ既定（DEFAULT_LOCALE＝go-live で en）。auto-detect はしない（段階2）。 */
export function resolveClientLocale(): Locale {
  if (typeof localStorage === "undefined") return DEFAULT_LOCALE;
  try {
    const v = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
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
