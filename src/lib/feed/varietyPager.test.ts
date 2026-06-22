import { describe, expect, it } from "vitest";
import { PAGE_SIZE, chunk, pageCount, clampPage } from "./varietyPager.ts";

describe("PAGE_SIZE", () => {
  it("1 ページ 10 件（kako-jun 指示・#388）", () => {
    expect(PAGE_SIZE).toBe(10);
  });
});

describe("chunk（10 件ずつ・順序保持・端数許容）", () => {
  it("0 件は空配列（ページ無し）", () => {
    expect(chunk([])).toEqual([]);
  });

  it("10 件ちょうどは 1 ページ（端数無し）", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const pages = chunk(items);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toHaveLength(10);
  });

  it("11 件は 2 ページ（10 + 1・最終ページが端数）", () => {
    const items = Array.from({ length: 11 }, (_, i) => i);
    const pages = chunk(items);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(10);
    expect(pages[1]).toHaveLength(1);
    expect(pages[1]).toEqual([10]);
  });

  it("1000 件は 100 ページ（各 10 件・端数無し）", () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const pages = chunk(items);
    expect(pages).toHaveLength(100);
    for (const p of pages) expect(p).toHaveLength(10);
  });

  it("順序を保つ（票数降順を崩さない）＝連結すると元に戻る", () => {
    const items = Array.from({ length: 25 }, (_, i) => `v${i}`);
    expect(chunk(items).flat()).toEqual(items);
  });

  it("size は引数で変えられる", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("size<=0 は安全側で全件 1 ページ（無限ループ防止）／0 件なら空", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1, 2, 3]]);
    expect(chunk([], 0)).toEqual([]);
  });
});

describe("pageCount（切り上げ・0 件は 0）", () => {
  it("境界（0・10・11・1000）", () => {
    expect(pageCount(0)).toBe(0);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(10)).toBe(1);
    expect(pageCount(11)).toBe(2);
    expect(pageCount(1000)).toBe(100);
    expect(pageCount(1001)).toBe(101);
  });

  it("chunk のページ数と一致する", () => {
    for (const n of [0, 1, 9, 10, 11, 23, 100, 1000]) {
      const items = Array.from({ length: n }, (_, i) => i);
      expect(pageCount(n)).toBe(chunk(items).length);
    }
  });
});

describe("clampPage（端は止める・非 wrap）", () => {
  it("範囲内はそのまま", () => {
    expect(clampPage(0, 30)).toBe(0); // 3 ページ
    expect(clampPage(1, 30)).toBe(1);
    expect(clampPage(2, 30)).toBe(2);
  });

  it("先頭を越えたら 0／末尾を越えたら last（wrap しない）", () => {
    expect(clampPage(-1, 30)).toBe(0);
    expect(clampPage(3, 30)).toBe(2); // last = 2
    expect(clampPage(999, 30)).toBe(2);
  });

  it("0 件は 0 を返す", () => {
    expect(clampPage(0, 0)).toBe(0);
    expect(clampPage(5, 0)).toBe(0);
  });
});
