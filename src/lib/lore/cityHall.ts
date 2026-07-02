// ハノーバ市民手帳の表示テキスト（#163）。UI（CityHallBook）が描画する構造化データ。
//
// 文言はトーンロック済み（市長ボタニクス・フォン・ハノーバの声）。
// doctrine（市長バイブル・市民レベル・ページモデル）の正本は docs/lore.md にある。
// ここはその「レンダリング元」。本文の言い回しは承認済みのまま、改変しない。
//
// 言語別（JA/EN）は #147 で i18n カタログ（messages/）へ移管。文言の実体は cityHall.* 名前空間に置き、
// ここは locale を受けて t() で解決し、同じ構造（BookPage[]）を組み立てる（buildCityHallBook）。
// 後方互換のため DEFAULT_LOCALE で解決した定数（BOOK_TITLE / BOOK_PAGES 等）も従来どおり export する。

import { t } from "../i18n/t.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale.ts";
import { WELCOME_VISTA_SRC, MAP_IMAGE_SRC } from "./cityHallAssets.ts";

/** 本文の 1 段落。kind で見出し脇の実務注／段落間の挿絵などを区別する。 */
export type Block =
  | { kind: "para"; text: string }
  | { kind: "note"; text: string } // 小さく添える実務注・注記
  | { kind: "image"; src: string; alt: string }; // 段落間に挟む挿絵（#504）

/** 市政の窓口リンク 1 件。route が null なら「近日開庁」（未開設・非リンク表示）。 */
export interface HubLink {
  label: string;
  /** 実在ルート（既存ページ）。未開設は null。 */
  route: string | null;
  /** 未開設の佇まい説明（近日開庁）。route が null のときに使う。 */
  comingSoon?: string;
}

/** 街の地図の名所（ランドマーク）1 件。名＋短い説明（#469）。 */
export interface Landmark {
  name: string;
  text: string;
}

/** 沿革（年表）の 1 行。 */
export interface ChronicleEntry {
  era: string;
  text: string;
}

/** 市の条文 1 条（条文＋市長解説）。osaka-kenpo 作法。 */
export interface Ordinance {
  article: string; // 例: 第一条（土地）
  text: string; // 条文
  commentary: string; // 市長解説
}

/** 本の 1 ページ。種類ごとに描画するデータ形を持つ。 */
export type BookPage =
  | { page: 1; kind: "welcome"; title: string; blocks: Block[] }
  | {
      page: 2;
      kind: "map";
      title: string;
      lead: string;
      /** 地図イラストの画像パス（#137 で gpt-image-2 生成 webp を入れる）。未生成は null＝仮置きフレーム。 */
      image: string | null;
      landmarks: Landmark[];
      civic: HubLink[];
      note: string;
    }
  | { page: 3; kind: "chronicle"; title: string; lead: string; entries: ChronicleEntry[]; note: string }
  | { page: 4; kind: "ordinances"; title: string; lead: string; ordinances: Ordinance[] };

/** 本の在世タイトル（手帳の表題）を locale で引く。 */
export function bookTitle(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "cityHall.book.title");
}

/** 語り手＝ハノーバ市長の名（P1 本文「ボタニクス・フォン・ハノーバ」と一貫）。 */
export function mayorName(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "cityHall.mayor.name");
}

/** 親しみのある短い呼び名（肖像の脇など、フルネームだと長い場所で「ボタニクス市長」と名乗る・#262）。 */
export function mayorShortName(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "cityHall.mayor.shortName");
}

/** P1 移住案内（市長の歓迎の辞）。 */
function page1(locale: Locale): BookPage {
  return {
    page: 1,
    kind: "welcome",
    title: t(locale, "cityHall.welcome.title"),
    blocks: [
      { kind: "para", text: t(locale, "cityHall.welcome.0") },
      // 「ようこそ、緑の市へ」の直後に街の俯瞰ビスタを挟む（#504・挨拶→街を見せる→規約の順）。
      { kind: "image", src: WELCOME_VISTA_SRC, alt: t(locale, "cityHall.welcome.image.alt") },
      { kind: "para", text: t(locale, "cityHall.welcome.1") },
      { kind: "para", text: t(locale, "cityHall.welcome.2") },
      { kind: "note", text: t(locale, "cityHall.welcome.3") },
    ],
  };
}

