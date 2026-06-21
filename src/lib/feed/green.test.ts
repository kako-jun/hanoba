import { describe, expect, it } from "vitest";
import { GREEN_LEVELS, greenLevel, greenRatio, isGreenPixel } from "./green.ts";

/** rgba 配列を組む小ヘルパ（[r,g,b,a] の繰り返し）。 */
function rgba(...px: [number, number, number, number][]): number[] {
  return px.flat();
}

describe("isGreenPixel", () => {
  it("葉の緑（緑優勢）は緑", () => {
    expect(isGreenPixel(60, 110, 50)).toBe(true);
    expect(isGreenPixel(50, 200, 50)).toBe(true);
    expect(isGreenPixel(180, 200, 40)).toBe(true); // 黄緑も緑（新葉）
  });

  it("茶色（鉢・塊根＝赤優勢）は緑でない", () => {
    expect(isGreenPixel(139, 90, 43)).toBe(false);
    expect(isGreenPixel(180, 90, 60)).toBe(false); // テラコッタ鉢
  });

  it("灰/白/黒（無彩色）は緑でない", () => {
    expect(isGreenPixel(128, 128, 128)).toBe(false);
    expect(isGreenPixel(255, 255, 255)).toBe(false);
    expect(isGreenPixel(0, 0, 0)).toBe(false);
  });

  it("暗すぎる緑（夜の影・黒土）は数えない（g>40 の床）", () => {
    expect(isGreenPixel(15, 30, 15)).toBe(false);
    expect(isGreenPixel(20, 50, 25)).toBe(true); // 影の葉はギリ数える
  });
});

describe("greenRatio", () => {
  it("全画素が緑なら 1", () => {
    expect(greenRatio(rgba([50, 200, 50, 255], [60, 110, 50, 255]))).toBe(1);
  });

  it("全画素が茶色なら 0", () => {
    expect(greenRatio(rgba([139, 90, 43, 255], [180, 90, 60, 255]))).toBe(0);
  });

  it("半分が緑なら 0.5", () => {
    expect(greenRatio(rgba([50, 200, 50, 255], [139, 90, 43, 255]))).toBe(0.5);
  });

  it("透明画素は分母から除外する（緑1・茶1・透明1 → 0.5）", () => {
    expect(greenRatio(rgba([50, 200, 50, 255], [139, 90, 43, 255], [0, 255, 0, 0]))).toBe(0.5);
  });

  it("空配列・全透明は 0（落ちない）", () => {
    expect(greenRatio([])).toBe(0);
    expect(greenRatio(rgba([0, 255, 0, 0]))).toBe(0);
  });
});

describe("greenLevel", () => {
  it("0〜4 に量子化する（境界）", () => {
    expect(greenLevel(0)).toBe(0);
    expect(greenLevel(0.04)).toBe(0);
    expect(greenLevel(0.05)).toBe(1);
    expect(greenLevel(0.19)).toBe(1);
    expect(greenLevel(0.2)).toBe(2);
    expect(greenLevel(0.39)).toBe(2);
    expect(greenLevel(0.4)).toBe(3);
    expect(greenLevel(0.59)).toBe(3);
    expect(greenLevel(0.6)).toBe(4);
    expect(greenLevel(1)).toBe(4);
  });

  it("最大レベルは GREEN_LEVELS（4）に収まる", () => {
    expect(greenLevel(1)).toBe(GREEN_LEVELS);
  });
});
