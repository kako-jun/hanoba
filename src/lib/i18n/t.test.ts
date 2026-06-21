import { describe, expect, it } from "vitest";
import { t } from "./t.ts";
import { isLocale, DEFAULT_LOCALE, LOCALES } from "./locale.ts";
import { ja } from "./messages/ja.ts";
import { en } from "./messages/en.ts";

describe("i18n locale", () => {
  it("既定言語は ja", () => {
    expect(DEFAULT_LOCALE).toBe("ja");
  });

  it("isLocale は対応言語のみ true", () => {
    expect(isLocale("ja")).toBe(true);
    expect(isLocale("en")).toBe(true);
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
  it("LOCALES は ja/en の2言語", () => {
    expect([...LOCALES]).toEqual(["ja", "en"]);
  });

  it("en の全キーは ja に存在する（孤児キーを作らない）", () => {
    for (const key of Object.keys(en)) {
      expect(ja).toHaveProperty(key);
    }
  });
});
