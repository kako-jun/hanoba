// 島ツリー用の locale Context（#147 段階2）。
//
// feed/composer のような深い React 島ツリーでは、`lang` prop を各層に串刺しするより
// Context で配るほうが綺麗（prop ドリリングを避ける）。島のルート（FeedGrid/MyGrid/
// DiscoverGrid 等）が `<LocaleProvider value={lang}>` で1回与え、子孫は `useLocale()` で読む。
//
// **Provider 未装着ツリーの fallback は原典の `ja` に固定**する（公開既定 `DEFAULT_LOCALE` とは別物）。
// 本番では島ルート（FeedGrid/MyGrid/Composer 等）が必ず `<LocaleProvider value={resolvedLocale}>` を装着
// するので、この context 既定は本番では使われない＝go-live で公開既定を en にしても本番挙動は不変。
// 一方テスト等の Provider 未装着レンダリングは原典 `ja` で描く（DEFAULT_LOCALE に依存させない＝
// 公開既定を変えても日本語の回帰テストが壊れない）。
//
// 文言は `const t = useT(useLocale())` で引く（t-hook は useT に一本化・第2の t-hook を作らない）。

import { createContext, useContext } from "react";
import { type Locale } from "./locale.ts";

const LocaleContext = createContext<Locale>("ja");

export const LocaleProvider = LocaleContext.Provider;

/** 島ツリーの現在 locale を読む（Provider 未装着なら原典 `ja`・本番では必ず Provider が値を与える）。 */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
