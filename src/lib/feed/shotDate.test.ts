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
    expect(shotDateRange([], "ja")).toBeNull();
    expect(shotDateRange([null, null], "ja")).toBeNull();
    expect(shotDateRange(["bad", null], "ja")).toBeNull();
  });

  it("1 種類なら完全表記（#347 で YYYY-MM-DD 固定・全言語同じ）", () => {
    expect(shotDateRange(["2024-06-15"], "ja")).toBe("2024-06-15");
    expect(shotDateRange(["2024-06-15", "2024-06-15", null], "en")).toBe("2024-06-15");
  });

  it("複数なら最古〜最新を月/日で（順不同でも整列）", () => {
    expect(shotDateRange(["2024-06-22", "2024-06-01", "2024-06-08"], "ja")).toBe("6/1〜6/22");
  });

  it("null 混在でも妥当な日付だけでレンジを作る", () => {
    expect(shotDateRange([null, "2024-06-10", null, "2024-06-03"], "ja")).toBe("6/3〜6/10");
  });
});
