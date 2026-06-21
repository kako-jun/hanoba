// 島（React）用の文言フック（#147 段階1）。
//
// 島は locale を prop で受け取り（MainLayout がページの locale を流す）、`useT(locale)` で
// locale を束ねた `t` を得る。サーバと同じ t.ts を使うので文言経路は単一のまま。
//
// 段階1 では渡る locale は常に ja。段階2 で locale 決定方式が入ると、prop を差し替えるだけで
// 島も多言語化される（島は元々クライアント描画なので flash 非該当）。

import { useMemo } from "react";
import type { Locale } from "./locale.ts";
import { t, type TParams } from "./t.ts";
import type { MessageKey } from "./messages/ja.ts";

export function useT(locale: Locale): (key: MessageKey, params?: TParams) => string {
  return useMemo(() => (key: MessageKey, params?: TParams) => t(locale, key, params), [locale]);
}
