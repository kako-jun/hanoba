import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TagPicker from "./TagPicker.tsx";

describe("TagPicker", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("世話/記録のクイックタグを選ぶと onPick が呼ばれる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(onPick).toHaveBeenCalledWith("水やり");
  });

  it("選んだタグが「最近使った」に積まれ、再選択できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { rerender } = render(<TagPicker popular={[]} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "#開花" }));
    rerender(<TagPicker popular={[]} onPick={onPick} />);

    const recent = screen.getByText("最近使った").parentElement!;
    expect(within(recent).getByRole("button", { name: "#開花" })).toBeTruthy();
  });

  it("「植物から選ぶ」を開くとカテゴリ→属→品種を辿ってタグを挿入できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    // 動的 import 完了後にカテゴリが出る。
    await user.click(await screen.findByRole("button", { name: /多肉・塊根/ }));
    await user.click(await screen.findByRole("button", { name: /アガベ/ }));
    await user.click(await screen.findByRole("button", { name: "#チタノタ" }));

    expect(onPick).toHaveBeenCalledWith("チタノタ");
  });

  it("pickable な属では「このまま使う」で属タグを挿入できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.click(await screen.findByRole("button", { name: /多肉・塊根/ }));
    await user.click(await screen.findByRole("button", { name: /アガベ/ }));
    await user.click(await screen.findByRole("button", { name: /#アガベ をこのまま使う/ }));

    expect(onPick).toHaveBeenCalledWith("アガベ");
  });

  it("検索で品種を横断ヒットして挿入できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} onPick={onPick} />);

    await user.type(screen.getByLabelText("タグを検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /#グラキリス/ }));
    expect(onPick).toHaveBeenCalledWith("グラキリス");
  });

  it("検索で該当が無くても「そのまま使う」でフリーフォーム挿入できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} onPick={onPick} />);

    await user.type(screen.getByLabelText("タグを検索"), "我が家のレア株");
    await user.click(await screen.findByRole("button", { name: /そのまま #我が家のレア株 を使う/ }));
    expect(onPick).toHaveBeenCalledWith("我が家のレア株");
  });
});
