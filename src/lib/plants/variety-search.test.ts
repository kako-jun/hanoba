import { describe, expect, it } from "vitest";
import type { VarietyCategory } from "./variety-catalog.ts";
import {
  buildCatalogAliasIndex,
  findPickableGenus,
  findVarietyGenus,
  findVarietyGenusInCaption,
  foldForSearch,
  searchCatalog,
  tagsToPick,
  tagsToPickAt,
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
          { name: "チタノタ", sci: "Agave titanota" },
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

  it("品種ヒットは catalog の学名(sci)を持ち運ぶ（併記表示用・#200）", () => {
    expect(searchCatalog(CATALOG, "チタノタ")[0]).toMatchObject({ name: "チタノタ", sci: "Agave titanota" });
  });

  it("sci の無い品種ヒットは sci を undefined にする（#200）", () => {
    expect(searchCatalog(CATALOG, "赤猫")[0]!.sci).toBeUndefined();
  });

  it("属ヒットには sci を付けない（学名は品種だけ・#200）", () => {
    const genus = searchCatalog(CATALOG, "アガベ").find((h) => h.kind === "genus")!;
    expect(genus.sci).toBeUndefined();
  });

  it("カテゴリもヒットする（#312・「ハーブ」と打って `#ハーブ` を付けられる）", () => {
    const hits = searchCatalog(CATALOG, "多肉");
    const cat = hits.find((h) => h.kind === "category");
    expect(cat).toMatchObject({ name: "多肉・塊根", kind: "category" });
  });

  it("カテゴリヒットは fold で拾う（ひらがな・部分一致）", () => {
    expect(searchCatalog(CATALOG, "ばら").some((h) => h.kind === "category" && h.name === "バラ・草花")).toBe(true);
  });
});

