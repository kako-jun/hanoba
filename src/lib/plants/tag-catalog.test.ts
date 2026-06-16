import { describe, expect, it } from "vitest";
import { TAG_CATEGORIES } from "./tag-catalog.ts";

const care = TAG_CATEGORIES.find((c) => c.label === "世話")!;
const record = TAG_CATEGORIES.find((c) => c.label === "記録")!;

describe("tag-catalog", () => {
  it("世話・記録の2行を持つ", () => {
    expect(care).toBeTruthy();
    expect(record).toBeTruthy();
  });

  it("propagation（発芽→発根→実生）は世話の中で隣接している（index が連続・#169）", () => {
    const i芽 = care.tags.indexOf("発芽");
    const i根 = care.tags.indexOf("発根");
    const i実 = care.tags.indexOf("実生");
    expect(i芽).toBeGreaterThanOrEqual(0);
    expect(i根).toBe(i芽 + 1);
    expect(i実).toBe(i根 + 1);
  });

  it("記録には発芽を置かない（世話へ移し二重カウントしない・#169）", () => {
    expect(record.tags).not.toContain("発芽");
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

  it("分類語（多肉植物 等）は入れない（#166＝分類はタグにしない）", () => {
    const all = TAG_CATEGORIES.flatMap((c) => c.tags);
    expect(all).not.toContain("多肉植物");
    expect(all).not.toContain("塊根植物");
    expect(all).not.toContain("観葉植物");
  });
});
