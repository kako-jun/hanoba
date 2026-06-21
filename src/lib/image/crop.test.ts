import { describe, expect, it } from "vitest";
import type { PixelCrop } from "react-image-crop";
import {
  MAX_OUTPUT_EDGE,
  buildToneLut,
  clampCropToVisible,
  computeSquareCropRect,
  outputEdge,
  rotationFine,
} from "./crop.ts";

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

describe("rotationFine（#314・微調整成分＝最寄り90度からのズレ）", () => {
  it("90度系ちょうどは 0", () => {
    expect(rotationFine(0)).toBe(0);
    expect(rotationFine(90)).toBe(0);
    expect(rotationFine(-90)).toBe(0);
    expect(rotationFine(180)).toBe(0);
  });
  it("90度＋微調整の微調整分を返す", () => {
    expect(rotationFine(10)).toBeCloseTo(10);
    expect(rotationFine(100)).toBeCloseTo(10); // 90 + 10
    expect(rotationFine(-95)).toBeCloseTo(-5); // -90 + -5
    expect(rotationFine(90.5)).toBeCloseTo(0.5);
  });
});

describe("outputEdge", () => {
  it("MAX_OUTPUT_EDGE は 1440（長辺上限）", () => {
    expect(MAX_OUTPUT_EDGE).toBe(1440);
  });

  it("上限未満はそのまま（1439→1439）", () => {
    expect(outputEdge(1439)).toBe(1439);
  });

  it("上限ちょうどはそのまま（1440→1440）", () => {
    expect(outputEdge(1440)).toBe(1440);
  });

  it("上限超過は 1440 にクランプ（1441→1440）", () => {
    expect(outputEdge(1441)).toBe(1440);
  });

  it("巨大なクロップ実寸も 1440 に収まる（3000→1440）", () => {
    expect(outputEdge(3000)).toBe(MAX_OUTPUT_EDGE);
  });

  it("小さい画像は拡大しない（800→800）", () => {
    expect(outputEdge(800)).toBe(800);
  });

  it("カスタム max を尊重する（1000, max=512 → 512 / 400, max=512 → 400）", () => {
    expect(outputEdge(1000, 512)).toBe(512);
    expect(outputEdge(400, 512)).toBe(400);
  });
});

describe("buildToneLut", () => {
  it("null は恒等 LUT（各段がそのまま）", () => {
    const lut = buildToneLut(null);
    expect(lut).toHaveLength(256);
    expect(lut[0]).toBe(0);
    expect(lut[128]).toBe(128);
    expect(lut[255]).toBe(255);
  });

  it("両端は S字・逆S字とも固定（白飛び/黒つぶれを作らない）", () => {
    for (const tone of ["s", "reverse-s"] as const) {
      const lut = buildToneLut(tone);
      expect(lut[0]).toBe(0);
      expect(lut[255]).toBe(255);
    }
  });

  it("中点はトーンに依らず保たれる（明るさを動かさない）", () => {
    // x=127〜128 が中点。±1 段の丸め内で 128 付近に留まる。
    for (const tone of ["s", "reverse-s", null] as const) {
      const lut = buildToneLut(tone);
      expect(Math.abs((lut[128] ?? 0) - 128)).toBeLessThanOrEqual(1);
    }
  });

  it("S字は暗部を落とし明部を上げる（コントラストを締める）", () => {
    const lut = buildToneLut("s");
    expect(lut[64]!).toBeLessThan(64); // 暗部はより暗く
    expect(lut[192]!).toBeGreaterThan(192); // 明部はより明るく
  });

  it("逆S字は暗部を上げ明部を抑える（コントラストをやわらげる）", () => {
    const lut = buildToneLut("reverse-s");
    expect(lut[64]!).toBeGreaterThan(64); // 暗部を持ち上げ
    expect(lut[192]!).toBeLessThan(192); // 明部を寝かせる
  });

  it("amount=0 はトーンに依らず恒等（カーブを混ぜない）", () => {
    expect(Array.from(buildToneLut("s", 0))).toEqual(Array.from(buildToneLut(null)));
    expect(Array.from(buildToneLut("reverse-s", 0))).toEqual(Array.from(buildToneLut(null)));
  });

  it("S字は amount を上げるほど効きが強まる（弱<中<強で締まりが増す・#171）", () => {
    // 暗部(64)はより暗く、明部(192)はより明るくなる方向。amount が大きいほど中点から離れる。
    const weak = buildToneLut("s", 0.2);
    const mid = buildToneLut("s", 0.32);
    const strong = buildToneLut("s", 0.45);
    expect(weak[64]!).toBeGreaterThan(mid[64]!); // 弱は暗部の落ちが浅い
    expect(mid[64]!).toBeGreaterThan(strong[64]!); // 強は暗部がより落ちる
    expect(weak[192]!).toBeLessThan(mid[192]!); // 明部は逆に持ち上がり幅が広がる
    expect(mid[192]!).toBeLessThan(strong[192]!);
  });

  it("逆S字も amount を上げるほどやわらぎが強まる（弱<中<強・#171）", () => {
    const weak = buildToneLut("reverse-s", 0.2);
    const strong = buildToneLut("reverse-s", 0.45);
    expect(strong[64]!).toBeGreaterThan(weak[64]!); // 暗部の持ち上げが強い
    expect(strong[192]!).toBeLessThan(weak[192]!); // 明部の抑えが強い
  });

  it("単調増加（順序を反転しない）", () => {
    for (const tone of ["s", "reverse-s"] as const) {
      const lut = buildToneLut(tone);
      for (let i = 1; i < 256; i++) {
        expect(lut[i]!).toBeGreaterThanOrEqual(lut[i - 1]!);
      }
    }
  });
});

