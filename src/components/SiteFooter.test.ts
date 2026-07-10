import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { t } from "../lib/i18n/t.ts";
import { civicHub } from "../lib/lore/cityHall.ts";

// #484: フッタ街並みマスク画像を footer-skyline.png（PNG）→ footer-skyline.webp（lossless）へ
// 差し替え。旧ファイル名の残存・mask-image / -webkit-mask-image 片方だけの直し忘れ・
// 旧 PNG の削除漏れ・新 webp の欠落を fs / source-text ベースで固定する。

const footerSrc = readFileSync(join(import.meta.dirname, "SiteFooter.astro"), "utf8");
const publicDir = join(import.meta.dirname, "..", "..", "public");
const layoutSrc = readFileSync(join(import.meta.dirname, "..", "layouts", "MainLayout.astro"), "utf8");
const internalNavSrc = footerSrc.slice(footerSrc.indexOf("<nav"), footerSrc.indexOf("</nav>") + "</nav>".length);
const internalHrefs = [...internalNavSrc.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
const externalArraySrc = footerSrc.slice(footerSrc.indexOf("const external = ["), footerSrc.indexOf("];", footerSrc.indexOf("const external = [")));
const externalHrefs = [...externalArraySrc.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]);
const shellKeysSrc = layoutSrc.slice(layoutSrc.indexOf("const shellKeys"), layoutSrc.indexOf("];", layoutSrc.indexOf("const shellKeys")));

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

describe("フッタ導線順（#532）", () => {
  it("内部ナビ href は指定した DOM 順で並ぶ", () => {
    expect(internalHrefs).toEqual(["/about", "/gazette", "/ranking", "/vote", "/discover", "/me", "/compose"]);
  });

  it("みんなの植物とあなたの植物は隣接する", () => {
    expect(internalHrefs.indexOf("/me") - internalHrefs.indexOf("/discover")).toBe(1);
  });

  it("内部ナビ href は重複しない", () => {
    expect(new Set(internalHrefs).size).toBe(internalHrefs.length);
  });

  it("外部リンクは mypace、GitHub の順を維持する", () => {
    expect(externalHrefs).toEqual(["https://mypace.llll-ll.com", "https://github.com/kako-jun/hanoba"]);
  });

  it("mypace と GitHub は内部 nav の外に置く", () => {
    expect(internalNavSrc).not.toMatch(/mypace\.llll-ll\.com|github\.com/);
  });

  it("フッタの実在窓口3件は civicHub と同じ順になる", () => {
    const footerCivicRoutes = internalHrefs.filter((href) => ["/gazette", "/ranking", "/vote"].includes(href!));
    expect(footerCivicRoutes).toEqual(civicHub("ja").slice(0, 3).map((link) => link.route));
  });

  it("mobile/desktop は単一 nav の同じ DOM 順を使い、CSS order で並べ替えない", () => {
    expect(footerSrc.match(/<nav\b/g)).toHaveLength(1);
    expect(internalNavSrc).not.toMatch(/(?:^|\s)(?:sm:|md:|lg:)?order-/);
  });
});

describe("フッタ公開情報（#543）", () => {
  it("Nostalgic Counter はフッタに小さく置き、実IDを使う", () => {
    expect(footerSrc).toContain("<nostalgic-counter");
    expect(footerSrc).toContain("NOSTALGIC_COUNTER_ID");
    expect(footerSrc).toContain("来街者");
  });

  it("version 表記を出す", () => {
    expect(footerSrc).toContain("HANOBA_VERSION");
    expect(footerSrc).toContain("v{HANOBA_VERSION}");
  });

  it("GitHub Sponsors はフッタ外部リンクに混ぜない", () => {
    expect(footerSrc).not.toContain("github.com/sponsors");
  });
});

describe("フッタナビの aria（#532）", () => {
  it.each([
    ["ja", "フッターナビゲーション"],
    ["en", "Footer navigation"],
    ["es", "Navegación del pie de página"],
    ["zh", "页脚导航"],
  ] as const)("%s は footer.nav.aria の専用訳を持つ", (locale, expected) => {
    expect(t(locale, "footer.nav.aria")).toBe(expected);
  });

  it("nav は初期 aria-label と言語差し替え属性を持つ", () => {
    expect(internalNavSrc).toContain('aria-label={t(locale, "footer.nav.aria")}');
    expect(internalNavSrc).toContain('data-i18n-aria="footer.nav.aria"');
  });

  it("MainLayout shellKeys は footer.nav.aria を含む", () => {
    expect(shellKeysSrc).toContain('"footer.nav.aria"');
  });
});
