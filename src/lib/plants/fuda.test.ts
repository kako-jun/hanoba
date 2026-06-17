import { describe, expect, it } from "vitest";
import { buildFuda } from "./fuda.ts";
import { VARIETY_CATALOG, type VarietyCategory } from "./variety-catalog.ts";

// 期待値は実カタログ（VARIETY_CATALOG）と実辞書（dictionary.ts）から確定する（#182/#23）。
// 札は「学名（sci）＋最も有名な和名（name）」を並べた1枚。最も具体的な和名を name に持つ。
// - 塊根植物 › パキポディウム › { グラキリス(sci あり), 象牙宮(sci あり), ブレビカウレ(sci あり), ... }
// - dictionary: アガベ→Agave / チタノタ→Agave titanota /
//   パキポディウム→Pachypodium / グラキリス→Pachypodium rosulatum var. gracilius
//
// sci の解決順（catalog.sci → dictionary 品種 → dictionary 属 → null）は、実カタログの学名付与が
// 進むと「sci 無し品種」が消えて陳腐化するため、**合成カタログ SYNTH で決定的に検証する**（#182）。
// dictionary は安定なので、属名に実在の「アガベ」(→Agave)、辞書外に架空名を使えば決定的。
const SYNTH: VarietyCategory[] = [
  {
    label: "テスト科",
    genera: [
      // 属名「アガベ」は dictionary にあり（→Agave）。品種で catalog.sci 有無を作り分ける。
      { name: "アガベ", pickable: true, varieties: [{ name: "合成種A", sci: "Agave fakea" }, { name: "合成種B" }] },
      // 属名「ゲンクウ属」は dictionary 外＝属 sci も引けない。
      { name: "ゲンクウ属", pickable: true, varieties: [{ name: "合成種C" }] },
    ],
  },
];

describe("buildFuda", () => {
  it("属＋品種は品種1枚に畳む（属単独は出さない）", () => {
    const fuda = buildFuda(["パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス" });
  });

  it("品種単独タグでも札になる（属名は name に出さない）", () => {
    // #181 では属タグも付くが、品種単独タグでも品種の札になる。属名は name に乗らない。
    const fuda = buildFuda(["グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス" });
  });

  it("同属の複数品種はそれぞれ札になり、属単独は出ない（順序は catalog 出現順）", () => {
    // アガベの varieties は チタノタ(idx0) → ... → 白鯨(idx2) の順。
    const fuda = buildFuda(["アガベ", "チタノタ", "白鯨"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.name)).toEqual(["チタノタ", "白鯨"]);
  });

  it("カテゴリ（VarietyCategory.label）は札にしない", () => {
    expect(buildFuda(["塊根植物"], VARIETY_CATALOG)).toEqual([]);
  });

  it("カテゴリ＋属＋品種が混ざってもカテゴリは無視し品種だけ残す", () => {
    const fuda = buildFuda(["塊根植物", "パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス" });
  });

  it("属単独（品種タグ無し）は属名の札を出す", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "アガベ" });
  });

  it("学名は catalog の variety.sci を最優先する（塊根植物の実データ）", () => {
    // ブレビカウレ → catalog.sci = Pachypodium brevicaule。
    const fuda = buildFuda(["ブレビカウレ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "ブレビカウレ", sci: "Pachypodium brevicaule" });
  });

  it("catalog.sci が無くても dictionary に品種があれば品種 sci を併記する", () => {
    // チタノタ は catalog.sci 無し・dictionary に チタノタ→Agave titanota。
    const fuda = buildFuda(["チタノタ"], VARIETY_CATALOG);
    expect(fuda[0]).toMatchObject({ name: "チタノタ", sci: "Agave titanota" });
  });

  it("catalog.sci を最優先する（合成カタログで決定的）", () => {
    // 合成種A は catalog.sci="Agave fakea" を持つ＝dictionary より優先。
    const fuda = buildFuda(["合成種A"], SYNTH);
    expect(fuda[0]).toMatchObject({ name: "合成種A", sci: "Agave fakea" });
  });

  it("学名は catalog.sci も dictionary 品種も無ければ属 sci にフォールバックする（合成カタログ）", () => {
    // 合成種B は catalog.sci 無し・dict 外。属「アガベ」が dict にある → Agave。
    const fuda = buildFuda(["合成種B"], SYNTH);
    expect(fuda[0]).toMatchObject({ name: "合成種B", sci: "Agave" });
  });

  it("学名は catalog.sci も品種も属も辞書外なら null（和名のみ＝グレースフル・合成カタログ）", () => {
    // 合成種C は catalog.sci 無し・dict 外、属「ゲンクウ属」も dict 外 → null。
    const fuda = buildFuda(["合成種C"], SYNTH);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "合成種C", sci: null });
  });

  it("属単独でも辞書から属 sci を引く", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda[0]).toMatchObject({ name: "アガベ", sci: "Agave" });
  });

  it("非 pickable 見出し属（原種）配下の品種は品種和名で出し、見出し語を出さない（should #1 回帰ガード）", () => {
    // ビカクシダ › 原種(pickable:false) › リドレイ。札の name は「リドレイ」だけ＝「原種 リドレイ」に
    // ならない（見出し語を name に出さない）。sci の有無は学名付与の進捗で変わるので assert しない。
    const fuda = buildFuda(["リドレイ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("リドレイ");
    expect(fuda[0]!.name).not.toContain("原種");
  });

  it("非 pickable 見出し属はタグしても札にしない（見出し語は表に出ない）", () => {
    // 「原種」は pickable:false の見出し属＝札にならない。
    expect(buildFuda(["原種"], VARIETY_CATALOG)).toEqual([]);
  });

  it("辞書外・世話タグ・他クライアント由来タグは無視する", () => {
    const fuda = buildFuda(["水やり", "謎タグ", "アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "アガベ" });
  });

  it("重複タグは1枚に dedupe する", () => {
    const fuda = buildFuda(["グラキリス", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス" });
  });

  it("前後空白・英大小が混じっても照合する（属 alias 経由）", () => {
    // ヒマワリ属の alias に "sunflower" がある。trim + toLowerCase 照合を確認。
    const fuda = buildFuda(["  SunFlower  "], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "ヒマワリ" });
  });

  it("品種の alias 経由タグでも札になり、name は catalog の canonical 品種名を使う", () => {
    // コケ各種(pickable:false) › ホソバオキナゴケ の alias "山苔" でヒット。
    // 来たタグ（山苔）でなく canonical 名（ホソバオキナゴケ）を name にする。見出し語も出ない。
    // sci の有無は学名付与の進捗で変わるので name のみ assert。
    const fuda = buildFuda(["山苔"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("ホソバオキナゴケ");
  });

  it("key は name で組む（dedupe 鍵）", () => {
    expect(buildFuda(["グラキリス"], VARIETY_CATALOG)[0]!.key).toBe("グラキリス");
    expect(buildFuda(["アガベ"], VARIETY_CATALOG)[0]!.key).toBe("アガベ");
  });
});
