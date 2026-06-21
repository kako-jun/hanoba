import { describe, expect, it } from "vitest";
import { formatShotDate, shotDateRange } from "./shotDate.ts";

describe("formatShotDate", () => {
  it("ja は『2024年6月15日』", () => {
    expect(formatShotDate("2024-06-15", "ja")).toBe("2024年6月15日");
  });

  it("en は『June 15, 2024』", () => {
    expect(formatShotDate("2024-06-15", "en")).toBe("June 15, 2024");
  });

  it("UTC 整形で前後日にズレない（月初）", () => {
    expect(formatShotDate("2024-01-01", "ja")).toBe("2024年1月1日");
  });

  it("不正な日付はそのまま返す", () => {
    expect(formatShotDate("bad", "ja")).toBe("bad");
    expect(formatShotDate("2024-13-40", "ja")).toBe("2024-13-40");
  });
});

describe("shotDateRange", () => {
  it("妥当な日付が無ければ null", () => {
    expect(shotDateRange([], "ja")).toBeNull();
    expect(shotDateRange([null, null], "ja")).toBeNull();
    expect(shotDateRange(["bad", null], "ja")).toBeNull();
  });

  it("1 種類なら完全表記", () => {
    expect(shotDateRange(["2024-06-15"], "ja")).toBe("2024年6月15日");
    expect(shotDateRange(["2024-06-15", "2024-06-15", null], "ja")).toBe("2024年6月15日");
  });

  it("複数なら最古〜最新を月/日で（順不同でも整列）", () => {
    expect(shotDateRange(["2024-06-22", "2024-06-01", "2024-06-08"], "ja")).toBe("6/1〜6/22");
  });

  it("null 混在でも妥当な日付だけでレンジを作る", () => {
    expect(shotDateRange([null, "2024-06-10", null, "2024-06-03"], "ja")).toBe("6/3〜6/10");
  });
});
