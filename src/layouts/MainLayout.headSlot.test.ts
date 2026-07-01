import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// #484: about.astro が MainLayout の named slot（head）経由で CityHallBook（client:only）の
// 背景画像3枚に preload ヒントを足すようになった。このリポには .astro を直接レンダリングする
// テストインフラが無い（vitest.config.ts に Astro Vite プラグイン未設定）ため、
// source-text / fs ベースの軽量テストで配線・typo・漏れ出し・既定の空を静的に守る。

const layoutSrc = readFileSync(join(import.meta.dirname, "MainLayout.astro"), "utf8");
const pagesDir = join(import.meta.dirname, "..", "pages");
const publicDir = join(import.meta.dirname, "..", "..", "public");
const aboutSrc = readFileSync(join(pagesDir, "about.astro"), "utf8");

const PRELOAD_IMAGES = ["book-frame-washi-v1.webp", "book-page-washi-v1.webp", "mayor-botanics-watering-can.webp"];

/** src 内の <link> タグを抽出し、file への preload as=image リンクの数を数える（属性順に依存しない）。 */
function countPreloadLinks(src: string, file: string): number {
  const linkTags = src.match(/<link\b[^>]*\/?>/g) ?? [];
  return linkTags.filter(
    (tag) => tag.includes('rel="preload"') && tag.includes('as="image"') && tag.includes(`href="/${file}"`),
  ).length;
}

describe("about.astro の preload リンク（#484）", () => {
  it("3枚それぞれへの rel=\"preload\" as=\"image\" リンクをちょうど1回ずつ持つ", () => {
    for (const file of PRELOAD_IMAGES) {
      expect(countPreloadLinks(aboutSrc, file), file).toBe(1);
    }
  });

  it("preload 先の3枚は public/ に実在する（パス typo 検知）", () => {
    for (const file of PRELOAD_IMAGES) {
      expect(existsSync(join(publicDir, file)), file).toBe(true);
    }
  });
});

describe('slot="head" の漏れ出し防止（#484）', () => {
  // about.astro 専用の配線。他ページが同じ slot 名を使い出すと MainLayout 側の
  // 「既定は空」という前提が崩れ、意図しない head 要素が紛れ込む恐れがある。
  const otherPages = readdirSync(pagesDir).filter((f) => f.endsWith(".astro") && f !== "about.astro");

  it("対象ページ（about 以外）が見つかる（前提）", () => {
    expect(otherPages.length).toBeGreaterThan(0);
  });

  for (const file of otherPages) {
    it(`${file} は slot="head" を使わない`, () => {
      const src = readFileSync(join(pagesDir, file), "utf8");
      expect(src).not.toContain('slot="head"');
    });
  }
});

describe('MainLayout の <slot name="head" /> は既定空（#484）', () => {
  it("子要素・フォールバックコンテンツを持たない自己終了タグである", () => {
    expect(layoutSrc).toMatch(/<slot name="head" \/>/);
  });
});
