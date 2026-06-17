import { describe, expect, it } from "vitest";
import { makeSeeds } from "./dandelion.ts";

// 決定的な擬似乱数（線形合同法）。種を変えれば別の数列を返す。
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe("makeSeeds", () => {
  it("count ぶんの種を返す", () => {
    expect(makeSeeds(5, seededRng(1))).toHaveLength(5);
    expect(makeSeeds(1, seededRng(1))).toHaveLength(1);
  });

  it("count<=0 は空配列", () => {
    expect(makeSeeds(0)).toEqual([]);
    expect(makeSeeds(-3)).toEqual([]);
  });

  it("各種の値は仕様の範囲に収まり、dy は常に負（上昇）", () => {
    const seeds = makeSeeds(40, seededRng(42));
    for (const s of seeds) {
      // 風 [-60,60] ＋ ゆらぎ [-40,40] ⇒ dx は [-100,100]。
      expect(s.dx).toBeGreaterThanOrEqual(-100);
      expect(s.dx).toBeLessThanOrEqual(100);
      // 必ず上へ飛ぶ。
      expect(s.dy).toBeLessThan(0);
      expect(s.dy).toBeGreaterThanOrEqual(-260);
      expect(s.dy).toBeLessThanOrEqual(-120);
      expect(s.rot).toBeGreaterThanOrEqual(-120);
      expect(s.rot).toBeLessThanOrEqual(120);
      expect(s.durMs).toBeGreaterThanOrEqual(900);
      expect(s.durMs).toBeLessThanOrEqual(1600);
      expect(s.delayMs).toBeGreaterThanOrEqual(0);
      expect(s.delayMs).toBeLessThanOrEqual(180);
      expect(s.size).toBeGreaterThanOrEqual(6);
      expect(s.size).toBeLessThanOrEqual(12);
    }
  });

  it("rng 数列が違えば結果も違う（毎回違う風）", () => {
    const a = makeSeeds(8, seededRng(1));
    const b = makeSeeds(8, seededRng(2));
    expect(a).not.toEqual(b);
  });

  it("同じ rng 数列なら決定的（再現できる）", () => {
    expect(makeSeeds(6, seededRng(7))).toEqual(makeSeeds(6, seededRng(7)));
  });

  it("1 バーストの粒は共通の風を中心に散る（dx が一点に集まらない・横幅を持つ）", () => {
    const seeds = makeSeeds(30, seededRng(123));
    const xs = seeds.map((s) => s.dx);
    expect(Math.max(...xs)).toBeGreaterThan(Math.min(...xs));
  });
});
