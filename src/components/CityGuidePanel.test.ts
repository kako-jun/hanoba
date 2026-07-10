import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const panelSrc = readFileSync(join(import.meta.dirname, "CityGuidePanel.astro"), "utf8");
const affiliateGridSrc = readFileSync(join(import.meta.dirname, "AffiliateGrid.astro"), "utf8");
const aboutSrc = readFileSync(join(import.meta.dirname, "..", "pages", "about.astro"), "utf8");
const publicDir = join(import.meta.dirname, "..", "..", "public");

describe("CityGuidePanel（#543）", () => {
  it("市民手帳下の案内札として about に配置する", () => {
    expect(aboutSrc).toContain('import CityGuidePanel from "../components/CityGuidePanel.astro"');
    expect(aboutSrc).toContain("<CityGuidePanel />");
  });

  it("QR は提供済み画像 public/hanoba-qr-code.png を参照し、準備中文言を残さない", () => {
    expect(panelSrc).toContain('const QR_SRC = "/hanoba-qr-code.png"');
    expect(panelSrc).toContain('style={`--qr-src: url("${QR_SRC}")`}');
    expect(panelSrc).not.toContain("QR 準備中");
    expect(existsSync(join(publicDir, "hanoba-qr-code.png"))).toBe(true);
  });

  it("QR に装飾枠を付けず、黒地角丸と既存の明るい緑で読み取り面を作る", () => {
    expect(panelSrc).not.toContain("border-dashed");
    expect(panelSrc).toContain("rounded-xl bg-ha-base p-3");
    expect(panelSrc).toContain("qr-code-mask block h-32 w-32 bg-ha-green");
    expect(panelSrc).not.toContain("filter:");
    expect(panelSrc).toContain("mask-image: var(--qr-src)");
  });

  it("QR 下の URL は中央揃えにする", () => {
    expect(panelSrc).toContain("text-center text-sm font-bold");
    expect(panelSrc).not.toContain("QR を見せれば");
  });

  it("GitHub Sponsors 導線は案内札に混ぜない", () => {
    expect(panelSrc).not.toContain("github.com/sponsors");
    expect(panelSrc).not.toContain("水やり");
  });

  it("GitHub Sponsors 導線は道具棚の一番下に置き、水やり文言を使う", () => {
    const disclosureText = "Amazon アソシエイトです。運営への水やりです。";
    const amazonDisclosureIndex = affiliateGridSrc.indexOf(disclosureText);
    const sponsorsIndex = affiliateGridSrc.indexOf('href="https://github.com/sponsors/kako-jun"');

    expect(affiliateGridSrc).toContain(disclosureText);
    expect(sponsorsIndex).toBeGreaterThan(amazonDisclosureIndex);
    expect(affiliateGridSrc).toContain("GitHub Sponsors で支援する");
  });
});
