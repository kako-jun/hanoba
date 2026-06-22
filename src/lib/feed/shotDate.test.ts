import { describe, expect, it } from "vitest";
import { formatShotDate, shotDateRange } from "./shotDate.ts";

describe("formatShotDate", () => {
  it("全言語で保存形式と同じ YYYY-MM-DD 固定（#347・locale で変えない）", () => {
    expect(formatShotDate("2024-06-15")).toBe("2024-06-15");
    expect(formatShotDate("2026-05-21")).toBe("2026-05-21");
  });

  it("ゼロ詰めを保つ（月初・1桁月日）", () => {
    expect(formatShotDate("2024-01-01")).toBe("2024-01-01");
    expect(formatShotDate("2024-09-03")).toBe("2024-09-03");
  });

  it("不正な日付はそのまま返す", () => {
    expect(formatShotDate("bad")).toBe("bad");
    expect(formatShotDate("2024-13-40")).toBe("2024-13-40");
  });
});

describe("shotDateRange", () => {
  it("妥当な日付が無ければ null", () => {
    expect(shotDateRange([])).toBeNull();
    expect(shotDateRange([null, null])).toBeNull();
    expect(shotDateRange(["bad", null])).toBeNull();
  });

  it("1 種類なら完全表記（#347 で YYYY-MM-DD 固定・全言語同じ）", () => {
    expect(shotDateRange(["2024-06-15"])).toBe("2024-06-15");
    expect(shotDateRange(["2024-06-15", "2024-06-15", null])).toBe("2024-06-15");
  });

  it("複数なら最古〜最新を両端フル ISO で（年も入れる・スラッシュ不可・#347）", () => {
    expect(shotDateRange(["2024-06-22", "2024-06-01", "2024-06-08"])).toBe("2024-06-01～2024-06-22");
  });

  it("年跨ぎも年込みで曖昧にしない（#347・年も入れる）", () => {
    expect(shotDateRange(["2025-01-03", "2024-12-28"])).toBe("2024-12-28～2025-01-03");
  });

  it("null 混在でも妥当な日付だけでレンジを作る", () => {
    expect(shotDateRange([null, "2024-06-10", null, "2024-06-03"])).toBe("2024-06-03～2024-06-10");
  });
});