/**
 * P2 街の地図（図鑑の早期ご褒美ページ・#469）。ロア（名所＝ランドマーク）を読み物として見せ、
 * 末尾に「市政の窓口」strip（civic）を添える。機能導線の本体（discover/ranking/me/compose）は
 * ヘッダ/フッタ（SiteHeader/SiteFooter）が持つので手帳からは外し、ここには手帳が唯一の入口だった
 * 住民投票（/vote）と、近日開庁の品評会・市長ブログだけを残す。実在ルートのみ機能、未開設は「近日開庁」。
 */
function page2(locale: Locale): BookPage {
  const comingSoon = t(locale, "cityHall.map.comingSoon");
  return {
    page: 2,
    kind: "map",
    title: t(locale, "cityHall.map.title"),
    lead: t(locale, "cityHall.map.lead"),
    // 葉形の地図イラスト（#137/#504・kako-jun 制作）。
    image: MAP_IMAGE_SRC,
    landmarks: [
      { name: t(locale, "cityHall.map.landmark.0.name"), text: t(locale, "cityHall.map.landmark.0.text") },
      { name: t(locale, "cityHall.map.landmark.1.name"), text: t(locale, "cityHall.map.landmark.1.text") },
      { name: t(locale, "cityHall.map.landmark.2.name"), text: t(locale, "cityHall.map.landmark.2.text") },
    ],
    // 市政の窓口（civic strip）。住民投票はヘッダ/フッタに無く手帳が唯一の入口なので退避必須（#469）。
    civic: [
      { label: t(locale, "cityHall.map.civic.0.label"), route: "/vote" }, // #160 開庁（最初に開いた役所・Nostalgic BBS 3 板）。
      { label: t(locale, "cityHall.map.civic.1.label"), route: null, comingSoon }, // 品評会（#161 未実装）。
      { label: t(locale, "cityHall.map.civic.2.label"), route: null, comingSoon }, // 市長ブログ（#164 未実装）。
    ],
    note: t(locale, "cityHall.map.note"),
  };
}

/** P3 沿革（年表・遊び）。冒頭に市長の前口上（lead）を置く（全ページ共通＝市長の語り）。 */
function page3(locale: Locale): BookPage {
  return {
    page: 3,
    kind: "chronicle",
    title: t(locale, "cityHall.chronicle.title"),
    lead: t(locale, "cityHall.chronicle.lead"),
    entries: [
      { era: t(locale, "cityHall.chronicle.entry.0.era"), text: t(locale, "cityHall.chronicle.entry.0.text") },
      { era: t(locale, "cityHall.chronicle.entry.1.era"), text: t(locale, "cityHall.chronicle.entry.1.text") },
      { era: t(locale, "cityHall.chronicle.entry.2.era"), text: t(locale, "cityHall.chronicle.entry.2.text") },
      { era: t(locale, "cityHall.chronicle.entry.3.era"), text: t(locale, "cityHall.chronicle.entry.3.text") },
    ],
    note: t(locale, "cityHall.chronicle.note"),
  };
}

