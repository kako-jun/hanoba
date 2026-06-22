import { describe, expect, it } from "vitest";
import {
  cumulativeGreen,
  estimateCumulativeGreen,
  greenRatio,
  isGreenPixel,
  pickSampleIndices,
} from "./green.ts";

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

describe("cumulativeGreen（#344・全写真の緑を累計）", () => {
  it("読めた写真の緑割合の総和＝緑100%換算の枚数、読めた枚数も返す", () => {
    const r = cumulativeGreen([1, 0.5, 0.25]);
    expect(r.equivalent).toBeCloseTo(1.75);
    expect(r.readable).toBe(3);
  });

  it("読めない写真（null）は累計にも枚数にも数えない（分母を歪めない）", () => {
    const r = cumulativeGreen([1, null, 0.5, null]);
    expect(r.equivalent).toBeCloseTo(1.5);
    expect(r.readable).toBe(2);
  });

  it("全部 null は equivalent 0・readable 0", () => {
    expect(cumulativeGreen([null, null])).toEqual({ equivalent: 0, readable: 0 });
  });

  it("空は equivalent 0・readable 0", () => {
    expect(cumulativeGreen([])).toEqual({ equivalent: 0, readable: 0 });
  });
});

describe("pickSampleIndices（#387・上限 cap の均等抽出）", () => {
  it("total <= cap は全件（抽出しない）", () => {
    expect(pickSampleIndices(0, 5)).toEqual([]);
    expect(pickSampleIndices(3, 5)).toEqual([0, 1, 2]);
    expect(pickSampleIndices(5, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("total > cap は cap 件を均等抽出（floor(i*total/cap)）", () => {
    expect(pickSampleIndices(10, 5)).toEqual([0, 2, 4, 6, 8]);
    expect(pickSampleIndices(1000, 4)).toEqual([0, 250, 500, 750]);
  });

  it("超過時は cap 件・全インデックスが範囲内・昇順・重複なし（1000→120）", () => {
    const idx = pickSampleIndices(1000, 120);
    expect(idx.length).toBe(120);
    expect(idx.every((i) => i >= 0 && i < 1000)).toBe(true);
    for (let i = 1; i < idx.length; i++) expect(idx[i]!).toBeGreaterThan(idx[i - 1]!); // 昇順＝重複なし
    expect(new Set(idx).size).toBe(120);
  });

  it("端: cap=0 / cap<0 / total<=0 は空", () => {
    expect(pickSampleIndices(10, 0)).toEqual([]);
    expect(pickSampleIndices(10, -1)).toEqual([]);
    expect(pickSampleIndices(0, 0)).toEqual([]);
    expect(pickSampleIndices(-5, 3)).toEqual([]);
  });

  it("cap=1 は先頭1件", () => {
    expect(pickSampleIndices(10, 1)).toEqual([0]);
    expect(pickSampleIndices(1, 1)).toEqual([0]);
  });
});

describe("estimateCumulativeGreen（#387・サンプル→全数の外挿概算）", () => {
  it("全件読んだ（sampledCount >= totalCount）は cumulativeGreen と一致・sampled:false", () => {
    const sampled = [1, 0.5, 0.25, null];
    const base = cumulativeGreen(sampled);
    const est = estimateCumulativeGreen(sampled, sampled.length);
    expect(est.equivalent).toBeCloseTo(base.equivalent);
    expect(est.readable).toBe(base.readable);
    expect(est.sampled).toBe(false);
  });

  it("抽出した（sampledCount < totalCount）はサンプル和を全数へ外挿・sampled:true", () => {
    // sampled=[0.5,0.5,null] / total=300 → scale=100、sum=1.0→100、read=2→200。
    const est = estimateCumulativeGreen([0.5, 0.5, null], 300);
    expect(est.equivalent).toBeCloseTo(100);
    expect(est.readable).toBe(200);
    expect(est.sampled).toBe(true);
  });

  it("readable の外挿は四捨五入する", () => {
    // sampled 3 件中 read=1 / total=10 → scale=10/3、read 1*scale=3.33→round=3。
    const est = estimateCumulativeGreen([0.4, null, null], 10);
    expect(est.readable).toBe(3);
    expect(est.equivalent).toBeCloseTo(0.4 * (10 / 3));
    expect(est.sampled).toBe(true);
  });

  it("空サンプルは equivalent 0・readable 0・sampled:false", () => {
    expect(estimateCumulativeGreen([], 0)).toEqual({ equivalent: 0, readable: 0, sampled: false });
    expect(estimateCumulativeGreen([], 100)).toEqual({ equivalent: 0, readable: 0, sampled: false });
  });

  it("全部 null（読めず）でも外挿は read=0 のまま（0 を全数に広げても 0）", () => {
    const est = estimateCumulativeGreen([null, null], 50);
    expect(est.equivalent).toBe(0);
    expect(est.readable).toBe(0);
    expect(est.sampled).toBe(true);
  });
});
