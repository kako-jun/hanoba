import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// 静的殻（.astro ページ）の見出し i18n 配線の不変条件（#147/#384・compose の "Post" 残りバグ再発防止）。
//
// 殻は既定言語（en）でビルドされ、非既定言語（ja/zh/es）へは MainLayout の is:inline swap が
// `data-i18n="KEY"` の付いた要素だけを差し替える。見出し（h1/h2）が `{t(locale, "KEY")}` を直接
// 描画するのに同じタグに `data-i18n="KEY"` が無いと、その見出しは**既定言語（英語）のまま固まる**。
// （compose ページの大見出しが非英語でも "Post" だった真因＝go-live #147 からの配線漏れ・#421 後に発覚。）
//
// 注: このテストは `src/pages/*.astro` を**読むだけ**。テスト本体を `src/pages/` 配下に置くと Astro が
// ページとしてビルドしようとして落ちるため、ここ（src/lib/i18n）に置く。パスは cwd 基準で解決する。

const pagesDir = join(process.cwd(), "src/pages");
const pages = readdirSync(pagesDir).filter((f) => f.endsWith(".astro"));

describe("ページ見出しの i18n swap 配線", () => {
  it("対象ページが見つかる（前提）", () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  for (const file of pages) {
    it(`${file}: <h1>/<h2> が {t(locale,"KEY")} を出すなら data-i18n="KEY" を持つ`, () => {
      const src = readFileSync(join(pagesDir, file), "utf8");
      const offenders: string[] = [];
      // 開きタグ（単一行）＋直後の {t(locale, "KEY")} 直書きを捕捉する。
      for (const m of src.matchAll(/<(h1|h2)\b([^>]*)>\s*\{\s*t\(locale,\s*"([^"]+)"\s*\)\s*\}/g)) {
        const [, tag, attrs, key] = m;
        if (!attrs!.includes(`data-i18n="${key}"`)) {
          offenders.push(`<${tag}> {t(locale,"${key}")} に data-i18n="${key}" が無い`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});
