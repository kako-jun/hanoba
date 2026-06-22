// 文言解決（#147 段階1）。
//
// `t(locale, key, params?)` ＝ カタログから locale の文言を引き、無ければ ja に fallback。
// 補間は `{name}` を params で置換する（プレースホルダが残っても落とさない＝安全側）。
//
// サーバ（.astro）・島（.tsx）の双方から同じ関数を使う（文言の単一経路）。
// 段階1 では呼び出し側の locale は DEFAULT_LOCALE 固定だが、関数自体は任意 locale を解決できる
// ＝段階2 で locale 決定方式（URL/クライアント）を差すだけで多言語化が効く。

import type { Locale } from "./locale.ts";
import { ja, type MessageKey } from "./messages/ja.ts";
import { en } from "./messages/en.ts";
import { es } from "./messages/es.ts";

const CATALOGS: Record<Locale, Partial<Record<MessageKey, string>>> = { ja, en, es };

export type TParams = Record<string, string | number>;

export function t(locale: Locale, key: MessageKey, params?: TParams): string {
  // locale の文言 → 無ければ ja（既定）→ それも無ければキー自体（描画を止めない）。
  const raw = CATALOGS[locale]?.[key] ?? ja[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
