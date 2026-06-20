import { describe, expect, it } from "vitest";
import { rainLevel } from "./rainLevel.ts";

// 雨の強度大別の正本テスト（#231）。素材の出し分けが code/precipitation で決まることを固定する。

describe("rainLevel", () => {
  it("大雨・暴風雨・雷雨の code は heavy", () => {
    for (const code of [65, 67, 82, 95, 96, 99]) {
      expect(rainLevel(code), `code=${code}`).toBe("heavy");
    }
  });

  it("霧雨の code は light", () => {
    for (const code of [51, 53, 55, 56, 57]) {
      expect(rainLevel(code), `code=${code}`).toBe("light");
    }
  });

  it("並の雨（slight/moderate/showers）は normal", () => {
    for (const code of [61, 63, 66, 80, 81]) {
      expect(rainLevel(code), `code=${code}`).toBe("normal");
    }
  });

  it("precipitation が大きければ code に依らず heavy に寄せる", () => {
    expect(rainLevel(61, 5)).toBe("heavy"); // 並の code でも 5mm は大雨扱い
    expect(rainLevel(61, 3.9)).toBe("normal"); // しきい値未満は据え置き
  });

  it("precipitation 欠損(null)は code だけで判定", () => {
    expect(rainLevel(61, null)).toBe("normal");
    expect(rainLevel(65, null)).toBe("heavy");
  });
});