describe("clampCropToVisible（#348・回転後の見えている写真領域にクロップを収める）", () => {
  // 横長 box（W=400, H=300）。
  const W = 400, H = 300;

  it("0度は box 全体が見えている＝素通し（退行させない）", () => {
    const c = { x: 5, y: 10, width: 50, height: 50 };
    expect(clampCropToVisible(c, 0, W, H)).toEqual(c);
  });

  it("180度も素通し（quarter 偶数）", () => {
    const c = { x: 0, y: 0, width: 80, height: 80 };
    expect(clampCropToVisible(c, 180, W, H)).toEqual(c);
  });

  it("微調整回転（5度）は quarter 0 扱いで素通し（退行させない）", () => {
    const c = { x: 12, y: 8, width: 40, height: 40 };
    expect(clampCropToVisible(c, 5, W, H)).toEqual(c);
  });

  it("90度・横長: 中心の S=min(W,H)=300 正方形に収める（左の空き帯へ出られない）", () => {
    // 領域は px で x∈[50,350], y∈[0,300]。左端へドラッグした 200px 角の枠を clamp。
    // crop %: x=0(=0px), width=50%(=200px), height=66.67%(=200px)。
    const clamped = clampCropToVisible({ x: 0, y: 0, width: 50, height: 66.6667 }, 90, W, H);
    // x は左帯(50px)で止まる＝12.5%。サイズは 200px のまま（領域 300px 内）。
    expect(clamped.x).toBeCloseTo(12.5, 3); // 50/400*100
    expect((clamped.width / 100) * W).toBeCloseTo(200, 1);
    expect((clamped.height / 100) * H).toBeCloseTo(200, 1);
    // 右端がはみ出さない（x_px+side <= 350）。
    expect((clamped.x / 100) * W + (clamped.width / 100) * W).toBeLessThanOrEqual(350 + 0.01);
  });

  it("270度も同じ中心正方形に収める", () => {
    const clamped = clampCropToVisible({ x: 90, y: 0, width: 50, height: 66.6667 }, 270, W, H);
    // 右へ振っても右帯(x_px+side<=350)で止まる。
    expect((clamped.x / 100) * W + (clamped.width / 100) * W).toBeLessThanOrEqual(350 + 0.01);
    expect((clamped.x / 100) * W).toBeGreaterThanOrEqual(50 - 0.01);
  });

  it("90度・縦長 box（W=300,H=400）は中心 300x300・上下の帯へ出られない", () => {
    const clamped = clampCropToVisible({ x: 0, y: 90, width: 100, height: 75 }, 90, 300, 400);
    // 領域 y∈[50,350]（px）。下へ振っても y_px+side<=350。
    const yPx = (clamped.y / 100) * 400;
    const sidePx = (clamped.height / 100) * 400;
    expect(yPx).toBeGreaterThanOrEqual(50 - 0.01);
    expect(yPx + sidePx).toBeLessThanOrEqual(350 + 0.01);
  });

  it("box 未測定（0）は素通し（落ちない）", () => {
    const c = { x: 1, y: 2, width: 3, height: 4 };
    expect(clampCropToVisible(c, 90, 0, 0)).toEqual(c);
  });
});