/** P4 市の条文（ハノーバ市憲章・各条に市長解説）。冒頭に市長の前口上（lead）を置く（全ページ共通）。 */
function page4(locale: Locale): BookPage {
  return {
    page: 4,
    kind: "ordinances",
    title: t(locale, "cityHall.ordinance.title"),
    lead: t(locale, "cityHall.ordinance.lead"),
    ordinances: [
      {
        article: t(locale, "cityHall.ordinance.0.article"),
        text: t(locale, "cityHall.ordinance.0.text"),
        commentary: t(locale, "cityHall.ordinance.0.commentary"),
      },
      {
        article: t(locale, "cityHall.ordinance.1.article"),
        text: t(locale, "cityHall.ordinance.1.text"),
        commentary: t(locale, "cityHall.ordinance.1.commentary"),
      },
      {
        article: t(locale, "cityHall.ordinance.2.article"),
        text: t(locale, "cityHall.ordinance.2.text"),
        commentary: t(locale, "cityHall.ordinance.2.commentary"),
      },
      {
        article: t(locale, "cityHall.ordinance.3.article"),
        text: t(locale, "cityHall.ordinance.3.text"),
        commentary: t(locale, "cityHall.ordinance.3.commentary"),
      },
      {
        article: t(locale, "cityHall.ordinance.4.article"),
        text: t(locale, "cityHall.ordinance.4.text"),
        commentary: t(locale, "cityHall.ordinance.4.commentary"),
      },
    ],
  };
}

/** 全ページ（1〜4・順序固定）を locale で組み立てる。 */
export function buildCityHallBook(locale: Locale = DEFAULT_LOCALE): BookPage[] {
  return [page1(locale), page2(locale), page3(locale), page4(locale)];
}

/** ロックされたページのティザー（図鑑式・？？？）を locale で引く。 */
export function lockedTeaser(locale: Locale = DEFAULT_LOCALE): { title: string; note: string } {
  return {
    title: t(locale, "cityHall.locked.title"),
    note: t(locale, "cityHall.locked.note"),
  };
}

/** レベル昇格時に小さく添える市長のひとこと（味付け）を locale で引く。 */
export function levelFlavor(locale: Locale = DEFAULT_LOCALE): { citizen: string; tenured: string } {
  return {
    /** L1 で 2p 目（街の地図）を開いたとき。L2 以上では出さない（古参に移住受理を再掲しない）。 */
    citizen: t(locale, "cityHall.flavor.citizen"),
    /** L2 以上が初めて奥のページ（3p 沿革）に達したとき（#469 で L3 まで解放が伸びても古参歓迎は維持）。 */
    tenured: t(locale, "cityHall.flavor.tenured"),
  };
}

// --- 後方互換 export（DEFAULT_LOCALE で解決した定数）。既存の const 消費側・テストはこのまま動く。 ---

/** 本の在世タイトル（手帳の表題・ja 既定）。 */
export const BOOK_TITLE = bookTitle(DEFAULT_LOCALE);

/** 語り手＝ハノーバ市長の名（ja 既定）。 */
export const MAYOR_NAME = mayorName(DEFAULT_LOCALE);

/** 親しみのある短い呼び名（ja 既定・#262）。 */
export const MAYOR_SHORT_NAME = mayorShortName(DEFAULT_LOCALE);

/** 全ページ（1〜4・順序固定・ja 既定）。 */
export const BOOK_PAGES: BookPage[] = buildCityHallBook(DEFAULT_LOCALE);

/** ロックされたページのティザー（ja 既定）。 */
export const LOCKED_TEASER = lockedTeaser(DEFAULT_LOCALE);

/** レベル昇格時の市長のひとこと（ja 既定）。 */
export const LEVEL_FLAVOR = levelFlavor(DEFAULT_LOCALE);

/**
 * ロック頁の背後に敷く「読めない頁」のフェイク本文（#219 ③）。
 * 「？？？」の下に、blur で潰した崩し字を流して「頁はあるが今は読めない」図鑑的示唆を出す。
 * 純粋な装飾（描画側で aria-hidden / select-none）＝意味は持たせない。日本語の伝統的な
 * 流し書き素材＝いろは歌（全仮名を一度ずつ）を行ごとに長さを変えて流用し、本文の段落らしく見せる
 * （最終行は短め）。ぼかすので語としては読めず、支援技術・コピーからは隠れる。
 */
export const LOCKED_PAGE_VEIL: readonly string[] = [
  "いろはにほへとちりぬるをわかよたれそ",
  "つねならむうゐのおくやまけふこえて",
  "あさきゆめみしゑひもせすいろはにほへと",
  "ちりぬるをわかよたれそつねならむうゐの",
  "おくやまけふこえてあさきゆめみし",
  "ゑひもせす",
];
