// 市政だより（#164）の表示テキスト。UI（GazetteBook）が描画する構造化データ。
//
// 「市長ブログ」という名称・Nostr 投稿・専用鍵・バックエンド・自動投稿は使わない。
// リポジトリ内の静的データ（このファイル）をビルド時に静的ページへ反映するだけの、
// 市長ボタニクス・フォン・ハノーバが執筆した体裁のリリースノート。
// docs/lore.md（doctrine）に役割と文体の正本を持つ。文言はトーンロック済み（全肯定・大仰・「おっほん」）。
//
// 市民手帳と同じ本ページャー（BookPager）を使い、記事は最古→最新の時間順で採番する。
// 「前へ」＝過去、「次へ」＝未来。初回に最新を見せる責務は GazetteBook の defaultPage="last" が持つ。

import { t } from "../i18n/t.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale.ts";

/** 記事内の関連ページへの導線 1 件。 */
export interface GazetteLink {
  label: string;
  href: string;
}

/** 市政だよりの 1 記事（1 ページ）。 */
export interface GazetteArticle {
  id: string;
  /** 1-indexed のページ番号。1 が最古、最終ページが最新（BookPager と同じ形）。 */
  page: number;
  /** 公開日。`YYYY-MM-DD`（#347 の撮影日と同じ思想＝locale で書式を変えない）。 */
  date: string;
  /** 短い見出し。 */
  heading: string;
  /** 追加/変更した内容とその趣旨（段落配列）。 */
  body: string[];
  /** 市長らしい短い結び。 */
  closing: string;
  /** 関連ページへの導線（任意・複数可）。 */
  links: GazetteLink[];
}

/** 記事の言語非依存な骨格（古い記事ほど先頭＝配列順がそのまま時間順のページになる）。 */
const ARTICLE_KEYS = [
  {
    // #104: 「あなたの植物」画面で名前とプロフィールを1枚のカードに統合（2026-06-16）。
    id: "me-card-unified",
    date: "2026-06-16",
    heading: "gazette.articles.3.heading",
    body: ["gazette.articles.3.body.0", "gazette.articles.3.body.1"] as const,
    closing: "gazette.articles.3.closing",
    links: [{ label: "gazette.articles.3.link.0.label", href: "/me" }] as const,
  },
  {
    // #160・#162: 住民投票と市勢調査（品種の人気動向窓口）を開庁（2026-06-18）。
    id: "civic-windows-open",
    date: "2026-06-18",
    heading: "gazette.articles.2.heading",
    body: ["gazette.articles.2.body.0", "gazette.articles.2.body.1"] as const,
    closing: "gazette.articles.2.closing",
    links: [
      { label: "gazette.articles.2.link.0.label", href: "/vote" },
      { label: "gazette.articles.2.link.1.label", href: "/ranking" },
    ] as const,
  },
  {
    // #147: 表示言語を英語既定に切り替え、多言語対応を始動（2026-06-22）。
    id: "multilingual-launch",
    date: "2026-06-22",
    heading: "gazette.articles.1.heading",
    body: ["gazette.articles.1.body.0", "gazette.articles.1.body.1"] as const,
    closing: "gazette.articles.1.closing",
    links: [] as const,
  },
  {
    // #137: 市民手帳の全面改訂（2026-07-09・本日）。
    id: "handbook-revision",
    date: "2026-07-09",
    heading: "gazette.articles.0.heading",
    body: ["gazette.articles.0.body.0", "gazette.articles.0.body.1"] as const,
    closing: "gazette.articles.0.closing",
    links: [{ label: "gazette.articles.0.link.0.label", href: "/about" }] as const,
  },
  {
    // #529/#530/#142/#537: いいね（花）とコメントを贈れるようになった（2026-07-10）。
    id: "reactions-and-comments",
    date: "2026-07-10",
    heading: "gazette.articles.4.heading",
    body: ["gazette.articles.4.body.0", "gazette.articles.4.body.1"] as const,
    closing: "gazette.articles.4.closing",
    links: [{ label: "gazette.articles.4.link.0.label", href: "/discover" }] as const,
  },
] as const;

/** 市政だよりの在世タイトルを locale で引く。 */
export function gazetteTitle(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "gazette.book.title");
}

/** 全記事（古い順・1 が最古）を locale で組み立てる。 */
export function buildGazette(locale: Locale = DEFAULT_LOCALE): GazetteArticle[] {
  return ARTICLE_KEYS.map((keys, index) => ({
    id: keys.id,
    page: index + 1,
    date: keys.date,
    heading: t(locale, keys.heading),
    body: keys.body.map((key) => t(locale, key)),
    closing: t(locale, keys.closing),
    links: keys.links.map((link) => ({ label: t(locale, link.label), href: link.href })),
  }));
}
