import { describe, expect, it } from "vitest";
import { FILTER_PRESETS } from "./presets.ts";

describe("FILTER_PRESETS", () => {
  it("7 件ある", () => {
    expect(FILTER_PRESETS).toHaveLength(7);
  });

  it("各プリセットは name / filter / color を持つ", () => {
    for (const preset of FILTER_PRESETS) {
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
      expect(typeof preset.filter).toBe("string");
      expect(preset.filter.length).toBeGreaterThan(0);
      expect(typeof preset.color).toBe("string");
      expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it("name に重複が無い", () => {
    const names = FILTER_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("filter は CSS の filter 関数文字列（brightness/contrast 等）を含む", () => {
    for (const preset of FILTER_PRESETS) {
      expect(preset.filter).toMatch(/(brightness|contrast|saturate|grayscale|sepia|hue-rotate)\(/);
    }
  });
});
