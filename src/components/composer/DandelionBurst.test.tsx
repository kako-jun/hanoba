import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DandelionBurst from "./DandelionBurst.tsx";

// matchMedia を差し替えて reduced-motion の on/off を制御する。
function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

describe("DandelionBurst（#148 / #252）", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("active=false のときは何も描かない（null）", () => {
    stubMatchMedia(false);
    const { container } = render(<DandelionBurst active={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("active=true で打ち上げバーストぶんの綿毛を描き、オーバーレイは aria-hidden・pointer-events なし", () => {
    stubMatchMedia(false);
    const { container } = render(<DandelionBurst active={true} />);
    const overlay = container.querySelector("[aria-hidden='true']");
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toContain("pointer-events-none");
    // 起動直後は打ち上げバースト（14粒）が出ている（連続スポーンの interval はまだ発火していない）。
    expect(container.querySelectorAll(".ha-seed")).toHaveLength(14);
  });

  it("各綿毛に風・上昇・回転・横揺れ・時間・遅れの CSS 変数と画像が乗る", () => {
    stubMatchMedia(false);
    const { container } = render(<DandelionBurst active={true} />);
    const first = container.querySelector<HTMLElement>(".ha-seed");
    expect(first).not.toBeNull();
    const style = first!.getAttribute("style") ?? "";
    for (const v of ["--dx", "--dy", "--rot", "--sway", "--dur", "--delay"]) {
      expect(style).toContain(v);
    }
    // 変種スプライト（複数の透過 PNG のどれか）が <img> で描かれる。
    const img = first!.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toMatch(/^\/seed-watercolor-\d\.png$/);
  });

  it("prefers-reduced-motion 時は active でも何も描かない（null）", () => {
    stubMatchMedia(true);
    const { container } = render(<DandelionBurst active={true} />);
    expect(container.querySelectorAll(".ha-seed")).toHaveLength(0);
    expect(container.firstChild).toBeNull();
  });

  it("matchMedia 不在（SSR 相当）でも例外なく描ける（抑制なし扱い）", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { container } = render(<DandelionBurst active={true} />);
    expect(container.querySelectorAll(".ha-seed").length).toBeGreaterThan(0);
  });

  it("綿毛は animationend で自分を消す（舞い終わると DOM から外れる）", () => {
    stubMatchMedia(false);
    const { container } = render(<DandelionBurst active={true} />);
    const seedsBefore = container.querySelectorAll(".ha-seed");
    expect(seedsBefore.length).toBe(14);
    // 1粒のアニメーションが終わったら、その粒だけ消える（React の onAnimationEnd に届く形で発火）。
    fireEvent.animationEnd(seedsBefore[0]!);
    expect(container.querySelectorAll(".ha-seed")).toHaveLength(13);
  });
});
