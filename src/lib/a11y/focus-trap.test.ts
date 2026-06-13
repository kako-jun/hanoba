import { describe, expect, it } from "vitest";
import { focusTrapTarget } from "./focus-trap.ts";

describe("focusTrapTarget", () => {
  const items = ["a", "b", "c"];

  it("末尾で Tab（!shift）→ 先頭を返す", () => {
    expect(focusTrapTarget(items, "c", false)).toBe("a");
  });

  it("先頭で Shift+Tab → 末尾を返す", () => {
    expect(focusTrapTarget(items, "a", true)).toBe("c");
  });

  it("中間（!shift・active が末尾でない）は null（既定移動に任せる）", () => {
    expect(focusTrapTarget(items, "b", false)).toBeNull();
  });

  it("中間（shift・active が先頭でない）は null", () => {
    expect(focusTrapTarget(items, "b", true)).toBeNull();
  });

  it("先頭で Tab（!shift）は null（既定で次へ）", () => {
    expect(focusTrapTarget(items, "a", false)).toBeNull();
  });

  it("末尾で Shift+Tab は null（既定で前へ）", () => {
    expect(focusTrapTarget(items, "c", true)).toBeNull();
  });

  it("focusable が空なら null", () => {
    expect(focusTrapTarget([], null, false)).toBeNull();
    expect(focusTrapTarget([], null, true)).toBeNull();
  });

  it("要素1つ: Tab/Shift+Tab とも自身に留まる（先頭=末尾）", () => {
    expect(focusTrapTarget(["only"], "only", false)).toBe("only");
    expect(focusTrapTarget(["only"], "only", true)).toBe("only");
  });

  it("active が列に無い（null/外部）なら端へ引き込む（外へ逃がさない＝完全トラップ）", () => {
    expect(focusTrapTarget(items, null, false)).toBe("a"); // 外/未設定で Tab → 先頭
    expect(focusTrapTarget(items, null, true)).toBe("c"); // 外/未設定で Shift+Tab → 末尾
    expect(focusTrapTarget(items, "x", false)).toBe("a"); // 列に無い要素で Tab → 先頭
    expect(focusTrapTarget(items, "x", true)).toBe("c"); // 列に無い要素で Shift+Tab → 末尾
  });
});
