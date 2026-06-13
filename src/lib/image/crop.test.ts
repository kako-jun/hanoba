import { describe, expect, it } from "vitest";
import type { PixelCrop } from "react-image-crop";
import { computeSquareCropRect } from "./crop.ts";

function px(x: number, y: number, width: number, height: number): PixelCrop {
  return { unit: "px", x, y, width, height };
}

describe("computeSquareCropRect", () => {
  it("等倍（scale=1）の正方形 crop をそのまま正方形で返す", () => {
    const rect = computeSquareCropRect(px(10, 20, 100, 100), 1, 1, 500, 400);
    expect(rect).toEqual({ sx: 10, sy: 20, size: 100 });
  });

  it("返り値は常に正方形（幅=高さ=size を size で表現する）", () => {
    // 非正方形 crop でも min を採用して正方形化する。
    const rect = computeSquareCropRect(px(0, 0, 120, 80), 1, 1, 1000, 1000);
    expect(rect.size).toBe(80); // min(120, 80)
  });

  it("scaleX/scaleY を掛けて自然座標へ変換する", () => {
    // 表示 200x200 → 自然 800x800 なら scale=4。表示 50px は自然 200px。
    const rect = computeSquareCropRect(px(10, 10, 50, 50), 4, 4, 800, 800);
    expect(rect).toEqual({ sx: 40, sy: 40, size: 200 });
  });

  it("scaleX と scaleY が異なる場合も短辺で正方形化する", () => {
    // nw = 100*2 = 200, nh = 100*3 = 300 → size = min = 200
    const rect = computeSquareCropRect(px(0, 0, 100, 100), 2, 3, 1000, 1000);
    expect(rect.size).toBe(200);
  });

  it("右端がはみ出す場合に sx をクランプする（sx+size<=naturalW）", () => {
    // 自然座標 nx=450, size=100, naturalW=500 → sx は 400 に詰められる
    const rect = computeSquareCropRect(px(450, 0, 100, 100), 1, 1, 500, 500);
    expect(rect.sx + rect.size).toBeLessThanOrEqual(500);
    expect(rect.sx).toBe(400);
  });

  it("下端がはみ出す場合に sy をクランプする（sy+size<=naturalH）", () => {
    // 自然座標 ny=450, size=100, naturalH=500 → sy は 400 に詰められる
    const rect = computeSquareCropRect(px(0, 450, 100, 100), 1, 1, 500, 500);
    expect(rect.sy + rect.size).toBeLessThanOrEqual(500);
    expect(rect.sy).toBe(400);
  });

  it("負の x/y は 0 にクランプする", () => {
    const rect = computeSquareCropRect(px(-30, -50, 100, 100), 1, 1, 500, 500);
    expect(rect.sx).toBe(0);
    expect(rect.sy).toBe(0);
  });

  it("size が画像より大きくなりそうなら画像短辺に収める", () => {
    // crop が画像より大きい → size は min(naturalW, naturalH) に収まる
    const rect = computeSquareCropRect(px(0, 0, 9999, 9999), 1, 1, 300, 200);
    expect(rect.size).toBeLessThanOrEqual(200);
    expect(rect.sx + rect.size).toBeLessThanOrEqual(300);
    expect(rect.sy + rect.size).toBeLessThanOrEqual(200);
  });

  it("極小 crop でも size は 1 以上（size>=1）", () => {
    const rect = computeSquareCropRect(px(0, 0, 0, 0), 1, 1, 500, 500);
    expect(rect.size).toBeGreaterThanOrEqual(1);
  });

  it("どんな入力でも sx/sy/size は整数", () => {
    const rect = computeSquareCropRect(px(10.7, 20.3, 99.6, 100.4), 1.5, 1.5, 753, 661);
    expect(Number.isInteger(rect.sx)).toBe(true);
    expect(Number.isInteger(rect.sy)).toBe(true);
    expect(Number.isInteger(rect.size)).toBe(true);
  });

  it("プロパティベース: ランダム入力でも常に正方形かつ境界内に収まる", () => {
    for (let i = 0; i < 200; i++) {
      const naturalW = 1 + Math.floor(Math.random() * 2000);
      const naturalH = 1 + Math.floor(Math.random() * 2000);
      const crop = px(
        Math.random() * 2000 - 200,
        Math.random() * 2000 - 200,
        Math.random() * 2000,
        Math.random() * 2000,
      );
      const sx = 0.1 + Math.random() * 5;
      const sy = 0.1 + Math.random() * 5;
      const rect = computeSquareCropRect(crop, sx, sy, naturalW, naturalH);
      // 正方形（size という単一値で幅=高さを表現）
      expect(rect.size).toBeGreaterThanOrEqual(1);
      // 境界内
      expect(rect.sx).toBeGreaterThanOrEqual(0);
      expect(rect.sy).toBeGreaterThanOrEqual(0);
      expect(rect.sx + rect.size).toBeLessThanOrEqual(naturalW);
      expect(rect.sy + rect.size).toBeLessThanOrEqual(naturalH);
    }
  });
});
