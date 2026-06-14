import { describe, expect, it } from "vitest";
import {
  classifyDiscoverQuery,
  discoverKeywordFilters,
  discoverTagFilters,
  normalizeTag,
} from "./discover.ts";

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

describe("classifyDiscoverQuery", () => {
  it("先頭 # はタグモード（term は # 除去）", () => {
    expect(classifyDiscoverQuery("#アガベ")).toEqual({ mode: "tag", term: "アガベ" });
  });

  it("先頭 # ＋前後空白もタグモードで正規化する", () => {
    expect(classifyDiscoverQuery("  #パキポ  ")).toEqual({ mode: "tag", term: "パキポ" });
  });

  it("# 無しはキーワードモード（term は trim のみ・# を付けない）", () => {
    expect(classifyDiscoverQuery("葉焼け")).toEqual({ mode: "keyword", term: "葉焼け" });
    expect(classifyDiscoverQuery("  徒長 ")).toEqual({ mode: "keyword", term: "徒長" });
  });

  it("空・空白のみは keyword/term='' （呼び出し側でリレーを叩かない）", () => {
    expect(classifyDiscoverQuery("")).toEqual({ mode: "keyword", term: "" });
    expect(classifyDiscoverQuery("   ")).toEqual({ mode: "keyword", term: "" });
  });

  it("語中の # はキーワード扱い（先頭でないため）", () => {
    expect(classifyDiscoverQuery("a#b")).toEqual({ mode: "keyword", term: "a#b" });
  });
});

describe("discoverKeywordFilters", () => {
  it("keywordFilter は search に # を付けない素の語を持つ（本文全文検索）", () => {
    const { keywordFilter } = discoverKeywordFilters("葉焼け", 50);
    expect(keywordFilter).toEqual({ kinds: [1], search: "葉焼け", limit: 50 });
  });

  it("tagFilter は同語を #t でも拾う（取りこぼし対策）", () => {
    const { tagFilter } = discoverKeywordFilters("葉焼け", 50);
    expect(tagFilter).toEqual({ kinds: [1], "#t": ["葉焼け"], limit: 50 });
  });

  it("前後空白は trim する", () => {
    const { keywordFilter } = discoverKeywordFilters("  徒長 ", 10);
    expect(keywordFilter.search).toBe("徒長");
  });

  it("limit を両フィルタに反映する", () => {
    const { keywordFilter, tagFilter } = discoverKeywordFilters("実生", 9);
    expect(keywordFilter.limit).toBe(9);
    expect(tagFilter.limit).toBe(9);
  });
});
