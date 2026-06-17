import { describe, expect, it } from "vitest";
import { nextPhotoIndex, prevPhotoIndex, swipeDirection } from "./carousel.ts";

describe("nextPhotoIndex（端は wrap）", () => {
  it("末尾以外は +1 する", () => {
    expect(nextPhotoIndex(0, 3)).toBe(1);
    expect(nextPhotoIndex(1, 3)).toBe(2);
  });

  it("末尾は先頭へ wrap する", () => {
    expect(nextPhotoIndex(2, 3)).toBe(0);
  });

  it("len<=1 は切り替えない（i を返す）", () => {
    expect(nextPhotoIndex(0, 1)).toBe(0);
    expect(nextPhotoIndex(0, 0)).toBe(0);
  });
});

describe("prevPhotoIndex（端は wrap）", () => {
  it("先頭以外は -1 する", () => {
    expect(prevPhotoIndex(2, 3)).toBe(1);
    expect(prevPhotoIndex(1, 3)).toBe(0);
  });

  it("先頭は末尾へ wrap する", () => {
    expect(prevPhotoIndex(0, 3)).toBe(2);
  });

  it("len<=1 は切り替えない（i を返す）", () => {
    expect(prevPhotoIndex(0, 1)).toBe(0);
    expect(prevPhotoIndex(0, 0)).toBe(0);
  });
});

describe("next/prev は既存 ←→ 式と一致する", () => {
  // 旧インライン式: next=(i+1)%len, prev=(i===0?len-1:i-1)。回帰防止。
  it("len=4 の全 index で旧式と一致", () => {
    const len = 4;
    for (let i = 0; i < len; i++) {
      expect(nextPhotoIndex(i, len)).toBe((i + 1) % len);
      expect(prevPhotoIndex(i, len)).toBe(i === 0 ? len - 1 : i - 1);
    }
  });
});

describe("swipeDirection（水平優位＋しきい値）", () => {
  it("左スワイプ（dx<0・水平優位）は next", () => {
    expect(swipeDirection(-80, 5)).toBe("next");
  });

  it("右スワイプ（dx>0・水平優位）は prev", () => {
    expect(swipeDirection(80, -5)).toBe("prev");
  });

  it("しきい値（既定40）以下は null", () => {
    expect(swipeDirection(40, 0)).toBeNull();
    expect(swipeDirection(-30, 0)).toBeNull();
    expect(swipeDirection(0, 0)).toBeNull();
  });

  it("縦優位（|dy| >= |dx|）は null＝縦スクロールと競合させない", () => {
    expect(swipeDirection(-50, -60)).toBeNull();
    expect(swipeDirection(50, 50)).toBeNull();
  });

  it("斜めでも水平が十分勝っていれば確定する", () => {
    expect(swipeDirection(-100, -30)).toBe("next");
    expect(swipeDirection(100, 30)).toBe("prev");
  });

  it("しきい値は引数で変えられる", () => {
    expect(swipeDirection(20, 0, 10)).toBe("prev");
    expect(swipeDirection(20, 0, 40)).toBeNull();
  });
});
