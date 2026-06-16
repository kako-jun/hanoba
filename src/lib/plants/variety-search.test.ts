import { describe, expect, it } from "vitest";
import type { VarietyCategory } from "./variety-catalog.ts";
import { searchCatalog } from "./variety-search.ts";

const CATALOG: VarietyCategory[] = [
  {
    label: "多肉・塊根",
    genera: [
      {
        name: "アガベ",
        pickable: true,
        varieties: [
          { name: "チタノタ" },
          { name: "レッドキャットウィーズル" },
          { name: "赤猫" },
          { name: "モンタナ" },
        ],
      },
      {
        name: "その他塊根",
        pickable: false,
        varieties: [{ name: "火星人" }],
      },
    ],
  },
  {
    label: "バラ・草花",
    genera: [
      {
        name: "クレマチス",
        pickable: true,
        varieties: [{ name: "モンタナ" }, { name: "テッセン", aliases: ["鉄線"] }],
      },
    ],
  },
];

describe("searchCatalog", () => {
  it("空クエリは空配列", () => {
    expect(searchCatalog(CATALOG, "")).toEqual([]);
    expect(searchCatalog(CATALOG, "   ")).toEqual([]);
    expect(searchCatalog(CATALOG, "#")).toEqual([]);
  });

  it("品種名の部分一致で拾う", () => {
    const hits = searchCatalog(CATALOG, "チタ");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ name: "チタノタ", category: "多肉・塊根", genus: "アガベ", kind: "variety" });
  });

  it("先頭 # を無視して照合する", () => {
    expect(searchCatalog(CATALOG, "#チタノタ").map((h) => h.name)).toEqual(["チタノタ"]);
  });

  it("pickable な属はタグとして拾い、grouping 見出し（その他）は属では拾わない", () => {
    const agave = searchCatalog(CATALOG, "アガベ");
    expect(agave.some((h) => h.kind === "genus" && h.name === "アガベ")).toBe(true);

    const other = searchCatalog(CATALOG, "その他");
    expect(other.some((h) => h.kind === "genus")).toBe(false);
  });

  it("alias でもヒットする（鉄線→テッセン）", () => {
    const hits = searchCatalog(CATALOG, "鉄線");
    expect(hits.map((h) => h.name)).toEqual(["テッセン"]);
  });

  it("同名タグ（モンタナ）は属を跨いでも1件に重複排除", () => {
    const hits = searchCatalog(CATALOG, "モンタナ");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.name).toBe("モンタナ");
  });

  it("前方一致を部分一致より先に並べる", () => {
    const hits = searchCatalog(CATALOG, "猫");
    // 「赤猫」は部分一致のみ。前方一致が無ければ部分一致が並ぶ。
    expect(hits.map((h) => h.name)).toContain("赤猫");
  });

  it("limit を超えない", () => {
    const hits = searchCatalog(CATALOG, "ア", 1);
    expect(hits.length).toBeLessThanOrEqual(1);
  });

  it("大文字小文字を無視する", () => {
    const cat: VarietyCategory[] = [
      { label: "観葉", genera: [{ name: "モンステラ", pickable: true, varieties: [{ name: "Albo" }] }] },
    ];
    expect(searchCatalog(cat, "albo").map((h) => h.name)).toEqual(["Albo"]);
  });
});
