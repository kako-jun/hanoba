import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const panelSrc = readFileSync(join(import.meta.dirname, "CityGuidePanel.astro"), "utf8");
const aboutSrc = readFileSync(join(import.meta.dirname, "..", "pages", "about.astro"), "utf8");
const publicDir = join(import.meta.dirname, "..", "..", "public");

describe("CityGuidePanel（#543）", () => {
  it("市民手帳下の案内札として about に配置する", () => {
    expect(aboutSrc).toContain('import CityGuidePanel from "../components/CityGuidePanel.astro"');
    expect(aboutSrc).toContain("<CityGuidePanel />");
  });

  it("QR は提供済み画像 public/hanoba-qr-code.png を参照し、準備中文言を残さない", () => {
    expect(panelSrc).toContain('const QR_SRC = "/hanoba-qr-code.png"');
    expect(panelSrc).toContain('src={QR_SRC}');
    expect(panelSrc).not.toContain("QR 準備中");
    expect(existsSync(join(publicDir, "hanoba-qr-code.png"))).toBe(true);
  });

  it("GitHub Sponsors 導線は案内札に置く", () => {
    expect(panelSrc).toContain('href="https://github.com/sponsors/kako-jun"');
    expect(panelSrc).toContain("運営へ水やりする");
  });
});
