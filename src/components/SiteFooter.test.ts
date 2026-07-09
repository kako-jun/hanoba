import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t } from "../lib/i18n/t.ts";

// #484: フッタ街並みマスク画像を footer-skyline.png（PNG）→ footer-skyline.webp（lossless）へ
// 差し替え。旧ファイル名の残存・mask-image / -webkit-mask-image 片方だけの直し忘れ・
// 旧 PNG の削除漏れ・新 webp の欠落を fs / source-text ベースで固定する。

const footerSrc = readFileSync(join(import.meta.dirname, "SiteFooter.astro"), "utf8");
const publicDir = join(import.meta.dirname, "..", "..", "public");
const layoutSrc = readFileSync(join(import.meta.dirname, "..", "layouts", "MainLayout.astro"), "utf8");

describe("SiteFooter の背景マスク画像差し替え（#484）", () => {
  it("footer-skyline.png への参照が残っていない（旧ファイル名の事故防止）", () => {
    expect(footerSrc).not.toContain("footer-skyline.png");
  });

  it("mask-image と -webkit-mask-image の両方が footer-skyline.webp を参照する（直し忘れ防止）", () => {
    expect(footerSrc).toContain('-webkit-mask-image: url("/footer-skyline.webp")');
    // -webkit- 接頭辞なしの行だけを見る（上の行の部分一致で偽陽性にならないよう否定後読みで区別）。
    expect(footerSrc).toMatch(/(?<!-webkit-)mask-image: url\("\/footer-skyline\.webp"\)/);
  });

  it("public/footer-skyline.png は削除済み（恒久化）", () => {
    expect(existsSync(join(publicDir, "footer-skyline.png"))).toBe(false);
  });

  it("public/footer-skyline.webp が実在する", () => {
    expect(existsSync(join(publicDir, "footer-skyline.webp"))).toBe(true);
  });
});

describe("フッタ・窓口ナビの統合（#525）", () => {
  it("/vote への住民投票リンクが存在する", () => {
    expect(footerSrc).toContain('href="/vote"');
    expect(footerSrc).toContain('data-i18n="nav.vote"');
  });

  it("nav.ranking のラベルは「市勢調査」であり旧「人気ランキング」が残っていない（改称の固定化）", () => {
    expect(t("ja", "nav.ranking")).toBe("市勢調査");
    expect(t("ja", "nav.ranking")).not.toBe("人気ランキング");
  });

  it("MainLayout の shellKeys に nav.vote が含まれる（言語 swap 対象からの漏れ防止・past incident pattern）", () => {
    const start = layoutSrc.indexOf("const shellKeys");
    const end = layoutSrc.indexOf("];", start);
    const shellKeysBlock = layoutSrc.slice(start, end);
    expect(shellKeysBlock).toContain('"nav.vote"');
  });
});

describe("フッタ・窓口ナビの統合（#164）", () => {
  it("/gazette への市政だよりリンクが存在する", () => {
    expect(footerSrc).toContain('href="/gazette"');
    expect(footerSrc).toContain('data-i18n="nav.gazette"');
  });

  it("nav.gazette のラベルは窓口（cityHall.map.civic.2.label）と同名になる（命名統一）", () => {
    expect(t("ja", "nav.gazette")).toBe(t("ja", "cityHall.map.civic.2.label"));
  });

  it("MainLayout の shellKeys に nav.gazette が含まれる（言語 swap 対象からの漏れ防止・past incident pattern）", () => {
    const start = layoutSrc.indexOf("const shellKeys");
    const end = layoutSrc.indexOf("];", start);
    const shellKeysBlock = layoutSrc.slice(start, end);
    expect(shellKeysBlock).toContain('"nav.gazette"');
  });
});
