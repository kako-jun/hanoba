// 島ツリー用の locale Context（#147 段階2）。
//
// feed/composer のような深い React 島ツリーでは、`lang` prop を各層に串刺しするより
// Context で配るほうが綺麗（prop ドリリングを避ける）。島のルート（FeedGrid/MyGrid/
// DiscoverGrid 等）が `<LocaleProvider value={lang}>` で1回与え、子孫は `useLocale()` で読む。
//
// 既定値は DEFAULT_LOCALE（ja）。**Provider 未装着のツリーも ja で描画＝挙動不変**になるので、
// 段階2 の途中（一部だけ Provider 配線済み）でも壊れない。go-live で島ルートが
// クライアント（localStorage/navigator）から locale を決めて value に流す。
//
// 文言は `const t = useT(useLocale())` で引く（t-hook は useT に一本化・第2の t-hook を作らない）。

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale.ts";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export const LocaleProvider = LocaleContext.Provider;

/** 島ツリーの現在 locale を読む（Provider 未装着なら DEFAULT_LOCALE＝ja）。 */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
