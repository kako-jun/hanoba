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
import {
  CREST_SPECIALTIES_IMAGE_SRC,
  DISTRICTS_IMAGE_SRC,
  WELCOME_VISTA_SRC,
  MAP_IMAGE_SRC,
} from "./cityHallAssets.ts";

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

export interface District {
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

const DISTRICT_KEYS = [
  { name: "cityHall.districts.0.name", text: "cityHall.districts.0.text" },
  { name: "cityHall.districts.1.name", text: "cityHall.districts.1.text" },
  { name: "cityHall.districts.2.name", text: "cityHall.districts.2.text" },
  { name: "cityHall.districts.3.name", text: "cityHall.districts.3.text" },
  { name: "cityHall.districts.4.name", text: "cityHall.districts.4.text" },
] as const;

const CHRONICLE_KEYS = [
  { era: "cityHall.chronicle.entry.0.era", text: "cityHall.chronicle.entry.0.text" },
  { era: "cityHall.chronicle.entry.1.era", text: "cityHall.chronicle.entry.1.text" },
  { era: "cityHall.chronicle.entry.2.era", text: "cityHall.chronicle.entry.2.text" },
  { era: "cityHall.chronicle.entry.3.era", text: "cityHall.chronicle.entry.3.text" },
] as const;

const ORDINANCE_KEYS = [
  { article: "cityHall.ordinance.0.article", text: "cityHall.ordinance.0.text", commentary: "cityHall.ordinance.0.commentary" },
  { article: "cityHall.ordinance.1.article", text: "cityHall.ordinance.1.text", commentary: "cityHall.ordinance.1.commentary" },
  { article: "cityHall.ordinance.2.article", text: "cityHall.ordinance.2.text", commentary: "cityHall.ordinance.2.commentary" },
  { article: "cityHall.ordinance.3.article", text: "cityHall.ordinance.3.text", commentary: "cityHall.ordinance.3.commentary" },
  { article: "cityHall.ordinance.4.article", text: "cityHall.ordinance.4.text", commentary: "cityHall.ordinance.4.commentary" },
] as const;

/** 本の 1 ページ。種類ごとに描画するデータ形を持つ。 */
export type BookPage =
  | { id: string; page: number; kind: "welcome"; title: string; blocks: Block[] }
  | { id: string; page: number; kind: "guide"; title: string; lead: string; image?: string; note?: string }
  | {
      id: string;
      page: number;
      kind: "map";
      title: string;
      lead: string;
      /** 地図イラストの画像パス（#137 で gpt-image-2 生成 webp を入れる）。未生成は null＝仮置きフレーム。 */
      image: string | null;
      landmarks: Landmark[];
      note: string;
    }
  | {
      id: string;
      page: number;
      kind: "chronicle";
      title: string;
      lead: string;
      entries: ChronicleEntry[];
      note: string;
    }
  | {
      id: string;
      page: number;
      kind: "ordinances";
      title: string;
      lead: string;
      ordinances: Ordinance[];
    };

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
    id: "welcome",
    kind: "welcome",
    title: t(locale, "cityHall.welcome.title"),
    blocks: [
      { kind: "para", text: t(locale, "cityHall.welcome.0") },
    ],
  };
}

/**
 * 市政の窓口（civic strip）。巻末P20に置く窓口。
 * 機能導線の本体（discover/ranking/me/compose）は
 * ヘッダ/フッタ（SiteHeader/SiteFooter）が持つので手帳からは外し、ここには手帳が唯一の入口だった
 * 住民投票（/vote）と、近日開庁の品評会・市長ブログだけを並べる。実在ルートのみ機能、未開設は「近日開庁」。
 */
export function civicHub(locale: Locale = DEFAULT_LOCALE): HubLink[] {
  const comingSoon = t(locale, "cityHall.map.comingSoon");
  return [
    { label: t(locale, "cityHall.map.civic.0.label"), route: "/vote" }, // #160 開庁（最初に開いた役所・Nostalgic BBS 3 板）。
    { label: t(locale, "cityHall.map.civic.1.label"), route: null, comingSoon }, // 品評会（#161 未実装）。
    { label: t(locale, "cityHall.map.civic.2.label"), route: null, comingSoon }, // 市長ブログ（#164 未実装）。
  ];
}

/**
 * P2 街の地図（図鑑の読み物ページ・#469）。ロア（名所＝ランドマーク）を読み物として見せる。
 * 機能導線の本体（discover/ranking/me/compose）はヘッダ/フッタ（SiteHeader/SiteFooter）が持つので
 * 手帳からは外す。「市政の窓口」strip は巻末P20に置く。
 */
