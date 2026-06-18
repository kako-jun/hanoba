import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDilution } from "../../lib/feed/dilution.ts";
import DilutionControl from "./DilutionControl.tsx";

// happy-dom の localStorage を毎回クリアし、設定の持ち越しを防ぐ。
describe("DilutionControl（人ごとに減らすスライダ・#138）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("既定は畳む＝中立な入口だけ出る・スライダは出ない（減らすのが基本だと誤解させない）", () => {
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    // 未設定なら中立文言の入口（"減らす"誘導にしない）。
    expect(
      screen.getByRole("button", { name: /アリスさんの表示を調整/ }),
    ).toBeInTheDocument();
    // 畳まれているのでスライダは存在しない。
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("入口を開くとスライダ（役割 slider）と人に明示した見出しが出る", async () => {
    const user = userEvent.setup();
    render(<DilutionControl pubkey="alice" authorName="アリス" />);

    await user.click(screen.getByRole("button", { name: /アリスさんの表示を調整/ }));

    const slider = screen.getByRole("slider", {
      name: "アリスさんの投稿をフィードで減らす量",
    });
    expect(slider).toBeInTheDocument();
    // 未設定＝段は「なし」を指す（0〜3 の生 index でなく言葉で読み上げる）。
    expect(slider).toHaveAttribute("aria-valuetext", "なし");
    // 見出しは人に明示（植物でなく人を減らすと一目で分かる）。
    expect(screen.getByText("アリスさんの投稿をフィードで減らす")).toBeInTheDocument();
  });

  it("保存済みの level は入口の文言とスライダ位置に反映される", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ alice: 5 }));
    render(<DilutionControl pubkey="alice" authorName="アリス" />);

    // 設定中は現在の減量を入口に出す（active な状態を見せる）。
    await user.click(screen.getByRole("button", { name: /アリスさんを 1\/5 に減らし中/ }));

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", "1/5");
    // STOPS=[null,2,5,10] なので 5 の index は 2。
    expect((slider as HTMLInputElement).value).toBe("2");
  });

  it("スライダを動かすと getDilution が更新される（index 2 → 1/5）", async () => {
    const user = userEvent.setup();
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    await user.click(screen.getByRole("button", { name: /アリスさんの表示を調整/ }));

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "2" } });

    expect(getDilution("alice")).toBe(5);
    expect(slider).toHaveAttribute("aria-valuetext", "1/5");
  });

  it("スライダを左端（なし）へ戻すと設定が解除される（getDilution→null）", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ alice: 2 }));
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    await user.click(screen.getByRole("button", { name: /アリスさんを 1\/2 に減らし中/ }));

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "0" } });

    expect(getDilution("alice")).toBeNull();
    expect(slider).toHaveAttribute("aria-valuetext", "なし");
  });

  it("a11y: 開くと なし／1/2／1/5／1/10 の段目盛りが並ぶ", async () => {
    const user = userEvent.setup();
    render(<DilutionControl pubkey="alice" authorName="アリス" />);
    await user.click(screen.getByRole("button", { name: /アリスさんの表示を調整/ }));

    for (const tick of ["なし", "1/2", "1/5", "1/10"]) {
      expect(screen.getByText(tick)).toBeInTheDocument();
    }
  });
});
