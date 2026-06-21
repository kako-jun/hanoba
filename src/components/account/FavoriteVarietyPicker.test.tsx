import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FavoriteVarietyPicker from "./FavoriteVarietyPicker.tsx";

afterEach(() => cleanup());

describe("FavoriteVarietyPicker（#141・好きな品種の複数選択）", () => {
  it("ドリルダウンで品種を選ぶと onChange にその品種名だけ追加する（カテゴリ/属は前置しない）", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FavoriteVarietyPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.click(await screen.findByRole("button", { name: /多肉植物/ }));
    await user.click(await screen.findByRole("button", { name: /アガベ/ }));
    await user.click(await screen.findByRole("button", { name: /チタノタ/ }));
    // タグと違い「好きな品種」は葉名だけ＝["チタノタ"]（#カテゴリ #属 を前置しない）。
    expect(onChange).toHaveBeenCalledWith(["チタノタ"]);
  });

  it("検索で品種を引いて選べる（葉名だけ追加）", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FavoriteVarietyPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("品種を検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /グラキリス/ }));
    expect(onChange).toHaveBeenCalledWith(["グラキリス"]);
  });

  it("選択済みチップを × で外すと onChange からその品種が消える", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FavoriteVarietyPicker selected={["グラキリス", "チタノタ"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "グラキリス を好きな品種から外す" }));
    expect(onChange).toHaveBeenCalledWith(["チタノタ"]);
  });

  it("検索で該当なしでも「そのまま追加」でフリーフォーム品種を足せる", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FavoriteVarietyPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("品種を検索"), "我が家のレア株");
    await user.click(await screen.findByRole("button", { name: /そのまま「我が家のレア株」を追加/ }));
    expect(onChange).toHaveBeenCalledWith(["我が家のレア株"]);
  });
});
