import { describe, expect, it } from "vitest";
import type { Genus, Loc, Variety, VarietyCategory } from "./variety-catalog.ts";
import { categoryLabel, genusLabel, pickLoc, varietyLabel } from "./plant-i18n.ts";

// #409 P2: 閲覧言語の表示名を引く純関数の「適用」観点だけを直に突く。
// ここで検証するのは **表示専用の文字列**（書き込むタグ・内部キーは ja 正準のまま不変＝別ファイルの核テスト）。

describe("pickLoc（#409 表示名の言語解決）", () => {
  const loc: Loc = { en: "Succulents", zh: "多肉植物", es: "Suculentas" };

  it("ja は loc が有っても常に base（原典）を返す", () => {
    expect(pickLoc("多肉植物", loc, "ja")).toBe("多肉植物");
  });

  it("ja は loc が undefined でも base を返す", () => {
    expect(pickLoc("多肉植物", undefined, "ja")).toBe("多肉植物");
  });

  it("en は loc.en の訳語を返す", () => {
    expect(pickLoc("多肉植物", loc, "en")).toBe("Succulents");
  });

  it("zh は loc.zh が base と同字でも loc 経路で返す（base 直返しでない）", () => {
    // loc.zh は base と同じ "多肉植物" だが、ja 以外は loc を引く経路を通る（早期 return しない）。
    expect(pickLoc("多肉植物", loc, "zh")).toBe("多肉植物");
  });

  it("es は loc.es の訳語を返す", () => {
    expect(pickLoc("多肉植物", loc, "es")).toBe("Suculentas");
  });

  it("非対応言語名（該当 loc キー無し）は base に graceful フォールバック", () => {
    // loc に es だけ無い場合、es は base に倒れる。
    const partial: Loc = { en: "Succulents" };
    expect(pickLoc("多肉植物", partial, "es")).toBe("多肉植物");
  });

  it("loc が undefined なら base へ素通り（属/品種の未 populate ケース）", () => {
    expect(pickLoc("グラキリス", undefined, "en")).toBe("グラキリス");
  });

  it("loc が空オブジェクト {} なら base へ素通り", () => {
    expect(pickLoc("グラキリス", {}, "en")).toBe("グラキリス");
  });

  it("loc.en が空文字 \"\" なら ?? を素通りして \"\" がそのまま返る（境界固定）", () => {
    // `loc?.[locale] ?? base` は値が "" のとき "" を返す（?? は null/undefined のみフォールバック）。
    // 空文字は data-guard 側で禁止するが、ここでは関数の境界挙動を固定する。
    const empty: Loc = { en: "" };
    expect(pickLoc("多肉植物", empty, "en")).toBe("");
  });
});

describe("categoryLabel（#409 カテゴリ表示名）", () => {
  const cat: VarietyCategory = {
    label: "多肉植物",
    loc: { en: "Succulents", zh: "多肉植物", es: "Suculentas" },
    genera: [],
  };

  it("en は訳語を返す", () => {
    expect(categoryLabel(cat, "en")).toBe("Succulents");
  });

  it("ja は base（label）を返す", () => {
    expect(categoryLabel(cat, "ja")).toBe("多肉植物");
  });

  it("loc 無しカテゴリは全 locale で base にフォールバック", () => {
    const noLoc: VarietyCategory = { label: "謎カテゴリ", genera: [] };
    expect(categoryLabel(noLoc, "en")).toBe("謎カテゴリ");
    expect(categoryLabel(noLoc, "zh")).toBe("謎カテゴリ");
    expect(categoryLabel(noLoc, "es")).toBe("謎カテゴリ");
    expect(categoryLabel(noLoc, "ja")).toBe("謎カテゴリ");
  });
});

describe("genusLabel（#409 属表示名）", () => {
  it("loc 無し属は base（name）へ素通り（PR1 は属未 populate）", () => {
    const genus: Genus = { name: "アガベ", pickable: true, varieties: [] };
    expect(genusLabel(genus, "en")).toBe("アガベ");
    expect(genusLabel(genus, "ja")).toBe("アガベ");
  });

  it("loc 付き属（合成）でも訳語を引ける（PR2 で属 222 を入れたときの経路）", () => {
    const genus: Genus = { name: "アガベ", pickable: true, loc: { en: "Agave" }, varieties: [] };
    expect(genusLabel(genus, "en")).toBe("Agave");
  });
});

describe("varietyLabel（#409 品種表示名）", () => {
  it("loc 無し品種は base（name）へ素通り（大半が固有名詞カルティバ）", () => {
    const v: Variety = { name: "チタノタ", sci: "Agave titanota" };
    expect(varietyLabel(v, "en")).toBe("チタノタ");
    expect(varietyLabel(v, "ja")).toBe("チタノタ");
  });
});
