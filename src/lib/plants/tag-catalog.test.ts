import { describe, expect, it } from "vitest";
import { TAG_CATEGORIES } from "./tag-catalog.ts";

const postType = TAG_CATEGORIES.find((c) => c.label === "投稿の種類")!;
// 世話と記録は #353 で「世話・記録」1枠に統合（境界が曖昧＝発芽/発根が世話・開花が記録は分からない）。
const careRecord = TAG_CATEGORIES.find((c) => c.label === "世話・記録")!;
const trait = TAG_CATEGORIES.find((c) => c.label === "特徴")!;
const form = TAG_CATEGORIES.find((c) => c.label === "仕立て")!;

describe("tag-catalog", () => {
  it("世話・記録を1枠に統合して持つ（#353）", () => {
    expect(careRecord).toBeTruthy();
    // 旧「世話」「記録」の独立枠は持たない。
    expect(TAG_CATEGORIES.find((c) => c.label === "世話")).toBeUndefined();
    expect(TAG_CATEGORIES.find((c) => c.label === "記録")).toBeUndefined();
  });

  it("入手からの時系列＝入手で始まる（#353）", () => {
    expect(careRecord.tags[0]).toBe("入手");
  });

  it("propagation（発根→発芽→実生）は世話・記録の中で隣接している（index が連続・#169/#353）", () => {
    const i根 = careRecord.tags.indexOf("発根");
    const i芽 = careRecord.tags.indexOf("発芽");
    const i実 = careRecord.tags.indexOf("実生");
    expect(i根).toBeGreaterThanOrEqual(0);
    expect(i芽).toBe(i根 + 1);
    expect(i実).toBe(i芽 + 1);
  });

  it("「発根管理」は近接同義の「発根」へ寄せて重複させない（#169）", () => {
    const all = TAG_CATEGORIES.flatMap((c) => c.tags);
    expect(all).not.toContain("発根管理");
  });

  it("label はユニーク", () => {
    const labels = TAG_CATEGORIES.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("空のタグ名が無い", () => {
    for (const c of TAG_CATEGORIES) {
      for (const t of c.tags) expect(t.trim()).not.toBe("");
    }
  });

  it("各行内のタグはユニーク（重複なし）", () => {
    for (const c of TAG_CATEGORIES) {
      expect(new Set(c.tags).size).toBe(c.tags.length);
    }
  });

  it("品種と別軸の横断タグ「特徴」「仕立て」を持つ（#221）", () => {
    expect(trait).toBeTruthy();
    expect(form).toBeTruthy();
  });

  it("特徴は斑入りを先頭に持つ（#221）", () => {
    expect(trait.tags[0]).toBe("斑入り");
  });

  it("仕立ては水耕を先頭に持つ（#221）", () => {
    expect(form.tags[0]).toBe("水耕");
  });

  it("仕立ては水耕系（水耕→ハイドロカルチャー）を隣接させる（#311・水挿しを間に挟まない）", () => {
    const i水耕 = form.tags.indexOf("水耕");
    const iハイドロ = form.tags.indexOf("ハイドロカルチャー");
    expect(i水耕).toBeGreaterThanOrEqual(0);
    expect(iハイドロ).toBe(i水耕 + 1);
    // 水挿し（繁殖寄り）は水耕系2つの後ろ。
    expect(form.tags.indexOf("水挿し")).toBe(iハイドロ + 1);
  });

  it("分類語（多肉植物 等）は入れない（#166＝分類はタグにしない）", () => {
    const all = TAG_CATEGORIES.flatMap((c) => c.tags);
    expect(all).not.toContain("多肉植物");
    expect(all).not.toContain("塊根植物");
    expect(all).not.toContain("観葉植物");
  });

  it("投稿の種類（成長記録/質問/実験/失敗）を先頭の枠に持つ（#311・実験は失敗の隣＝kako-jun）", () => {
    expect(postType).toBeTruthy();
    expect(postType.tags).toEqual(["成長記録", "質問", "実験", "失敗"]);
    // 先頭の枠＝高位の descriptor（共有文化を促す・kako-jun 配置サインオフ対象）。
    expect(TAG_CATEGORIES[0]!.label).toBe("投稿の種類");
  });

  it("成長記録・実験は「世話・記録」でなく「投稿の種類」に置く（植物の出来事でなく投稿タイプ・kako-jun）", () => {
    expect(careRecord.tags).not.toContain("成長記録");
    expect(careRecord.tags).not.toContain("実験");
    expect(postType.tags).toContain("成長記録");
    expect(postType.tags).toContain("実験");
  });

  it("原則1（#311 改訂）: 症状の細目はタグにしない／投稿の種類（質問・失敗）は可（#251/#311）", () => {
    const all = TAG_CATEGORIES.flatMap((c) => c.tags);
    // 症状の細目はタグにしない（本文へ）。
    for (const symptom of ["徒長", "葉焼け", "殺虫", "うどんこ病", "根腐れ", "病気", "害虫"]) {
      expect(all).not.toContain(symptom);
    }
    // 投稿の種類タグ（質問・失敗）は可（#311・失敗は症状でなく投稿タイプ）。
    expect(all).toContain("質問");
    expect(all).toContain("失敗");
  });

  it("原則2: 現実の家・私生活を指すタグは入れない（ハノーバ架空設定・#251）", () => {
    const all = TAG_CATEGORIES.flatMap((c) => c.tags);
    expect(all).not.toContain("我が家の植物");
  });

  it("特徴は斑の細分を持たず「斑入り」一本＋綴化/石化だけ（#251）", () => {
    for (const sub of ["錦", "黄斑", "白斑", "中斑", "覆輪", "モンスト"]) {
      expect(trait.tags).not.toContain(sub);
    }
    expect(trait.tags).toEqual(["斑入り", "綴化", "石化"]);
  });

  it("世話・記録は植物の出来事（収穫・開花 等）を持ち、「開花待ち」は持たない（#251/#353）", () => {
    expect(careRecord.tags).toContain("収穫");
    expect(careRecord.tags).toContain("開花");
    expect(careRecord.tags).not.toContain("開花待ち");
  });
});
