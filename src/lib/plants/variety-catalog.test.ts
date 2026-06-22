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

describe("穀物カテゴリ・代表品種の検索到達性（#214）", () => {
  // 穀物カテゴリの代表品種が searchCatalog で拾えること（マス層の検索からの収束を担保）。
  const grains = ["コシヒカリ", "山田錦", "ダッタンソバ", "デントコーン"];
  for (const term of grains) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // イネ属の alias（表記揺れ）でも pickable 属として拾えること。
  const grainAliasTerms = ["稲", "コメ"];
  for (const term of grainAliasTerms) {
    it(`alias「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }
});

describe("熱帯果樹カテゴリ・代表品種の検索到達性（#216）", () => {
  // 熱帯果樹の代表属・品種が searchCatalog で拾えること（マス層の検索からの収束を担保）。
  const tropical = ["マンゴー", "バナナ", "ドラゴンフルーツ", "甲州"];
  for (const term of tropical) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // ドラゴンフルーツ属の alias（表記揺れ）でも拾えること。
  it(`alias「ピタヤ」が検索で 1 件以上ヒットする`, () => {
    expect(searchCatalog(VARIETY_CATALOG, "ピタヤ").length).toBeGreaterThan(0);
  });
});

describe("芍薬・牡丹カテゴリ・代表品種の検索到達性（#217）", () => {
  // 芍薬・牡丹の代表属・品種が searchCatalog で拾えること。
  const peony = ["シャクヤク", "ボタン", "サラ・ベルナール"];
  for (const term of peony) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // ボタン属の alias（表記揺れ）でも拾えること。
  it(`alias「牡丹」が検索で 1 件以上ヒットする`, () => {
    expect(searchCatalog(VARIETY_CATALOG, "牡丹").length).toBeGreaterThan(0);
  });
});

describe("山菜・野草カテゴリ・代表品種の検索到達性（#218）", () => {
  // 山菜・野草の代表属が searchCatalog で拾えること。
  const wild = ["フキ", "ミョウガ", "ウド", "タラの芽"];
  for (const term of wild) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }
});

describe("属取りこぼし救済・代表種の検索到達性（#220）", () => {
  // 取りこぼしていた属・品種が searchCatalog で拾えること。
  const rescued = [
    "ユッカ",
    "黒法師",
    "カンナ",
    "ゴールドクレスト",
    "コキア",
    "アーティチョーク",
    "サルミアナ",
    "こんぺいとう",
    "ヴァッセイ",
    "アンブリッジローズ",
  ];
  for (const term of rescued) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // コキア属の品種名「ホウキギ」（標準和名）でも拾えること。
  it(`「ホウキギ」が検索で 1 件以上ヒットする`, () => {
    expect(searchCatalog(VARIETY_CATALOG, "ホウキギ").length).toBeGreaterThan(0);
  });
});

describe("カタログの健全性", () => {
  it("Platycerium bifurcatum は総称でなく「ビフルカツム」1件として登録する（#341）", () => {
    const bifurcatum = VARIETY_CATALOG
      .flatMap((category) => category.genera)
      .flatMap((genus) => genus.varieties)
      .filter((variety) => variety.sci === "Platycerium bifurcatum");

    expect(bifurcatum).toEqual([{ name: "ビフルカツム", sci: "Platycerium bifurcatum" }]);
  });

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

  it("#409 同一属内に同じ品種 name が重複しない（真の重複は1エントリに収束）", () => {
    const dups: string[] = [];
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        const seen = new Map<string, number>();
        for (const v of genus.varieties) seen.set(v.name, (seen.get(v.name) ?? 0) + 1);
        for (const [name, n] of seen) if (n > 1) dups.push(`${cat.label}/${genus.name}: ${name} x${n}`);
      }
    }
    expect(dups).toEqual([]);
  });

  it("#409 Platycerium veitchii はベイチー1件＋alias ヴェイチー に統合（表記揺れを1エントリへ）", () => {
    const veitchii = VARIETY_CATALOG
      .flatMap((category) => category.genera)
      .flatMap((genus) => genus.varieties)
      .filter((variety) => variety.sci === "Platycerium veitchii");
    expect(veitchii).toEqual([{ name: "ベイチー", sci: "Platycerium veitchii", aliases: ["ヴェイチー"] }]);
    // 別検索（ヴェイチー）でも正準「ベイチー」に到達する。
    expect(searchCatalog(VARIETY_CATALOG, "ヴェイチー").map((h) => h.name)).toContain("ベイチー");
  });

  it("#409/#315 ベイチーは Anthurium veitchii（別属の同名）と混ざらない（属文脈で別管理）", () => {
    const anthurium = VARIETY_CATALOG
      .flatMap((category) => category.genera)
      .flatMap((genus) => genus.varieties)
      .filter((variety) => variety.sci === "Anthurium veitchii");
    // Anthurium 側の「ベイチー」は別植物として温存（統合・移動しない）。
    expect(anthurium).toEqual([{ name: "ベイチー", sci: "Anthurium veitchii" }]);
  });
});
