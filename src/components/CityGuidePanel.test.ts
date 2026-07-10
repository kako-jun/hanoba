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
    expect(panelSrc).toContain('src={QR_SRC}');
    expect(panelSrc).not.toContain("QR 準備中");
    expect(existsSync(join(publicDir, "hanoba-qr-code.png"))).toBe(true);
  });

  it("QR に装飾枠を付けず、白地と緑色化で読み取り面を作る", () => {
    expect(panelSrc).not.toContain("border-dashed");
    expect(panelSrc).toContain("bg-white p-2");
    expect(panelSrc).toContain("qr-code-image");
    expect(panelSrc).toContain("filter:");
  });

  it("QR 下の URL は中央揃えにする", () => {
    expect(panelSrc).toContain("text-center text-sm font-bold");
  });

  it("GitHub Sponsors 導線は案内札に混ぜない", () => {
    expect(panelSrc).not.toContain("github.com/sponsors");
    expect(panelSrc).not.toContain("水やり");
  });

  it("GitHub Sponsors 導線は道具棚の一番下に置き、水やり文言を使わない", () => {
    const disclosureText = "Amazon アソシエイトです。購入による紹介料は運営費に充てます。";
    const amazonDisclosureIndex = affiliateGridSrc.indexOf(disclosureText);
    const sponsorsIndex = affiliateGridSrc.indexOf('href="https://github.com/sponsors/kako-jun"');

    expect(affiliateGridSrc).toContain(disclosureText);
    expect(sponsorsIndex).toBeGreaterThan(amazonDisclosureIndex);
    expect(affiliateGridSrc).toContain("GitHub Sponsors で支援する");
    expect(affiliateGridSrc).not.toContain("水やり");
  });
});
