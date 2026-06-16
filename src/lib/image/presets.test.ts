import { describe, expect, it } from "vitest";
import { FILTER_PRESETS, composeFilterCss, composeSharpen, composeVignette } from "./presets.ts";

describe("FILTER_PRESETS", () => {
  it("畑で迷わない数に絞っている", () => {
    expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(FILTER_PRESETS.length).toBeLessThanOrEqual(5);
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
      expect(preset.filter).toMatch(/(brightness|contrast|saturate|sepia|hue-rotate)\(/);
      expect(preset.filter).not.toMatch(/grayscale\(/);
    }
  });

  it("周辺を暗く落とすプリセットがある", () => {
    expect(FILTER_PRESETS.some((preset) => (preset.vignette ?? 0) > 0.5)).toBe(true);
  });

  it("シャープにするプリセットがある", () => {
    expect(FILTER_PRESETS.some((preset) => (preset.sharpen ?? 0) > 0.5)).toBe(true);
  });

  it("複数プリセットを重ねがけ用に合成する", () => {
    const presets = [FILTER_PRESETS[0]!, FILTER_PRESETS[3]!, FILTER_PRESETS[4]!];
    expect(composeFilterCss(presets)).toContain(`${FILTER_PRESETS[0]!.filter} ${FILTER_PRESETS[3]!.filter}`);
    expect(composeVignette(presets)).toBe(FILTER_PRESETS[3]!.vignette);
    expect(composeSharpen(presets)).toBe(FILTER_PRESETS[4]!.sharpen);
  });
});
