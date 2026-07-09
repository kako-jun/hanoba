import { describe, expect, it } from "vitest";
import { buildCityHallBook, civicHub } from "./cityHall.ts";

describe("20ページの市民手帳（#137）", () => {
  it("安定IDを持つ20ページを重複なく組み立てる", () => {
    const pages = buildCityHallBook("ja");
    expect(pages).toHaveLength(20);
    expect(pages.map((page) => page.page)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    expect(new Set(pages.map((page) => page.id)).size).toBe(20);
  });

  it("地図・地区・市章特産物の完成画像を配置する", () => {
    const pages = buildCityHallBook("ja");
    expect(pages.find((page) => page.id === "map")).toMatchObject({ image: "/hanoba-map.webp" });
    expect(pages.filter((page) => page.id.startsWith("district-"))).toHaveLength(5);
    expect(pages.find((page) => page.id === "district-1")).toMatchObject({ image: "/hanoba-districts.webp" });
    expect(pages.find((page) => page.id === "crest")).toMatchObject({ image: "/hanoba-crest-specialties.webp" });
    expect(pages.find((page) => page.id === "specialties")).toMatchObject({ image: "/hanoba-crest-specialties.webp" });
  });

  it("市憲章5条を16〜20ページへ1条ずつ分ける", () => {
    const pages = buildCityHallBook("ja").slice(15);
    expect(pages.every((page) => page.kind === "ordinances" && page.ordinances.length === 1)).toBe(true);
  });

  it("市政の窓口は実在routeと近日開庁を維持する", () => {
    expect(civicHub("ja").map((link) => link.route)).toEqual(["/vote", null, null]);
  });
});
