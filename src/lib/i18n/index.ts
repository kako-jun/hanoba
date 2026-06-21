// i18n コアの公開窓口（#147 段階1）。呼び出し側はここから import する。
export { LOCALES, DEFAULT_LOCALE, isLocale, type Locale } from "./locale.ts";
export { t, type TParams } from "./t.ts";
export { useT } from "./useT.ts";
export { type MessageKey } from "./messages/ja.ts";
