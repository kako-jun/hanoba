import { describe, expect, it } from "vitest";
import { t } from "./t.ts";
import { isLocale, DEFAULT_LOCALE, LOCALES } from "./locale.ts";
import { ja } from "./messages/ja.ts";
import { en } from "./messages/en.ts";
import { es } from "./messages/es.ts";
import { zh } from "./messages/zh.ts";

describe("i18n locale", () => {
  it("既定言語は en（#147 go-live＝世界の正面を英語に）", () => {
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("isLocale は対応言語のみ true", () => {
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("es")).toBe(true);
    expect(isLocale("zh")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

describe("t()", () => {
  it("ja の文言を引く", () => {
    expect(t("ja", "nav.discover")).toBe("みんなの植物");
  });

  it("en の文言を引く", () => {
    expect(t("en", "nav.discover")).toBe("Everyone's Plants");
  });

  it("es の文言を引く（#384 パイロット）", () => {
    expect(t("es", "nav.discover")).toBe("Plantas de todos");
  });

  it("es 虫食いは ja に fallback する（完備を要求しない・graceful）", () => {
    // es に無いキーは t() が ja へ落ちる（描画を止めない）。解決規則 es[key] ?? ja[key] を全キーで網羅。
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const expected = (es as Record<string, string>)[key] ?? ja[key];
      expect(t("es", key)).toBe(expected);
    }
  });

  it("zh の文言を引く（#384・非空で解決）", () => {
    expect(t("zh", "nav.discover").length).toBeGreaterThan(0);
  });

  it("zh 虫食いは ja に fallback する（完備を要求しない・graceful）", () => {
    // zh に無いキーは t() が ja へ落ちる。解決規則 zh[key] ?? ja[key] を全キーで網羅。
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const expected = (zh as Record<string, string>)[key] ?? ja[key];
      expect(t("zh", key)).toBe(expected);
    }
  });

  it("t は en→ja の順で解決する（en 虫食いは ja に fallback・完備を要求しない）", () => {
    // 全 ja キーで解決規則 en[key] ?? ja[key] を検証＝「en にある→en／en に無い→ja」を
    // 単一の property で網羅する。en が増減しても自動で追従する（分岐を持たない）。
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const expected = (en as Record<string, string>)[key] ?? ja[key];
      expect(t("en", key)).toBe(expected);
    }
  });

  it("{name} プレースホルダを params で補間する", () => {
    expect(t("ja", "home.hero.sub", { link: "リンク" })).toBe(
      "ここは Hanōba に置かれた植物のタイムライン。Nostr 全体の植物はリンクへ。",
    );
  });

  it("params が無くてもプレースホルダを残したまま落とさない", () => {
    expect(t("ja", "home.hero.sub")).toContain("{link}");
  });

  it("未知の params キーはそのまま残す（部分補間）", () => {
    // 別キーだけ渡しても {link} は素のまま。
    expect(t("ja", "home.hero.sub", { other: "x" })).toContain("{link}");
  });
});

describe("カタログ整合", () => {
  it("LOCALES は ja/en/zh/es（#384・並びは reach 上位 zh→es・#385）", () => {
    expect([...LOCALES]).toEqual(["ja", "en", "zh", "es"]);
  });

  it("en の全キーは ja に存在する（孤児キーを作らない）", () => {
    for (const key of Object.keys(en)) {
      expect(ja).toHaveProperty(key);
    }
  });
});

// #525 / #164 で新規追加/改称したキーは、ja へのグレースフル fallback に頼らず全 locale に実訳を持つことを
// 固定する（fallback で通ってしまうと、訳し忘れが気付かれず英語圏に日本語が漏れる・過去事故パターン）。
describe("新規キーの多言語完備（#525・#164）", () => {
  const CATALOGS: Record<string, Partial<Record<string, string>>> = { ja, en, es, zh };

  it.each([
    "nav.vote",
    "account.profile.editHint",
    "cityHall.map.civic.3.label",
    "nav.ranking",
    "nav.gazette",
    "cityHall.map.civic.2.label",
    "meta.gazette.title",
    "meta.gazette.description",
    "gazette.book.title",
    "gazette.articles.0.heading",
    "gazette.articles.1.heading",
    "gazette.articles.2.heading",
    "gazette.articles.3.heading",
    "update.restarting",
  ])(
    "%s は ja/en/es/zh 全てに空でない値を持つ",
    (key) => {
      for (const [locale, catalog] of Object.entries(CATALOGS)) {
        const value = catalog[key];
        expect(value, `${locale}.${key} が欠落している`).toBeTypeOf("string");
        expect(value!.length, `${locale}.${key} が空文字`).toBeGreaterThan(0);
      }
    },
  );
});

describe("未名乗り著者キーの多言語完備（#531）", () => {
  const CATALOGS = { ja, en, es, zh } as const;
  const EXPECTED = { ja: "旅人", en: "Traveler", es: "Viajero", zh: "旅人" } as const;

  it.each(Object.entries(EXPECTED))("%s の author.unnamed は専用訳を持つ", (locale, expected) => {
    const catalog = CATALOGS[locale as keyof typeof CATALOGS];
    expect(catalog["author.unnamed"]).toBe(expected);
  });
});

// gazette.* は見出しだけでなく body/closing/links も含めて全キーを動的に列挙して検証する
// （手打ち列挙だと新規記事追加時に body/closing/links の訳し忘れが素通りする・#164）。
describe("gazette.* 全キーの多言語完備（#164・動的列挙）", () => {
  const CATALOGS: Record<string, Partial<Record<string, string>>> = { ja, en, es, zh };
  const gazetteKeys = Object.keys(ja).filter((key) => key.startsWith("gazette."));

  it("gazette.* キーが1件以上列挙される（列挙自体が空にならないことのガード）", () => {
    expect(gazetteKeys.length).toBeGreaterThan(0);
  });

  it.each(gazetteKeys)("%s は ja/en/es/zh 全てに空でない値を持つ", (key) => {
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      const value = catalog[key];
      expect(value, `${locale}.${key} が欠落している`).toBeTypeOf("string");
      expect(value!.length, `${locale}.${key} が空文字`).toBeGreaterThan(0);
    }
  });
});

// nav.gazette（フッタ）と cityHall.map.civic.2.label（市政の窓口）は同じ機能への別導線なので、
// 全 locale で文言が一致すること（呼び名がページによってブレない）を固定する（#164 命名統一）。
describe("nav.gazette と cityHall.map.civic.2.label の命名統一（#164）", () => {
  it.each(["ja", "en", "es", "zh"] as const)("%s で両キーが同一文言になる", (locale) => {
    expect(t(locale, "nav.gazette")).toBe(t(locale, "cityHall.map.civic.2.label"));
  });
});
