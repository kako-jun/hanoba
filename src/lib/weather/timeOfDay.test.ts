import { describe, expect, it } from "vitest";
import { jstHour, timeOfDay } from "./timeOfDay.ts";

// 時間帯大別の正本テスト（#231 後段②）。境界を固定する。

describe("timeOfDay（JST hour → 時間帯）", () => {
  it("夜＝19:00 以降と 5:00 未満", () => {
    expect(timeOfDay(19)).toBe("night");
    expect(timeOfDay(23)).toBe("night");
    expect(timeOfDay(0)).toBe("night");
    expect(timeOfDay(4)).toBe("night");
  });

  it("朝＝5-9", () => {
    expect(timeOfDay(5)).toBe("morning");
    expect(timeOfDay(8)).toBe("morning");
  });

  it("昼＝9-16", () => {
    expect(timeOfDay(9)).toBe("day");
    expect(timeOfDay(15)).toBe("day");
  });

  it("夕＝16-19", () => {
    expect(timeOfDay(16)).toBe("evening");
    expect(timeOfDay(18)).toBe("evening");
  });
});

describe("jstHour（Date → JST の時）", () => {
  it("UTC を Asia/Tokyo(+9) に換算する", () => {
    // 2026-06-20T00:00:00Z = JST 09:00
    expect(jstHour(new Date("2026-06-20T00:00:00Z"))).toBe(9);
    // 2026-06-20T10:30:00Z = JST 19:30 → 19
    expect(jstHour(new Date("2026-06-20T10:30:00Z"))).toBe(19);
    // 2026-06-20T15:00:00Z = JST 翌 00:00 → 0
    expect(jstHour(new Date("2026-06-20T15:00:00Z"))).toBe(0);
  });

  it("環境 TZ に依らず JST で返す（時間帯と合成して使える）", () => {
    const d = new Date("2026-12-31T20:00:00Z"); // JST 翌 05:00
    expect(jstHour(d)).toBe(5);
    expect(timeOfDay(jstHour(d))).toBe("morning");
  });
});
