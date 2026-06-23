import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBackToClose } from "./useBackToClose.ts";

// #454: /me のモーダルで「戻る」がページ離脱でなくモーダル閉になることを、履歴 API のスパイで検証する。
// happy-dom の history.back は popstate を出さないので、戻るは dispatchEvent で擬似する（deep-link テストと同型）。
describe("useBackToClose（#454 戻るでモーダルだけ閉じる）", () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;
  let backSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    window.history.replaceState(null, "", "/me");
    pushSpy = vi.spyOn(window.history, "pushState");
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    pushSpy.mockRestore();
    backSpy.mockRestore();
  });

  it("閉じている時は履歴を積まない", () => {
    renderHook(() => useBackToClose(false, () => {}));
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("開くと同一 URL の履歴マーカーを1つ積む（URL は変えない）", () => {
    renderHook(() => useBackToClose(true, () => {}));
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith({ haModal: true }, "");
    expect(window.location.pathname).toBe("/me"); // deep-link にしない＝URL 不変
  });

  it("戻る（popstate）で onClose を呼ぶ＝モーダルだけ閉じる", () => {
    const onClose = vi.fn();
    renderHook(() => useBackToClose(true, onClose));
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("戻るで閉じた時は cleanup で back を呼ばない（二重 back しない）", () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(({ open }) => useBackToClose(open, onClose), { initialProps: { open: true } });
    window.dispatchEvent(new PopStateEvent("popstate")); // closedByPop=true
    backSpy.mockClear();
    rerender({ open: false }); // cleanup
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("✕/Esc（popstate 以外）で閉じた時は cleanup で back を1回呼び履歴マーカーを消費する", () => {
    const { rerender } = renderHook(({ open }) => useBackToClose(open, () => {}), { initialProps: { open: true } });
    backSpy.mockClear();
    rerender({ open: false }); // closedByPop=false → cleanup back
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
