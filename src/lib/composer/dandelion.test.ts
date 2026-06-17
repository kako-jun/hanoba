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

// 与えた配列を順に返し、末尾に達したら最後の値を返し続けるカウンタ式 fake rng。
// makeSeeds の消費順は「windBase（先頭1回）→ 各粒で dx ゆらぎ→dy→rot→durMs→delayMs→size の6回」。
// 先頭で風を強く決め、以降を 0.5 にすると dx ゆらぎは span(-40,40) の中央＝0 になり、
// 全粒の dx は windBase の符号だけで決まる（共通の風が全粒に効くことを露わにできる）。
function sequenceRng(values: number[]): () => number {
  let i = 0;
  return () => {
    const v = values[Math.min(i, values.length - 1)]!;
    i++;
    return v;
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

  it("バーストの風（windBase）が全粒の dx に効く：強い正の風なら全粒 dx>0", () => {
    // 先頭 0.99 → windBase = span(-60,60) ≈ +58.8（強い正の風）。
    // 以降 0.5 → 各粒の dx ゆらぎは span(-40,40) の中央＝0。
    // → 風が独立でなく全粒に共有されているなら、必ず全粒 dx>0 になる。
    const seeds = makeSeeds(30, sequenceRng([0.99, 0.5]));
    expect(seeds.every((s) => s.dx > 0)).toBe(true);
  });

  it("バーストの風（windBase）が全粒の dx に効く：強い負の風なら全粒 dx<0", () => {
    // 先頭 0.0 → windBase = span(-60,60) = -60（強い負の風）。以降 0.5 → ゆらぎ 0。
    const seeds = makeSeeds(30, sequenceRng([0.0, 0.5]));
    expect(seeds.every((s) => s.dx < 0)).toBe(true);
  });
});
