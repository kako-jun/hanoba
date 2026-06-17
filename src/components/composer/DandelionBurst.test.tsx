import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DandelionBurst from "./DandelionBurst.tsx";
import { makeSeeds } from "../../lib/composer/dandelion.ts";

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

describe("DandelionBurst（#148）", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("通常時は seeds の数だけ綿毛を描き、オーバーレイは aria-hidden・pointer-events なし", () => {
    stubMatchMedia(false);
    const seeds = makeSeeds(7, () => 0.5);
    const { container } = render(<DandelionBurst seeds={seeds} />);
    const overlay = container.querySelector("[aria-hidden='true']");
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toContain("pointer-events-none");
    expect(container.querySelectorAll(".ha-seed")).toHaveLength(7);
  });

  it("各綿毛に風・上昇・回転・時間・遅れの CSS 変数が乗る", () => {
    stubMatchMedia(false);
    const seeds = makeSeeds(3, () => 0.5);
    const { container } = render(<DandelionBurst seeds={seeds} />);
    const first = container.querySelector<HTMLElement>(".ha-seed");
    expect(first).not.toBeNull();
    const style = first!.getAttribute("style") ?? "";
    expect(style).toContain("--dx");
    expect(style).toContain("--dy");
    expect(style).toContain("--rot");
    expect(style).toContain("--dur");
    expect(style).toContain("--delay");
  });

  it("prefers-reduced-motion 時は何も描かない（null）", () => {
    stubMatchMedia(true);
    const { container } = render(<DandelionBurst seeds={makeSeeds(10, () => 0.5)} />);
    expect(container.querySelectorAll(".ha-seed")).toHaveLength(0);
    expect(container.firstChild).toBeNull();
  });

  it("seeds が空なら何も描かない", () => {
    stubMatchMedia(false);
    const { container } = render(<DandelionBurst seeds={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("matchMedia 不在（SSR 相当）でも例外なく描ける（抑制なし扱い）", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { container } = render(<DandelionBurst seeds={makeSeeds(4, () => 0.5)} />);
    expect(container.querySelectorAll(".ha-seed")).toHaveLength(4);
  });
});
