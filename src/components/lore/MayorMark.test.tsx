import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MayorMark from "./MayorMark.tsx";

// 語り手マーク（#455/#164）。Avatar は装飾（alt空）で、隣に市長名テキストを置いてa11yを満たす形を固定する。
describe("MayorMark（#164）", () => {
  afterEach(() => {
    cleanup();
  });

  it("Avatarのaltは空文字で、隣接する市長名テキストが存在する", () => {
    const { container } = render(<MayorMark />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", "");
    expect(container.textContent).toContain("ボタニクス市長");
  });
});
