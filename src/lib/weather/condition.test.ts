import { describe, expect, it } from "vitest";
import { wmoToCondition } from "./condition.ts";

// WMO weather_code → 大別状態の正本テスト（#231）。
// 代表コードと帯の端を固定し、後段で状態を増やしても既存の大別が崩れないようにする。

describe("wmoToCondition（WMO code → 状態）", () => {
  it("0/1 は快晴系 = clear", () => {
    expect(wmoToCondition(0)).toBe("clear");
    expect(wmoToCondition(1)).toBe("clear");
  });

  it("2/3 は曇り = cloudy", () => {
    expect(wmoToCondition(2)).toBe("cloudy");
    expect(wmoToCondition(3)).toBe("cloudy");
  });

  it("45/48 は霧 = fog", () => {
    expect(wmoToCondition(45)).toBe("fog");
    expect(wmoToCondition(48)).toBe("fog");
  });

  it("霧雨・雨・着氷性の雨・にわか雨は rain（帯の端も）", () => {
    for (const code of [51, 55, 57, 61, 63, 65, 66, 67, 80, 81, 82]) {
      expect(wmoToCondition(code), `code=${code}`).toBe("rain");
    }
  });

  it("降雪・霧雪・にわか雪は snow", () => {
    for (const code of [71, 73, 75, 77, 85, 86]) {
      expect(wmoToCondition(code), `code=${code}`).toBe("snow");
    }
  });

  it("95/96/99 は雷雨 = thunder（降水より雷を優先）", () => {
    for (const code of [95, 96, 99]) {
      expect(wmoToCondition(code), `code=${code}`).toBe("thunder");
    }
  });

  it("未知コードは安全側で cloudy", () => {
    expect(wmoToCondition(4)).toBe("cloudy");
    expect(wmoToCondition(123)).toBe("cloudy");
  });
});
