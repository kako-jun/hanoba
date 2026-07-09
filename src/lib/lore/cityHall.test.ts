import { describe, expect, it } from "vitest";
import { buildCityHallBook, civicHub } from "./cityHall.ts";

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

  it("市政の窓口は実在routeと近日開庁を維持する（#164で市政だより/gazette を追加）", () => {
    expect(civicHub("ja").map((link) => link.route)).toEqual(["/gazette", "/ranking", "/vote", null]);
  });

  it("住民投票・市勢調査・市政だよりの label が route とセットでフッタと同名になる（#525・#164 命名統一）", () => {
    const hub = civicHub("ja");
    expect(hub[0]).toMatchObject({ label: "市政だより", route: "/gazette" });
    expect(hub[1]).toMatchObject({ label: "市勢調査", route: "/ranking" });
    expect(hub[2]).toMatchObject({ label: "住民投票", route: "/vote" });
  });
});
