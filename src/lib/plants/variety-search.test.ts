import { describe, expect, it } from "vitest";
import type { VarietyCategory } from "./variety-catalog.ts";
import {
  findPickableGenus,
  findVarietyGenus,
  foldForSearch,
  searchCatalog,
  tagsToUnpick,
} from "./variety-search.ts";

describe("foldForSearch", () => {
  it("カタカナをひらがなに寄せる", () => {
    expect(foldForSearch("パキポ")).toBe(foldForSearch("ぱきぽ"));
  });
  it("大文字小文字・全角英数を無視する", () => {
    expect(foldForSearch("ＰＡＣＨＹ")).toBe(foldForSearch("pachy"));
    expect(foldForSearch("ＡＢ１２")).toBe("ab12");
  });
  it("半角カナも全角カナ→ひらがなに寄せる", () => {
    expect(foldForSearch("ﾊﾟｷﾎﾟ")).toBe(foldForSearch("パキポ"));
  });
});

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

  it("ひらがな入力でカタカナ品種に一致する（fold）", () => {
    expect(searchCatalog(CATALOG, "ちたのた").map((h) => h.name)).toEqual(["チタノタ"]);
    expect(searchCatalog(CATALOG, "あがべ").some((h) => h.name === "アガベ")).toBe(true);
  });

  it("品種ヒットは由来属と pickable を持つ（上位属の前置に使う）", () => {
    const hit = searchCatalog(CATALOG, "チタノタ")[0]!;
    expect(hit).toMatchObject({ genus: "アガベ", genusPickable: true });
    const other = searchCatalog(CATALOG, "火星人")[0]!;
    expect(other).toMatchObject({ genus: "その他塊根", genusPickable: false });
  });
});

describe("findPickableGenus", () => {
  it("pickable な属を名前で引く（大小無視）", () => {
    const loc = findPickableGenus(CATALOG, "アガベ");
    expect(loc?.genus.name).toBe("アガベ");
    expect(loc?.category.label).toBe("多肉・塊根");
  });

  it("grouping 見出し（その他）は pickable でないので返さない", () => {
    expect(findPickableGenus(CATALOG, "その他塊根")).toBeNull();
  });

  it("品種名では属として引かない", () => {
    expect(findPickableGenus(CATALOG, "チタノタ")).toBeNull();
  });
});

describe("findVarietyGenus", () => {
  it("品種を含む属を引く", () => {
    expect(findVarietyGenus(CATALOG, "チタノタ")?.genus.name).toBe("アガベ");
  });

  it("non-pickable 属の品種も所在は引ける（pickable は呼び出し側で判定）", () => {
    const loc = findVarietyGenus(CATALOG, "火星人");
    expect(loc?.genus.name).toBe("その他塊根");
    expect(loc?.genus.pickable).toBe(false);
  });

  it("無ければ null", () => {
    expect(findVarietyGenus(CATALOG, "存在しない")).toBeNull();
  });
});

describe("tagsToUnpick（兄弟ルール）", () => {
  it("同属の兄弟品種が残るなら品種だけ外す", () => {
    const caption = "#アガベ #チタノタ #赤猫";
    expect(tagsToUnpick(caption, "チタノタ", CATALOG)).toEqual(["チタノタ"]);
  });

  it("兄弟が居らず・カテゴリに他も無ければ 品種＋属＋カテゴリ を外す", () => {
    const caption = "#多肉・塊根 #アガベ #チタノタ";
    expect(tagsToUnpick(caption, "チタノタ", CATALOG)).toEqual(["チタノタ", "アガベ", "多肉・塊根"]);
  });

  it("兄弟は居ないが同カテゴリの他属が残るならカテゴリは残す（属だけ連動）", () => {
    const caption = "#多肉・塊根 #アガベ #チタノタ #火星人";
    expect(tagsToUnpick(caption, "チタノタ", CATALOG)).toEqual(["チタノタ", "アガベ"]);
  });

  it("属名（品種でない）を外すときは自分だけ", () => {
    expect(tagsToUnpick("#多肉・塊根 #アガベ", "アガベ", CATALOG)).toEqual(["アガベ"]);
  });

  it("catalog 未ロード時は自分だけ", () => {
    expect(tagsToUnpick("#アガベ #チタノタ", "チタノタ", null)).toEqual(["チタノタ"]);
  });
});
