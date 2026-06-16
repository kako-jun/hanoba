import { describe, expect, it } from "vitest";
import { FILTER_PRESETS, composeFilterCss, composeSharpen, composeVignette } from "./presets.ts";

describe("FILTER_PRESETS", () => {
  it("畑で迷わない数に絞っている", () => {
    expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(FILTER_PRESETS.length).toBeLessThanOrEqual(7);
  });

  it("各プリセットは name / filter / color を持つ", () => {
    for (const preset of FILTER_PRESETS) {
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
      expect(typeof preset.filter).toBe("string");
      expect(preset.filter.length).toBeGreaterThan(0);
      expect(typeof preset.color).toBe("string");
      expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      if (preset.vignette !== undefined) {
        expect(preset.vignette).toBeGreaterThan(0);
        expect(preset.vignette).toBeLessThanOrEqual(1);
      }
      if (preset.sharpen !== undefined) {
        expect(preset.sharpen).toBeGreaterThan(0);
        expect(preset.sharpen).toBeLessThanOrEqual(1);
      }
    }
  });

  it("name に重複が無い", () => {
    const names = FILTER_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("filter は CSS の filter 関数文字列（brightness/contrast 等）を含む", () => {
    for (const preset of FILTER_PRESETS) {
      if (preset.name === "線明") {
        expect(preset.filter).toBe("none");
      } else {
        expect(preset.filter).toMatch(/(brightness|contrast|saturate|sepia|hue-rotate)\(/);
      }
      expect(preset.filter).not.toMatch(/grayscale\(/);
    }
  });

  it("彩度を変えるのは美華だけ", () => {
    for (const preset of FILTER_PRESETS) {
      expect(preset.filter.includes("saturate(")).toBe(preset.name === "美華");
    }
  });

  it("周辺を暗く落とすプリセットがある", () => {
    expect(FILTER_PRESETS.some((preset) => (preset.vignette ?? 0) > 0.5)).toBe(true);
  });

  it("シャープにするプリセットがある", () => {
    expect(FILTER_PRESETS.some((preset) => (preset.sharpen ?? 0) > 0.5)).toBe(true);
  });

  it("複数プリセットを重ねがけ用に合成する", () => {
    const suiro = FILTER_PRESETS.find((preset) => preset.name === "翠露")!;
    const kagegure = FILTER_PRESETS.find((preset) => preset.name === "影暮")!;
    const senmei = FILTER_PRESETS.find((preset) => preset.name === "線明")!;
    const presets = [suiro, kagegure, senmei];
    expect(composeFilterCss(presets)).toContain(`${suiro.filter} ${kagegure.filter}`);
    expect(composeVignette(presets)).toBe(kagegure.vignette);
    expect(composeSharpen(presets)).toBe(senmei.sharpen);
  });

  it("翠露と土香は同時選択でトーンを完全に相殺する", () => {
    const suiro = FILTER_PRESETS.find((preset) => preset.name === "翠露")!;
    const dokou = FILTER_PRESETS.find((preset) => preset.name === "土香")!;
    expect(composeFilterCss([suiro, dokou])).toBeNull();
    expect(composeFilterCss([suiro, dokou, FILTER_PRESETS.find((preset) => preset.name === "美華")!])).toBe(
      "saturate(1.28)",
    );
  });

  it("線明はシャープのみでCSSフィルタを足さない", () => {
    const senmei = FILTER_PRESETS.find((preset) => preset.name === "線明")!;
    expect(composeFilterCss([senmei])).toBeNull();
    expect(composeSharpen([senmei])).toBe(senmei.sharpen);
  });
});