describe("tagsToPick（#312・概要→詳細の全階層）", () => {
  it("品種は カテゴリ→属→品種 の順で返す", () => {
    expect(tagsToPick(CATALOG, "チタノタ")).toEqual(["多肉・塊根", "アガベ", "チタノタ"]);
  });

  it("非 pickable 見出し属の品種は カテゴリ→品種（属は前置しない）", () => {
    expect(tagsToPick(CATALOG, "火星人")).toEqual(["多肉・塊根", "火星人"]);
  });

  it("pickable 属は カテゴリ→属", () => {
    expect(tagsToPick(CATALOG, "アガベ")).toEqual(["多肉・塊根", "アガベ"]);
  });

  it("カテゴリ単独はそれ自身だけ", () => {
    expect(tagsToPick(CATALOG, "多肉・塊根")).toEqual(["多肉・塊根"]);
  });

  it("catalog に無いタグ（世話/freeform）は前置せずそのまま", () => {
    expect(tagsToPick(CATALOG, "水やり")).toEqual(["水やり"]);
  });

  it("alias で品種を引いても階層は付く（鉄線→テッセン経路の属/カテゴリ）", () => {
    // alias「鉄線」で引くと canonical でなく来たタグ名を品種位置に置く（UI は canonical を渡すが純関数は名前を尊重）。
    expect(tagsToPick(CATALOG, "鉄線")).toEqual(["バラ・草花", "クレマチス", "鉄線"]);
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

  it("属を外すと、カテゴリに他属が無ければカテゴリも連動撤去（#312）", () => {
    // 属はカテゴリと一緒に付くようになったので、属だけ残してカテゴリを孤立させない。
    expect(tagsToUnpick("#多肉・塊根 #アガベ", "アガベ", CATALOG)).toEqual(["アガベ", "多肉・塊根"]);
  });

  it("属を外すが同カテゴリに他属（の品種）が残ればカテゴリは残す（#312）", () => {
    // 火星人＝その他塊根（同カテゴリの別属）の品種が生存 → カテゴリは残す。
    expect(tagsToUnpick("#多肉・塊根 #アガベ #火星人", "アガベ", CATALOG)).toEqual(["アガベ"]);
  });

  it("カテゴリ（属でも品種でもない）を外すときは自分だけ（下位は触らない）", () => {
    expect(tagsToUnpick("#多肉・塊根 #アガベ #チタノタ", "多肉・塊根", CATALOG)).toEqual(["多肉・塊根"]);
  });

  it("catalog 未ロード時は自分だけ", () => {
    expect(tagsToUnpick("#アガベ #チタノタ", "チタノタ", null)).toEqual(["チタノタ"]);
  });
});

// 本番カタログには **品種名＝カテゴリ label** が同字のデータがある（エアプランツ›チランジア›「エアプランツ」、
// ビカクシダ›原種›「ビカクシダ」、シダ、コケ）。#312 でカテゴリが本文タグになると、この `#カテゴリ` タグが
// 同名品種の兄弟と誤認され、品種を外しても上位が孤立して残るリグレッションが起きる。これを衝突ガードで防ぐ。
const COLLIDE: VarietyCategory[] = [
  {
    // pickable 属配下に label と同字の品種を持つ（エアプランツ相当）。
    label: "ソラ",
    genera: [
      { name: "チラ", pickable: true, varieties: [{ name: "ソラ" }, { name: "イオナ" }] },
    ],
  },
  {
    // 非 pickable 見出し属配下に label と同字の品種を持つ（ビカクシダ相当）。
    label: "ビカク",
    genera: [
      { name: "原種", pickable: false, varieties: [{ name: "ビカク" }, { name: "リドレ" }] },
    ],
  },
];

describe("tagsToUnpick（#312・カテゴリ label＝品種名 の衝突ガード）", () => {
  it("compose→解除の往復: 品種を外すと 品種→属→カテゴリ を連動撤去（カテゴリタグを兄弟と誤認しない）", () => {
    // tagsToPick("イオナ") = ["ソラ","チラ","イオナ"]。caption からイオナを外す。
    const caption = "#ソラ #チラ #イオナ";
    expect(tagsToUnpick(caption, "イオナ", COLLIDE)).toEqual(["イオナ", "チラ", "ソラ"]);
  });

  it("非 pickable 見出し属でも: 品種を外すと 品種→カテゴリ を連動撤去（見出し属はタグでない）", () => {
    // tagsToPick("リドレ") = ["ビカク","リドレ"]。caption からリドレを外す。
    const caption = "#ビカク #リドレ";
    expect(tagsToUnpick(caption, "リドレ", COLLIDE)).toEqual(["リドレ", "ビカク"]);
  });

  it("label と同字の品種そのもの（ソラ）を外すときも上位（属）を孤立させない", () => {
    // 「ソラ」品種を選ぶと tagsToPick はカテゴリ=品種で畳んで ["ソラ","チラ"]（#312 dedup）。
    // この本文からソラを外す＝品種ソラ解除。属チラに他兄弟が無ければチラも外す。
    const caption = "#ソラ #チラ";
    expect(tagsToUnpick(caption, "ソラ", COLLIDE)).toEqual(["ソラ", "チラ"]);
  });
});

// CATALOG の「モンタナ」は アガベ（多肉・塊根）と クレマチス（バラ・草花）に跨る同名品種。
// 名前先勝ち（findVarietyGenus）は先頭アガベに倒れるが、ドリルダウン/検索の文脈や本文の文脈で
// 正しい所在に解決すべき（#315）。
describe("tagsToPickAt（#315・既知文脈で階層化＝同名跨ぎを正す）", () => {
  it("文脈の属で階層化する（バラのモンタナ＝クレマチス、多肉のモンタナ＝アガベ）", () => {
    expect(tagsToPickAt("バラ・草花", "クレマチス", "モンタナ")).toEqual(["バラ・草花", "クレマチス", "モンタナ"]);
    expect(tagsToPickAt("多肉・塊根", "アガベ", "モンタナ")).toEqual(["多肉・塊根", "アガベ", "モンタナ"]);
  });

  it("genusName=null は属を前置しない（非 pickable 見出し属・カテゴリ/属が leaf）", () => {
    expect(tagsToPickAt("多肉・塊根", null, "火星人")).toEqual(["多肉・塊根", "火星人"]);
    expect(tagsToPickAt("バラ・草花", null, "バラ・草花")).toEqual(["バラ・草花"]); // カテゴリ leaf は dedupe
  });
});

describe("findVarietyGenusInCaption（#315・本文文脈で同名を曖昧さ回避）", () => {
  it("本文に親（属/カテゴリ）タグがある所在を優先する", () => {
    // 名前先勝ちは アガベ。だが本文にクレマチスがあれば クレマチス を返す。
    expect(findVarietyGenus(CATALOG, "モンタナ")?.genus.name).toBe("アガベ");
    expect(findVarietyGenusInCaption(CATALOG, "モンタナ", "#バラ・草花 #クレマチス #モンタナ")?.genus.name).toBe("クレマチス");
    expect(findVarietyGenusInCaption(CATALOG, "モンタナ", "#多肉・塊根 #アガベ #モンタナ")?.genus.name).toBe("アガベ");
  });

  it("文脈一致が無ければ catalog 先頭（findVarietyGenus 互換）", () => {
    expect(findVarietyGenusInCaption(CATALOG, "モンタナ", "#モンタナ")?.genus.name).toBe("アガベ");
    expect(findVarietyGenusInCaption(CATALOG, "存在しない", "")).toBeNull();
  });
});

describe("tagsToUnpick（#315・同名跨ぎは本文文脈で正しい階層を畳む）", () => {
  it("バラ文脈のモンタナを外すと クレマチス→バラ・草花 を連動撤去（多肉側を消そうとしない）", () => {
    expect(tagsToUnpick("#バラ・草花 #クレマチス #モンタナ", "モンタナ", CATALOG)).toEqual([
      "モンタナ",
      "クレマチス",
      "バラ・草花",
    ]);
  });
});

describe("buildCatalogAliasIndex（#303・discover の catalog 別名展開）", () => {
  const index = buildCatalogAliasIndex(CATALOG);

  it("品種の別名を双方向に引ける（鉄線 ↔ テッセン）", () => {
    expect(index.get("鉄線")).toEqual(["テッセン", "鉄線"]);
    expect(index.get("テッセン")).toEqual(["テッセン", "鉄線"]);
  });

  it("別名の無い pickable 属/品種は自分だけ", () => {
    expect(index.get("アガベ")).toEqual(["アガベ"]);
    expect(index.get("チタノタ")).toEqual(["チタノタ"]);
  });

  it("非 pickable 見出し属はキーにしないが、その配下品種はキーになる", () => {
    expect(index.has("その他塊根")).toBe(false);
    expect(index.get("火星人")).toEqual(["火星人"]);
  });

  it("辞書に無い語は索引に無い（呼び出し側で素のタグに倒す）", () => {
    expect(index.get("存在しない")).toBeUndefined();
  });
});
