// ProgressiveImage（#145・blur-up リビール）の単体テスト。
// 売り＝デコード完了まで img を隠して帯状の上からの描画を見せず、load で data-loaded を立てて
// CSS（.ha-reveal）でフェード＋unblur する。ここでは DOM 属性とロード状態遷移の土台を固定する。

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ProgressiveImage from "./ProgressiveImage.tsx";

describe("ProgressiveImage（#145）", () => {
  afterEach(() => cleanup());

  it("src/alt/className を反映し、ha-reveal クラスを必ず付ける", () => {
    render(<ProgressiveImage src="https://example.com/a.jpg" alt="アガベ" className="w-full h-full object-cover" />);
    const img = screen.getByRole("img", { name: "アガベ" });
    expect(img).toHaveAttribute("src", "https://example.com/a.jpg");
    expect(img.className).toContain("w-full");
    expect(img.className).toContain("object-cover");
    expect(img.className).toContain("ha-reveal");
  });

  it("loading は既定 lazy、decoding は async", () => {
    render(<ProgressiveImage src="https://example.com/a.jpg" alt="x" />);
    const img = screen.getByRole("img", { name: "x" });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("decoding", "async");
  });

  it("loading は eager に上書きできる", () => {
    render(<ProgressiveImage src="https://example.com/a.jpg" alt="x" loading="eager" />);
    expect(screen.getByRole("img", { name: "x" })).toHaveAttribute("loading", "eager");
  });

  it("draggable={false} を渡せる（カルーセルのスワイプ対策）", () => {
    render(<ProgressiveImage src="https://example.com/a.jpg" alt="x" draggable={false} />);
    expect(screen.getByRole("img", { name: "x" })).toHaveAttribute("draggable", "false");
  });

  it("初期は data-loaded='false'、load 発火で 'true' に変わる（帯状描画を隠す不変条件）", () => {
    render(<ProgressiveImage src="https://example.com/a.jpg" alt="x" />);
    const img = screen.getByRole("img", { name: "x" });
    expect(img).toHaveAttribute("data-loaded", "false");
    fireEvent.load(img);
    expect(img).toHaveAttribute("data-loaded", "true");
  });

  it("マウント時に img.complete が true なら（キャッシュ済み）即 data-loaded='true' になる", () => {
    // happy-dom は img.complete を上書き可能。onLoad が発火しないキャッシュ経路を再現する。
    const originalComplete = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "complete");
    Object.defineProperty(HTMLImageElement.prototype, "complete", {
      configurable: true,
      get() {
        return true;
      },
    });
    try {
      render(<ProgressiveImage src="https://example.com/cached.jpg" alt="cached" />);
      // useEffect 後の状態を見る（render は act 内で flush 済み）。
      expect(screen.getByRole("img", { name: "cached" })).toHaveAttribute("data-loaded", "true");
    } finally {
      if (originalComplete) {
        Object.defineProperty(HTMLImageElement.prototype, "complete", originalComplete);
      } else {
        delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).complete;
      }
    }
  });
});
