import { describe, expect, it } from "vitest";
import { VARIETY_CATALOG } from "./variety-catalog.ts";
import { searchCatalog } from "./variety-search.ts";

// #168: 基本種・別ジャンル（水草等）の網羅 guard。マス層が自分の植物を検索で見つけられること
// （= 共通タグへの収束の前提）を、代表種が VARIETY_CATALOG から検索で拾えることで担保する。

describe("基本種・別ジャンルの存在確認（#168）", () => {
  // 通称（本文 # に入る name）で 1 件以上ヒットすること。
  const basics = [
    "ひまわり",
    "パキラ",
    "ドラセナ",
    "アイビー",
    "チューリップ",
    "スイセン",
    "バジル",
    "シソ",
    "ツツジ",
    "キンモクセイ",
    "モミジ",
    "コスモス",
    "アサガオ",
    "キク",
    "アヌビアス",
    "ミクロソリウム",
    "スイレン",
    "シダ",
    "苔",
  ];

  for (const term of basics) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // alias 経由（表記揺れ）でも拾えること。
  const aliasTerms = ["向日葵", "ヘデラ", "水仙", "金木犀", "コケ"];
  for (const term of aliasTerms) {
    it(`alias「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }
});

describe("カタログの健全性", () => {
  it("カテゴリ label がユニーク", () => {
    const labels = VARIETY_CATALOG.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("全 Genus の varieties に空文字 name が無い", () => {
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        for (const v of genus.varieties) {
          expect(v.name.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("属名にも空文字が無い", () => {
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        expect(genus.name.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
