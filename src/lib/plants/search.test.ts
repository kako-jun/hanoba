import { describe, expect, it } from "vitest";
import { findPlantByTerm, plantTagValues } from "./search.ts";

describe("findPlantByTerm", () => {
  it("俗称・略でも植物に解決する（パキポ → Pachypodium）", () => {
    expect(findPlantByTerm("パキポ")?.id).toBe("pachypodium");
  });

  it("# 付き・英語・大小無視でも解決する", () => {
    expect(findPlantByTerm("#PACHYPODIUM")?.id).toBe("pachypodium");
    expect(findPlantByTerm("gracilius")?.id).toBe("pachypodium-gracilius");
  });

  it("辞書に無い語は null", () => {
    expect(findPlantByTerm("サボテン")).toBeNull();
    expect(findPlantByTerm("")).toBeNull();
  });
});

describe("plantTagValues", () => {
  it("名前・別名・単語学名を含み、空白を含む学名は除く", () => {
    const p = findPlantByTerm("グラキリス");
    expect(p).not.toBeNull();
    const tags = plantTagValues(p!);
    expect(tags).toContain("グラキリス");
    expect(tags).toContain("gracilius");
    // 空白入りの学名は #t に使えないので除外。
    expect(tags).not.toContain("Pachypodium rosulatum var. gracilius");
  });

  it("重複は畳む（大小無視）", () => {
    const p = findPlantByTerm("アガベ");
    const tags = plantTagValues(p!).map((t) => t.toLowerCase());
    expect(new Set(tags).size).toBe(tags.length);
  });
});
