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

  it("active=true で打ち上げバーストぶんの綿毛を body への portal（fixed+overflow-hidden オーバーレイ）に描く", () => {
    stubMatchMedia(false);
    render(<DandelionBurst active={true} />);
    // 種は body へ portal される（fixed inset-0 overflow-hidden ＝ 文書スクロールに一切影響しない・#148 根治）。
    const seeds = document.querySelectorAll(".ha-seed");
    expect(seeds).toHaveLength(14); // 打ち上げバースト14粒（連続スポーンの interval はまだ発火していない）
    const overlay = seeds[0]!.parentElement!;
    expect(overlay.className).toContain("pointer-events-none");
    expect(overlay.className).toContain("fixed");
    expect(overlay.className).toContain("overflow-hidden");
    expect(overlay.getAttribute("aria-hidden")).toBe("true");
  });

  it("外側に風・上昇・回転・時間・遅れ、横揺れレイヤに振幅・周期・位相の CSS 変数と画像が乗る", () => {
    stubMatchMedia(false);
    render(<DandelionBurst active={true} />);
    const first = document.querySelector<HTMLElement>(".ha-seed");
    expect(first).not.toBeNull();
    // 外側（上昇レイヤ）は位置系の変数。横揺れ（--sway）は別レイヤに移したので外側には乗らない（#260）。
    const style = first!.getAttribute("style") ?? "";
    for (const v of ["--dx", "--dy", "--rot", "--dur", "--delay"]) {
      expect(style).toContain(v);
    }
    expect(style).not.toContain("--sway");
    // 横揺れは中間 span（別レイヤ）。振幅・周期・位相の CSS 変数が乗る（#260）。
    const sway = first!.querySelector<HTMLElement>(".ha-seed-sway");
    expect(sway).not.toBeNull();
    const swayStyle = sway!.getAttribute("style") ?? "";
    for (const v of ["--sway", "--sway-dur", "--sway-phase"]) {
      expect(swayStyle).toContain(v);
    }
    // 変種スプライト（複数の透過 PNG のどれか）が <img> で描かれる。
    const img = first!.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toMatch(/^\/seed-watercolor-\d\.png$/);
  });

  it("prefers-reduced-motion 時は active でも何も描かない（null）", () => {
    stubMatchMedia(true);
    const { container } = render(<DandelionBurst active={true} />);
    expect(document.querySelectorAll(".ha-seed")).toHaveLength(0);
    expect(container.firstChild).toBeNull();
  });

  it("matchMedia 不在（SSR 相当）でも例外なく描ける（抑制なし扱い）", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<DandelionBurst active={true} />);
    expect(document.querySelectorAll(".ha-seed").length).toBeGreaterThan(0);
  });

  it("綿毛は上昇（ha-seed-rise）の animationend で自分を消す（舞い終わると DOM から外れる）", () => {
    stubMatchMedia(false);
    render(<DandelionBurst active={true} />);
    const seedsBefore = document.querySelectorAll(".ha-seed");
    expect(seedsBefore.length).toBe(14);
    // 上昇アニメの終了で、その粒だけ消える（React の onAnimationEnd に届く形で発火・#260）。
    fireEvent.animationEnd(seedsBefore[0]!, { animationName: "ha-seed-rise" });
    expect(document.querySelectorAll(".ha-seed")).toHaveLength(13);
  });

  it("上昇以外（横揺れ／fade）の animationend では消えない（#260 ガード）", () => {
    stubMatchMedia(false);
    render(<DandelionBurst active={true} />);
    const seeds = document.querySelectorAll(".ha-seed");
    expect(seeds.length).toBe(14);
    // fade の終了が外側へ bubble しても消さない（上昇の終了だけが removeSeed の合図）。
    fireEvent.animationEnd(seeds[0]!, { animationName: "ha-seed-fade" });
    expect(document.querySelectorAll(".ha-seed")).toHaveLength(14);
  });
});
