import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// /vote は Nostalgic BBS の埋め込みページ。Astro ページを直接レンダリングする
// テスト基盤は無いので、source-text でレイアウト方針を固定する。
const voteSrc = readFileSync(join(import.meta.dirname, "pages", "vote.astro"), "utf8");
const mainClass = voteSrc.match(/<main class="([^"]+)"/)?.[1] ?? "";
const boardSectionClass = voteSrc.match(/class="([^"]*max-w-3xl[^"]*)"\s*\n\s*style=\{`--i:/)?.[1] ?? "";

describe("/vote の広幅レイアウト（#540）", () => {
  it("SiteHeader は wide 幅を使い、他の広幅ページと外枠を揃える", () => {
    expect(voteSrc).toContain("<SiteHeader wide />");
  });

  it("ページ外枠は lg で max-w-5xl まで広がる", () => {
    expect(mainClass).toContain("max-w-3xl");
    expect(mainClass).toContain("lg:max-w-5xl");
  });

  it("BBS 本体の列は max-w-3xl に留め、掲示板だけ広がりすぎない", () => {
    expect(boardSectionClass).toContain("w-full");
    expect(boardSectionClass).toContain("max-w-3xl");
    expect(boardSectionClass).not.toContain("lg:max-w-5xl");
    expect(voteSrc).toContain('<nostalgic-bbs id={board.id} theme="dark" width="100%">');
  });
});
