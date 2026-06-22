// i18n の言語プリミティブ（#147 段階1）。
//
// hanoba はバックエンドレス・静的サイトなので、i18n も zero-dep の hand-rolled に保つ
// （ライブラリ依存を増やさない＝framework 素の挙動に乗る／薄いまま）。
// ここは「対応言語の定義」だけ。文言は messages/、解決は t.ts が担う（単一責務）。
//
// 段階1 ではランタイムの locale は常に DEFAULT_LOCALE（ja）に固定する＝挙動不変。
// locale の決定方式（URL ルーティング or クライアント切替）は段階2で確定する（#147）。

// #384 多言語: zh（簡体中文）・es（スペイン語）を reach 狙いで追加。島は useT で自動対応・
// 静的殻は MainLayout の N-locale swap が当てる。未訳は t.ts が ja へ fallback（graceful）。
// 並びは **zh → es**（llll-ll にならい reach 上位＝中国語を先に・#385）。LangSwitcher の表示順もこれに追従。
export const LOCALES = ["ja", "en", "zh", "es"] as const;

export type Locale = (typeof LOCALES)[number];

/** 既定言語。世界観文言の原典（日本語）。未訳はここに fallback する。 */
export const DEFAULT_LOCALE: Locale = "en";

/** 任意の値が対応言語かを判定する（URL/localStorage 由来の文字列の検証用・段階2）。 */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
