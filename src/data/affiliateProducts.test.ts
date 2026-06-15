import { describe, expect, it } from "vitest";
import { AFFILIATE_ENABLED, AFFILIATE_PRODUCTS } from "./affiliateProducts.ts";

describe("affiliateProducts", () => {
  it("AFFILIATE_ENABLED は boolean", () => {
    expect(typeof AFFILIATE_ENABLED).toBe("boolean");
  });

  it("商品はちょうど 3 件", () => {
    expect(AFFILIATE_PRODUCTS.length).toBe(3);
  });

  describe("各商品のデータ契約", () => {
    it.each(AFFILIATE_PRODUCTS)("$title", (p) => {
      // title / caption は非空。
      expect(p.title.trim().length).toBeGreaterThan(0);
      expect(p.caption.trim().length).toBeGreaterThan(0);
      // url は amzn.to 短縮リンク（tag 焼き込み済み）。
      expect(p.url).toMatch(/^https:\/\/amzn\.to\//);
      // imageUrl は Amazon CDN。
      expect(p.imageUrl).toMatch(/^https:\/\/m\.media-amazon\.com\/images\//);
    });
  });
});
