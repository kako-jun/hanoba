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

  it("#409 alias で検索しても hit.name は正準（鉄線→テッセン・write 正規化）", () => {
    // 別名「鉄線」でヒットしても hit.name は正準「テッセン」＝本文に書かれるタグは正準名に収束する。
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

  it("#409 alias で品種を引くと正準 name に収束する（鉄線→テッセン・write 正規化）", () => {
    // 別名「鉄線」で引いても品種位置には正準 name「テッセン」を置く（read=別名→正準・write=正準で表記が収束）。
    expect(tagsToPick(CATALOG, "鉄線")).toEqual(["バラ・草花", "クレマチス", "テッセン"]);
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
// シダ、コケ）。#312 でカテゴリが本文タグになると、この `#カテゴリ` タグが
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
    // 非 pickable 見出し属配下に label と同字の品種を持つ合成ケース。
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

// #409 P2 多言語: カテゴリだけに loc を載せた小カタログ（既存 CATALOG は触らない）。
// - 「多肉」 loc は en/es が base と別字、zh は base「タニク」と別字（女仙相当の合成）。
// - 「メセン」 loc は en/es が同字（Mesembs / Mesembs）＝dedup を突く。
// - 「観葉」 は loc 無し＝訳語で増えない無回帰を突く。
// 属/品種には loc を **意図的に** 載せない（PR1 はカテゴリだけ populate）。
const LOC_CATALOG: VarietyCategory[] = [
  {
    label: "タニク",
    loc: { en: "Succulents", zh: "ニョセン", es: "Suculentas" },
    genera: [
      { name: "アガベ", pickable: true, varieties: [{ name: "チタノタ", sci: "Agave titanota" }] },
    ],
  },
  {
    label: "メセン",
    loc: { en: "Mesembs", zh: "女仙", es: "Mesembs" },
    genera: [
      { name: "リトープス", pickable: true, varieties: [{ name: "日輪玉" }] },
    ],
  },
  {
    // loc 無しカテゴリ＝訳語では当たらない（ja 名でだけ当たる）。
    label: "観葉",
    genera: [
      { name: "モンステラ", pickable: true, varieties: [{ name: "アルボ" }] },
    ],
  },
];

describe("searchCatalog（#409 カテゴリ loc 多言語）", () => {
  it("en 訳語『Succulents』で当て、hit.name/hit.category は ja 正準・kind=category（書き込み不変）", () => {
    const hits = searchCatalog(LOC_CATALOG, "Succulents");
    const cat = hits.find((h) => h.kind === "category")!;
    // 訳語で当てても本文に入る name・由来 category は ja 正準のまま（訳さない）。
    expect(cat).toMatchObject({ name: "タニク", category: "タニク", kind: "category" });
  });

  it("es 訳語『Suculentas』でも ja 正準カテゴリに当たる", () => {
    const cat = searchCatalog(LOC_CATALOG, "Suculentas").find((h) => h.kind === "category")!;
    expect(cat).toMatchObject({ name: "タニク", category: "タニク", kind: "category" });
  });

  it("zh 訳語（label と別字＝女仙）で ja label『メセン』に当たる", () => {
    const cat = searchCatalog(LOC_CATALOG, "女仙").find((h) => h.kind === "category")!;
    expect(cat).toMatchObject({ name: "メセン", category: "メセン", kind: "category" });
  });

  it("hit.categoryLoc に loc オブジェクト全体が載る（表示用に持ち回る）", () => {
    const cat = searchCatalog(LOC_CATALOG, "Succulents").find((h) => h.kind === "category")!;
    expect(cat.categoryLoc).toEqual({ en: "Succulents", zh: "ニョセン", es: "Suculentas" });
  });

  it("en/es が同字（Mesembs）でも hit は 1 件に dedup", () => {
    const hits = searchCatalog(LOC_CATALOG, "Mesembs").filter((h) => h.kind === "category");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.name).toBe("メセン");
  });

  it("部分一致・大文字小文字・全角を fold して訳語に当たる", () => {
    // "succ"（部分・小文字）、"ＳＵＣＣ"（全角大文字）どちらも Succulents→タニク に当たる。
    expect(searchCatalog(LOC_CATALOG, "succ").some((h) => h.kind === "category" && h.name === "タニク")).toBe(true);
    expect(searchCatalog(LOC_CATALOG, "ＳＵＣＣ").some((h) => h.kind === "category" && h.name === "タニク")).toBe(true);
  });

  it("loc 無しカテゴリ（観葉）は ja 名でだけ当たり、訳語で増えない（無回帰）", () => {
    expect(searchCatalog(LOC_CATALOG, "観葉").some((h) => h.kind === "category" && h.name === "観葉")).toBe(true);
    // 訳語っぽい英語では当たらない（loc が無いので en 照合対象が無い）。
    expect(searchCatalog(LOC_CATALOG, "Foliage").some((h) => h.kind === "category")).toBe(false);
  });

  it("属・品種ヒットには categoryLoc は載るが loc は付かない（PR1 は属/品種未 populate）", () => {
    // VarietyHit に variety/genus 自身の loc フィールドは無い（型上 categoryLoc のみ）。
    const genus = searchCatalog(LOC_CATALOG, "アガベ").find((h) => h.kind === "genus")!;
    const variety = searchCatalog(LOC_CATALOG, "チタノタ").find((h) => h.kind === "variety")!;
    expect(genus).not.toHaveProperty("loc");
    expect(variety).not.toHaveProperty("loc");
    // 由来カテゴリの loc は持ち回る（表示用）。
    expect(genus.categoryLoc).toEqual({ en: "Succulents", zh: "ニョセン", es: "Suculentas" });
  });
});

describe("buildCatalogAliasIndex（#409 カテゴリ言語横断）", () => {
  const index = buildCatalogAliasIndex(LOC_CATALOG);

  it("index.get('succulents') が ja 正準『タニク』を小文字で含む（訳語→正準）", () => {
    expect(index.get("succulents")).toContain("タニク");
  });

  it("index.get('suculentas')（es）も同じ別名集合に ja 正準を含む", () => {
    expect(index.get("suculentas")).toContain("タニク");
  });

  it("index.get('タニク')（ja 正準）も同じ集合を引ける（双方向）", () => {
    expect(index.get("タニク")).toContain("succulents");
    expect(index.get("タニク")).toContain("タニク");
  });

  it("zh『女仙』が ja 正準『メセン』を含む", () => {
    expect(index.get("女仙")).toContain("メセン");
  });

  it("キーは小文字正規化される（大文字入力は別途・索引キーは小文字のみ）", () => {
    expect(index.has("succulents")).toBe(true);
    expect(index.has("Succulents")).toBe(false);
  });

  it("loc 無しカテゴリの訳語（Foliage）は索引キーに無い（undefined）", () => {
    expect(index.get("foliage")).toBeUndefined();
  });

  it("label と loc 値は同一集合（dedup 済・小文字で重複なし）", () => {
    const set = index.get("タニク")!;
    expect(set).toEqual([...new Set(set)]);
    // ja label・en・zh・es が全部入る（英字は小文字化・カナはそのまま）。
    expect(set).toEqual(expect.arrayContaining(["タニク", "succulents", "ニョセン", "suculentas"]));
  });
});

// #409 cross-language filter の核: 書き込み側（searchCatalog/tagsToPick/tagsToPickAt）は
// **locale 引数を受け取らない純関数**＝閲覧言語が何であれ ja 正準文字列だけを返す。
// 訳語 query 由来の hit を渡しても、本文に入る name は ja のまま（categoryLoc は表示専用で name を汚さない）。
describe("書き込みタグの locale 不変（#409 cross-language filter の核）", () => {
  it("searchCatalog は locale を引数に取らない（訳語 query でも name/category は ja 正準）", () => {
    // en 訳語で引いた結果も、ja 入力で引いた結果も、書き込み name は同じ ja 正準。
    const viaEn = searchCatalog(LOC_CATALOG, "Succulents").find((h) => h.kind === "category")!;
    const viaJa = searchCatalog(LOC_CATALOG, "タニク").find((h) => h.kind === "category")!;
    expect(viaEn.name).toBe("タニク");
    expect(viaJa.name).toBe("タニク");
    expect(viaEn.name).toBe(viaJa.name);
    expect(viaEn.category).toBe("タニク");
  });

  it("categoryLoc を持ちつつ name は ja のまま（loc が書き込み値を汚染しない）", () => {
    const cat = searchCatalog(LOC_CATALOG, "Suculentas").find((h) => h.kind === "category")!;
    // categoryLoc が存在しても name は ja 正準（test18 と別観点で同時 assert）。
    expect(cat.categoryLoc).toBeDefined();
    expect(cat.name).toBe("タニク");
  });

  it("tagsToPick は locale を引数に取らない（ja 入力→ja 出力の回帰ガード）", () => {
    // 階層タグはすべて ja 正準（属を持つカテゴリも品種も訳さない）。
    expect(tagsToPick(LOC_CATALOG, "チタノタ")).toEqual(["タニク", "アガベ", "チタノタ"]);
    expect(tagsToPick(LOC_CATALOG, "タニク")).toEqual(["タニク"]);
  });

  it("tagsToPickAt も locale を引数に取らず ja 正準の階層を返す", () => {
    expect(tagsToPickAt("タニク", "アガベ", "チタノタ")).toEqual(["タニク", "アガベ", "チタノタ"]);
  });
});
