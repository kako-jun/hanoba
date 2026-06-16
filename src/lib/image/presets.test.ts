import { describe, expect, it } from "vitest";
import type { FilterStrength, SelectedFilter } from "../nostr/types.ts";
import {
  FILTER_PRESETS,
  composeEdgeBlur,
  composeFilterCss,
  composeSharpen,
  composeToneAmount,
  composeToneCurve,
  composeVignette,
  resolveLevel,
  toneCurvePreviewCss,
} from "./presets.ts";

/** name の指定強度を SelectedFilter にする小ヘルパ。 */
function sel(name: string, strength: FilterStrength = 2): SelectedFilter {
  return { name, strength };
}

describe("FILTER_PRESETS", () => {
  it("畑で迷わない数に絞っている", () => {
    expect(FILTER_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(FILTER_PRESETS.length).toBeLessThanOrEqual(7);
  });

  it("各プリセットは name / color / levels(3要素) を持つ", () => {
    for (const preset of FILTER_PRESETS) {
      expect(typeof preset.name).toBe("string");
      expect(preset.name.length).toBeGreaterThan(0);
      expect(typeof preset.color).toBe("string");
      expect(preset.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(preset.levels).toHaveLength(3);
    }
  });

  it("各 level の vignette / sharpen / edgeBlur は 0..1、toneCurve は s/reverse-s", () => {
    for (const preset of FILTER_PRESETS) {
      for (const level of preset.levels) {
        for (const key of ["vignette", "sharpen", "edgeBlur"] as const) {
          if (level[key] !== undefined) {
            expect(level[key]).toBeGreaterThan(0);
            expect(level[key]).toBeLessThanOrEqual(1);
          }
        }
        if (level.toneCurve !== undefined) {
          expect(["s", "reverse-s"]).toContain(level.toneCurve);
        }
        if (level.toneAmount !== undefined) {
          expect(level.toneAmount).toBeGreaterThan(0);
          expect(level.toneAmount).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("name に重複が無い", () => {
    const names = FILTER_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("各 level の弱<中<強で効きが単調に上がる（数値を持つ効果）", () => {
    for (const preset of FILTER_PRESETS) {
      const [weak, mid, strong] = preset.levels;
      for (const key of ["vignette", "sharpen", "edgeBlur", "toneAmount"] as const) {
        if (mid[key] !== undefined) {
          expect(weak[key] ?? 0).toBeLessThan(mid[key]!);
          expect(strong[key] ?? 0).toBeGreaterThan(mid[key]!);
        }
      }
    }
  });

  it("彩度を変えるのは美華だけ（各 level の filter で saturate を含むのは美華のみ）", () => {
    for (const preset of FILTER_PRESETS) {
      const usesSaturate = preset.levels.some((level) => (level.filter ?? "").includes("saturate("));
      expect(usesSaturate).toBe(preset.name === "美華");
    }
  });

  it("どの level も grayscale を使わない", () => {
    for (const preset of FILTER_PRESETS) {
      for (const level of preset.levels) {
        expect(level.filter ?? "none").not.toMatch(/grayscale\(/);
      }
    }
  });

  it("線明の各 level sharpen は現0.82未満（効きを下げた・#171）", () => {
    const senmei = FILTER_PRESETS.find((p) => p.name === "線明")!;
    for (const level of senmei.levels) {
      expect(level.sharpen).toBeDefined();
      expect(level.sharpen!).toBeLessThan(0.82);
    }
    // 中(levels[1])も旧来の 0.82 より控えめ。
    expect(senmei.levels[1].sharpen!).toBeLessThan(0.82);
  });

  it("翠露=S字・土香=逆S字のトーンカーブを各 level で持つ", () => {
    const suiro = FILTER_PRESETS.find((p) => p.name === "翠露")!;
    const dokou = FILTER_PRESETS.find((p) => p.name === "土香")!;
    for (const level of suiro.levels) expect(level.toneCurve).toBe("s");
    for (const level of dokou.levels) expect(level.toneCurve).toBe("reverse-s");
  });
});

describe("resolveLevel", () => {
  it("name と strength から該当 level を引く（1=弱 / 2=中 / 3=強）", () => {
    const bika = FILTER_PRESETS.find((p) => p.name === "美華")!;
    expect(resolveLevel(sel("美華", 1))).toBe(bika.levels[0]);
    expect(resolveLevel(sel("美華", 2))).toBe(bika.levels[1]);
    expect(resolveLevel(sel("美華", 3))).toBe(bika.levels[2]);
  });

  it("未知の name は null", () => {
    expect(resolveLevel(sel("存在しない", 2))).toBeNull();
  });
});

describe("composeFilterCss", () => {
  it("なし（空）は null", () => {
    expect(composeFilterCss([])).toBeNull();
  });

  it("美華中は saturate(1.28)", () => {
    expect(composeFilterCss([sel("美華", 2)])).toBe("saturate(1.28)");
  });

  it("淡陽は強度で値が変わる（弱1.04 / 中1.08 / 強1.13）", () => {
    expect(composeFilterCss([sel("淡陽", 1)])).toBe("brightness(1.04)");
    expect(composeFilterCss([sel("淡陽", 2)])).toBe("brightness(1.08)");
    expect(composeFilterCss([sel("淡陽", 3)])).toBe("brightness(1.13)");
  });

  it("filter が none の効果（線明・翠露等）は CSS 合成に出ない", () => {
    expect(composeFilterCss([sel("線明", 2)])).toBeNull();
    expect(composeFilterCss([sel("翠露", 2)])).toBeNull();
  });

  it("複数選択を join する（none は除外）", () => {
    // 美華(saturate) + 淡陽(brightness) + 線明(none) → saturate と brightness だけ。
    const css = composeFilterCss([sel("美華", 2), sel("淡陽", 2), sel("線明", 2)]);
    expect(css).toContain("saturate(1.28)");
    expect(css).toContain("brightness(1.08)");
    expect(css).not.toContain("none");
  });
});

describe("composeVignette / composeSharpen / composeEdgeBlur", () => {
  it("なしは 0", () => {
    expect(composeVignette([])).toBe(0);
    expect(composeSharpen([])).toBe(0);
    expect(composeEdgeBlur([])).toBe(0);
  });

  it("選択した強度の値を返す", () => {
    expect(composeVignette([sel("影暮", 1)])).toBe(0.5);
    expect(composeVignette([sel("影暮", 2)])).toBe(0.82);
    expect(composeVignette([sel("影暮", 3)])).toBe(1.0);
    expect(composeSharpen([sel("線明", 2)])).toBe(0.5);
    expect(composeEdgeBlur([sel("霞幻", 2)])).toBe(0.6);
  });

  it("該当効果を持たない選択は 0（線明に vignette は無い）", () => {
    expect(composeVignette([sel("線明", 3)])).toBe(0);
    expect(composeEdgeBlur([sel("線明", 3)])).toBe(0);
  });

  it("重ねがけは Max 合成（影暮強 + 線明 → vignette は影暮強）", () => {
    expect(composeVignette([sel("影暮", 3), sel("線明", 2)])).toBe(1.0);
    expect(composeSharpen([sel("影暮", 2), sel("線明", 3)])).toBe(0.7);
    expect(composeEdgeBlur([sel("線明", 3), sel("霞幻", 3)])).toBe(0.85);
  });
});

describe("composeToneCurve", () => {
  it("なし／トーン無し効果は null", () => {
    expect(composeToneCurve([])).toBeNull();
    expect(composeToneCurve([sel("美華", 2)])).toBeNull();
  });

  it("翠露=s / 土香=reverse-s", () => {
    expect(composeToneCurve([sel("翠露", 2)])).toBe("s");
    expect(composeToneCurve([sel("土香", 2)])).toBe("reverse-s");
  });

  it("翠露と土香の同時選択でトーンを完全に相殺する", () => {
    expect(composeToneCurve([sel("翠露", 3), sel("土香", 1)])).toBeNull();
    // トーンは canvas 側（filter は none）なので、CSS 合成は美華だけが残る。
    expect(composeFilterCss([sel("翠露", 2), sel("土香", 2), sel("美華", 2)])).toBe("saturate(1.28)");
  });
});

describe("composeToneAmount", () => {
  it("トーン無しは 0", () => {
    expect(composeToneAmount([])).toBe(0);
    expect(composeToneAmount([sel("美華", 2)])).toBe(0);
  });

  it("残った向きの level の amount を返す（弱0.2 / 中0.32 / 強0.45）", () => {
    expect(composeToneAmount([sel("翠露", 1)])).toBe(0.2);
    expect(composeToneAmount([sel("翠露", 2)])).toBe(0.32);
    expect(composeToneAmount([sel("翠露", 3)])).toBe(0.45);
    expect(composeToneAmount([sel("土香", 3)])).toBe(0.45);
  });

  it("相殺で 0（向きが残らない）", () => {
    expect(composeToneAmount([sel("翠露", 3), sel("土香", 1)])).toBe(0);
  });
});

describe("toneCurvePreviewCss", () => {
  it("null は null", () => {
    expect(toneCurvePreviewCss(null)).toBeNull();
  });

  it("既定 amount=0.32 で旧来の contrast(1.16)/contrast(0.86) に一致する", () => {
    expect(toneCurvePreviewCss("s")).toBe("contrast(1.160)");
    expect(toneCurvePreviewCss("reverse-s")).toBe("contrast(0.840)");
  });

  it("amount を上げると S字は contrast を強め、逆S字は弱める", () => {
    const contrastOf = (tone: "s" | "reverse-s", amount: number): number =>
      parseFloat(toneCurvePreviewCss(tone, amount)!.match(/contrast\(([\d.]+)\)/)![1]!);
    expect(contrastOf("s", 0.2)).toBeLessThan(contrastOf("s", 0.45));
    expect(contrastOf("reverse-s", 0.2)).toBeGreaterThan(contrastOf("reverse-s", 0.45));
  });
});
