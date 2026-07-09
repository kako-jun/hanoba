import { describe, expect, it } from "vitest";
import { buildCityHallBook, civicHub } from "./cityHall.ts";
import { t } from "../i18n/t.ts";
import type { Locale } from "../i18n/locale.ts";

const LOCALES: Locale[] = ["ja", "en", "es", "zh"];

describe("10ページの市民手帳（#137）", () => {
  it("安定IDを持つ10ページを重複なく組み立てる", () => {
    const pages = buildCityHallBook("ja");
    expect(pages).toHaveLength(10);
    expect(pages.map((page) => page.page)).toEqual(Array.from({ length: 10 }, (_, index) => index + 1));
    expect(new Set(pages.map((page) => page.id)).size).toBe(10);
  });

  it("P1遠景・正式地図・地区固有画像・既存市章を配置する", () => {
    const pages = buildCityHallBook("ja");
    const welcome = pages[0]!;
    expect(welcome.kind).toBe("welcome");
    if (welcome.kind === "welcome") {
      expect(welcome.blocks).toContainEqual(expect.objectContaining({ kind: "image", src: "/hanoba-welcome-vista.webp" }));
    }
    expect(pages.find((page) => page.id === "map")).toMatchObject({ image: "/hanoba-map.webp" });
    expect(pages.filter((page) => page.id.startsWith("district-"))).toHaveLength(5);
    expect(new Set(pages.filter((page) => page.id.startsWith("district-")).map((page) => page.kind === "guide" ? page.image : null)).size).toBe(5);
    expect(pages.find((page) => page.id === "crest")).toMatchObject({ image: "/icon.svg" });
  });

  it("沿革4件と市憲章5条を各1ページにまとめる", () => {
    const pages = buildCityHallBook("ja");
    expect(pages.find((page) => page.id === "chronicle")).toMatchObject({ entries: expect.arrayContaining([expect.any(Object)]) });
    const ordinances = pages.find((page) => page.id === "ordinances");
    expect(ordinances?.kind).toBe("ordinances");
    if (ordinances?.kind === "ordinances") expect(ordinances.ordinances).toHaveLength(5);
  });

  it.each(LOCALES)("市政の窓口は %s でも同じ route 順を維持する", (locale) => {
    expect(civicHub(locale).map((link) => link.route)).toEqual(["/gazette", "/ranking", "/vote", null]);
  });

  it.each(LOCALES)("%s の各 label は対応 route の nav 文言と一致する", (locale) => {
    const hub = civicHub(locale);
    expect(hub.slice(0, 3).map(({ label, route }) => ({ label, route }))).toEqual([
      { label: t(locale, "nav.gazette"), route: "/gazette" },
      { label: t(locale, "nav.ranking"), route: "/ranking" },
      { label: t(locale, "nav.vote"), route: "/vote" },
    ]);
  });

  it.each(LOCALES)("%s の nav 文言と civic label キーが機能ごとに一致する", (locale) => {
    expect([
      t(locale, "nav.gazette"),
      t(locale, "nav.ranking"),
      t(locale, "nav.vote"),
    ]).toEqual([
      t(locale, "cityHall.map.civic.2.label"),
      t(locale, "cityHall.map.civic.3.label"),
      t(locale, "cityHall.map.civic.0.label"),
    ]);
  });

  it.each(LOCALES)("%s では品評会だけが未開庁で comingSoon を持つ", (locale) => {
    const hub = civicHub(locale);
    expect(hub.filter((link) => link.route === null)).toEqual([
      {
        label: t(locale, "cityHall.map.civic.1.label"),
        route: null,
        comingSoon: t(locale, "cityHall.map.comingSoon"),
      },
    ]);
    expect(hub.slice(0, 3).every((link) => link.comingSoon === undefined)).toBe(true);
  });
});
