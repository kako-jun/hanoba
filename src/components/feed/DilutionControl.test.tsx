import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDilution } from "../../lib/feed/dilution.ts";
import DilutionControl from "./DilutionControl.tsx";

// happy-dom の localStorage を毎回クリアし、設定の持ち越しを防ぐ。
describe("DilutionControl（人ごとに薄めるコントロール・#138）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("未設定なら『なし』が checked・他段は unchecked（現在 level の反映）", () => {
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    expect(screen.getByRole("radio", { name: "なし" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "1/2" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "1/5" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "1/10" })).toHaveAttribute("aria-checked", "false");
  });

  it("保存済みの level がその段の aria-checked に反映される", () => {
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ alice: 5 }));
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    expect(screen.getByRole("radio", { name: "1/5" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "なし" })).toHaveAttribute("aria-checked", "false");
  });

  it("『1/5』をクリックすると getDilution が 5 になり、その段が checked になる", async () => {
    const user = userEvent.setup();
    render(<DilutionControl pubkey="alice" authorName="アリス" />);

    await user.click(screen.getByRole("radio", { name: "1/5" }));

    expect(getDilution("alice")).toBe(5);
    expect(screen.getByRole("radio", { name: "1/5" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "なし" })).toHaveAttribute("aria-checked", "false");
  });

  it("『なし』をクリックすると設定が解除される（getDilution→null）", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ alice: 2 }));
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    expect(screen.getByRole("radio", { name: "1/2" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "なし" }));

    expect(getDilution("alice")).toBeNull();
    expect(screen.getByRole("radio", { name: "なし" })).toHaveAttribute("aria-checked", "true");
  });

  it("a11y: radiogroup（著者名入りラベル）の中に なし/1/2・1/5・1/10 の4 radio が並ぶ", () => {
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    const group = screen.getByRole("radiogroup", { name: "アリス の投稿をフィードで薄める" });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["なし", "1/2", "1/5", "1/10"]);
  });
});
