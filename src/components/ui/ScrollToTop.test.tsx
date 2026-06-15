import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ScrollToTop from "./ScrollToTop.tsx";

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: y });
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("ScrollToTop（#110）", () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("最上部付近では出さない（閾値以下）", () => {
    setScrollY(0);
    render(<ScrollToTop />);
    expect(screen.queryByRole("button", { name: "一番上へ戻る" })).toBeNull();
  });

  it("一定量スクロールすると出現し、押すと scrollTo(top:0, smooth) を呼ぶ", () => {
    const scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, value: scrollTo });
    render(<ScrollToTop />);
    setScrollY(900);
    const btn = screen.getByRole("button", { name: "一番上へ戻る" });
    act(() => btn.click());
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
