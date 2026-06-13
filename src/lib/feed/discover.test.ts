import { describe, expect, it } from "vitest";
import { discoverTagFilters, normalizeTag } from "./discover.ts";

describe("normalizeTag", () => {
  it("前後の空白を trim する", () => {
    expect(normalizeTag("  アガベ  ")).toBe("アガベ");
  });

  it("先頭の # を除去する", () => {
    expect(normalizeTag("#アガベ")).toBe("アガベ");
  });

  it("空白と先頭 # の両方を処理する", () => {
    expect(normalizeTag("  #パキポ  ")).toBe("パキポ");
  });

  it("連続する先頭 # も除去する", () => {
    expect(normalizeTag("##植物")).toBe("植物");
  });

  it("先頭以外の # は残す", () => {
    expect(normalizeTag("#a#b")).toBe("a#b");
  });

  it("空文字・空白のみ・# のみは空になる", () => {
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("#")).toBe("");
    expect(normalizeTag("  #  ")).toBe("");
  });
});

describe("discoverTagFilters", () => {
  it("tagFilter は #t に正規化タグ・kinds:[1]・limit を持つ", () => {
    const { tagFilter } = discoverTagFilters("  #アガベ ", 50);
    expect(tagFilter).toEqual({ kinds: [1], "#t": ["アガベ"], limit: 50 });
  });

  it("searchFilter は search が '#'+正規化タグ・kinds:[1]・limit を持つ", () => {
    const { searchFilter } = discoverTagFilters("#アガベ", 50);
    expect(searchFilter).toEqual({ kinds: [1], search: "#アガベ", limit: 50 });
  });

  it("limit を両フィルタに反映する", () => {
    const { tagFilter, searchFilter } = discoverTagFilters("パキポ", 7);
    expect(tagFilter.limit).toBe(7);
    expect(searchFilter.limit).toBe(7);
  });

  it("正規化済みのタグは search で二重 # にならない（先頭 # は1つ）", () => {
    expect(discoverTagFilters("##agave", 10).searchFilter.search).toBe("#agave");
  });
});
