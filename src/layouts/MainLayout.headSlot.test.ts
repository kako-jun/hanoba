import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOK_FRAME_SRC, BOOK_PAGE_SRC, MAYOR_AVATAR_SRC } from "../lib/lore/cityHallAssets.ts";

// #484: about.astro が MainLayout の named slot（head）経由で CityHallBook（client:only）の
// 背景画像3枚に preload ヒントを足すようになった。このリポには .astro を直接レンダリングする
// テストインフラが無い（vitest.config.ts に Astro Vite プラグイン未設定）ため、
// source-text / fs ベースの軽量テストで配線・typo・漏れ出し・既定の空を静的に守る。
//
// パス文字列自体は cityHallAssets.ts の共有定数が正本（#484 should-2）。about.astro は
// href={BOOK_FRAME_SRC} のように import した定数をそのまま使うので、ここでも同じ定数から
// 期待値を組み立てる（別にハードコードした配列を持つと、片方だけ変更しても偽陰性で緑になる）。
const PRELOAD_ASSETS: readonly [exportName: string, path: string][] = [
  ["BOOK_FRAME_SRC", BOOK_FRAME_SRC],
  ["BOOK_PAGE_SRC", BOOK_PAGE_SRC],
  ["MAYOR_AVATAR_SRC", MAYOR_AVATAR_SRC],
];

const layoutSrc = readFileSync(join(import.meta.dirname, "MainLayout.astro"), "utf8");
const pagesDir = join(import.meta.dirname, "..", "pages");
const publicDir = join(import.meta.dirname, "..", "..", "public");
const aboutSrc = readFileSync(join(pagesDir, "about.astro"), "utf8");

/** src 内の <link> タグを抽出し、exportName（href={exportName}）への preload as=image リンクの数を数える（属性順に依存しない）。 */
function countPreloadLinks(src: string, exportName: string): number {
  const linkTags = src.match(/<link\b[^>]*\/?>/g) ?? [];
  return linkTags.filter(
    (tag) => tag.includes('rel="preload"') && tag.includes('as="image"') && tag.includes(`href={${exportName}}`),
  ).length;
}

describe("about.astro の preload リンク（#484）", () => {
  it("3枚それぞれへの rel=\"preload\" as=\"image\" リンクをちょうど1回ずつ持つ", () => {
    for (const [exportName] of PRELOAD_ASSETS) {
      expect(countPreloadLinks(aboutSrc, exportName), exportName).toBe(1);
    }
  });

  it("cityHallAssets.ts の共有定数を import している（#484 should-2・二重ハードコード防止）", () => {
    expect(aboutSrc).toMatch(/from ["']\.\.\/lib\/lore\/cityHallAssets\.ts["']/);
  });

  it("preload 先の3枚は public/ に実在する（パス typo 検知）", () => {
    for (const [exportName, path] of PRELOAD_ASSETS) {
      const filename = path.replace(/^\//, "");
      expect(existsSync(join(publicDir, filename)), `${exportName} -> ${filename}`).toBe(true);
    }
  });
});

describe('slot="head" の漏れ出し防止（#484）', () => {
  // about.astro 専用の配線。他ページが同じ slot 名を使い出すと MainLayout 側の
  // 「既定は空」という前提が崩れ、意図しない head 要素が紛れ込む恐れがある。
  // 再帰スキャン（nit-1）: 今は src/pages にサブディレクトリが無いが、将来ネストした
  // ページが増えても素通りしないよう readdirSync の recursive オプションで全階層を見る。
  const otherPages = readdirSync(pagesDir, { recursive: true }).filter(
    (f): f is string => typeof f === "string" && f.endsWith(".astro") && f !== "about.astro",
  );

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