function mapPage(locale: Locale): BookPage {
  return {
    id: "map",
    page: 4,
    kind: "map",
    title: t(locale, "cityHall.map.title"),
    lead: t(locale, "cityHall.map.lead"),
    // 葉形の地図イラスト（#137/#504・kako-jun 制作）。
    image: MAP_IMAGE_SRC,
    landmarks: [
      {
        name: t(locale, "cityHall.map.landmark.0.name"),
        text: t(locale, "cityHall.map.landmark.0.text"),
      },
      {
        name: t(locale, "cityHall.map.landmark.1.name"),
        text: t(locale, "cityHall.map.landmark.1.text"),
      },
      {
        name: t(locale, "cityHall.map.landmark.2.name"),
        text: t(locale, "cityHall.map.landmark.2.text"),
      },
    ],
    note: t(locale, "cityHall.map.note"),
  };
}

function chroniclePage(locale: Locale, page: number, entryIndexes: (0 | 1 | 2 | 3)[]): BookPage {
  return {
    id: `chronicle-${page - 12}`,
    page,
    kind: "chronicle",
    title: t(locale, "cityHall.chronicle.title"),
    lead: t(locale, "cityHall.chronicle.lead"),
    entries: entryIndexes.map((index) => {
      const keys = CHRONICLE_KEYS[index];
      return { era: t(locale, keys.era), text: t(locale, keys.text) };
    }),
    note: t(locale, "cityHall.chronicle.note"),
  };
}

function ordinancePage(locale: Locale, page: number, index: 0 | 1 | 2 | 3 | 4): BookPage {
  const keys = ORDINANCE_KEYS[index];
  return {
    id: `ordinance-${index + 1}`,
    page,
    kind: "ordinances",
    title: t(locale, "cityHall.ordinance.title"),
    lead: t(locale, "cityHall.ordinance.lead"),
    ordinances: [{
      article: t(locale, keys.article),
      text: t(locale, keys.text),
      commentary: t(locale, keys.commentary),
    }],
  };
}

function guide(id: string, page: number, title: string, lead: string, image?: string, note?: string): BookPage {
  return { id, page, kind: "guide", title, lead, image, note };
}

/** 全20ページ（順序固定・全開放）を locale で組み立てる。 */
export function buildCityHallBook(locale: Locale = DEFAULT_LOCALE): BookPage[] {
  const districts = DISTRICT_KEYS.map((keys, index) =>
    guide(
      `district-${index + 1}`,
      index + 6,
      t(locale, keys.name),
      t(locale, keys.text),
      DISTRICTS_IMAGE_SRC,
      t(locale, "cityHall.districts.note"),
    ),
  );
  return [
    page1(locale),
    guide("settlement", 2, t(locale, "cityHall.welcome.title"), t(locale, "cityHall.welcome.1"), undefined, t(locale, "cityHall.welcome.3")),
    guide("vista", 3, t(locale, "cityHall.guide.vista"), t(locale, "cityHall.welcome.2"), WELCOME_VISTA_SRC),
    mapPage(locale),
    guide("landmarks", 5, t(locale, "cityHall.guide.landmarks"), t(locale, "cityHall.map.landmark.0.text"), MAP_IMAGE_SRC, t(locale, "cityHall.map.landmark.1.text")),
    ...districts,
    guide("crest", 11, t(locale, "cityHall.guide.crest"), t(locale, "cityHall.guide.crest.text"), CREST_SPECIALTIES_IMAGE_SRC),
    guide("specialties", 12, t(locale, "cityHall.guide.specialties"), t(locale, "cityHall.guide.specialties.text"), CREST_SPECIALTIES_IMAGE_SRC),
    chroniclePage(locale, 13, [0, 1]),
    chroniclePage(locale, 14, [2]),
    chroniclePage(locale, 15, [3]),
    ...ORDINANCE_KEYS.map((_, index) => ordinancePage(locale, index + 16, index as 0 | 1 | 2 | 3 | 4)),
  ];
}

// --- 後方互換 export（DEFAULT_LOCALE で解決した定数）。既存の const 消費側・テストはこのまま動く。 ---

/** 本の在世タイトル（手帳の表題・ja 既定）。 */
export const BOOK_TITLE = bookTitle(DEFAULT_LOCALE);

/** 語り手＝ハノーバ市長の名（ja 既定）。 */
export const MAYOR_NAME = mayorName(DEFAULT_LOCALE);

/** 親しみのある短い呼び名（ja 既定・#262）。 */
export const MAYOR_SHORT_NAME = mayorShortName(DEFAULT_LOCALE);

/** 全20ページ（順序固定・ja 既定）。 */
export const BOOK_PAGES: BookPage[] = buildCityHallBook(DEFAULT_LOCALE);
