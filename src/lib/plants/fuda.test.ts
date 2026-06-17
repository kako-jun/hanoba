import { describe, expect, it } from "vitest";
import { buildFuda } from "./fuda.ts";
import { VARIETY_CATALOG } from "./variety-catalog.ts";

// 期待値は実カタログ（VARIETY_CATALOG）と実辞書（dictionary.ts）から確定する。
// - 塊根植物 › パキポディウム › { グラキリス, 象牙宮, ブレビカウレ, ... }
// - 多肉植物 › アガベ › { チタノタ(idx0), オテロイ(idx1), 白鯨(idx2), ... }
// - dictionary: アガベ→Agave / チタノタ→Agave titanota /
//   パキポディウム→Pachypodium / グラキリス→Pachypodium rosulatum var. gracilius

describe("buildFuda", () => {
  it("属＋品種は1枚に畳む（属単独 variety:null は出さない）", () => {
    const fuda = buildFuda(["パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "パキポディウム", variety: "グラキリス" });
  });

  it("品種だけでも索引が属を補完する", () => {
    // #181 では属タグも付くが、品種単独タグでも索引から属を引いて札は属＋品種になる。
    const fuda = buildFuda(["グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "パキポディウム", variety: "グラキリス" });
  });

  it("同属の複数品種はそれぞれ札になり、属単独は出ない（順序は catalog 出現順）", () => {
    // アガベの varieties は チタノタ(idx0) → ... → 白鯨(idx2) の順。
    const fuda = buildFuda(["アガベ", "チタノタ", "白鯨"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => ({ genus: f.genus, variety: f.variety }))).toEqual([
      { genus: "アガベ", variety: "チタノタ" },
      { genus: "アガベ", variety: "白鯨" },
    ]);
  });

  it("カテゴリ（VarietyCategory.label）は札にしない", () => {
    expect(buildFuda(["塊根植物"], VARIETY_CATALOG)).toEqual([]);
  });

  it("カテゴリ＋属＋品種が混ざってもカテゴリは無視し属＋品種だけ残す", () => {
    const fuda = buildFuda(["塊根植物", "パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "パキポディウム", variety: "グラキリス" });
  });

  it("属単独（品種タグ無し）は variety:null の札を出す", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "アガベ", variety: null });
  });

  it("学名は品種が辞書にあれば品種 sci を併記する", () => {
    // グラキリス → Pachypodium rosulatum var. gracilius（dictionary.ts）。
    const fuda = buildFuda(["グラキリス"], VARIETY_CATALOG);
    expect(fuda[0]!.sci).toBe("Pachypodium rosulatum var. gracilius");
  });

  it("学名は品種が辞書外なら属 sci にフォールバックする", () => {
    // 白鯨は dict 外・アガベ → Agave。象牙宮は dict 外・パキポディウム → Pachypodium。
    const agave = buildFuda(["白鯨"], VARIETY_CATALOG);
    expect(agave[0]!.sci).toBe("Agave");
    const pachy = buildFuda(["象牙宮"], VARIETY_CATALOG);
    expect(pachy[0]!.sci).toBe("Pachypodium");
  });

  it("学名は品種も属も辞書外なら null", () => {
    // コノフィツム属・ブルゲリ品種はどちらも dictionary.ts に無い。
    const fuda = buildFuda(["コノフィツム", "ブルゲリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "コノフィツム", variety: "ブルゲリ", sci: null });
  });

  it("属単独でも辞書から属 sci を引く", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda[0]!.sci).toBe("Agave");
  });

  it("辞書外・世話タグ・他クライアント由来タグは無視する", () => {
    const fuda = buildFuda(["水やり", "謎タグ", "アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "アガベ", variety: null });
  });

  it("重複タグは1枚に dedupe する", () => {
    const fuda = buildFuda(["グラキリス", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "パキポディウム", variety: "グラキリス" });
  });

  it("前後空白・英大小が混じっても照合する（属 alias 経由）", () => {
    // ヒマワリ属の alias に "sunflower" がある。trim + toLowerCase 照合を確認。
    const fuda = buildFuda(["  SunFlower  "], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "ヒマワリ", variety: null });
  });

  it("品種の alias 経由タグでも札になる", () => {
    // コケ各種 › ホソバオキナゴケ の alias "山苔" でヒット。表示品種は来たタグ（山苔）を使う。
    const fuda = buildFuda(["山苔"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ genus: "コケ各種", variety: "山苔", sci: null });
  });

  it("key は genus/variety で組み、属単独は末尾が空", () => {
    expect(buildFuda(["グラキリス"], VARIETY_CATALOG)[0]!.key).toBe("パキポディウム/グラキリス");
    expect(buildFuda(["アガベ"], VARIETY_CATALOG)[0]!.key).toBe("アガベ/");
  });
});
