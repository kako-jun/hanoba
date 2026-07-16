import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const layoutSrc = readFileSync(join(import.meta.dirname, "MainLayout.astro"), "utf8");
const indexSrc = readFileSync(join(import.meta.dirname, "..", "pages", "index.astro"), "utf8");

describe("MainLayout SEO head", () => {
  it("meta keywords を使わない", () => {
    expect(layoutSrc).not.toMatch(/name=["']keywords["']/);
  });

  it("canonical / robots / OGP locale を出す", () => {
    expect(layoutSrc).toContain('<link rel="canonical" href={canonical} />');
    expect(layoutSrc).toContain('<meta name="robots" content="index,follow" />');
    expect(layoutSrc).toContain('<meta property="og:locale" content={ogLocale} />');
  });

  it("既定 JSON-LD は WebSite と WebPage を含む", () => {
    expect(layoutSrc).toContain('"@type": "WebSite"');
    expect(layoutSrc).toContain('"@type": "WebPage"');
    expect(layoutSrc).toContain('isPartOf: { "@id": `${SITE.href}#website` }');
  });
});

describe("home page SEO", () => {
  it("トップページは汎用 title ではなく検索結果向け title / description を明示する", () => {
    expect(indexSrc).toContain('title="Hanōba — Plant Photo Social Feed"');
    expect(indexSrc).toContain('description={t(locale, "site.description")}');
  });
});
