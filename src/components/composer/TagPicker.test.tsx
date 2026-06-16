import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TagPicker from "./TagPicker.tsx";

/** ドリルダウンを開いて アガベ の品種一覧まで降りる。 */
async function drillToAgave(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
  await user.click(await screen.findByRole("button", { name: /多肉・塊根/ }));
  await user.click(await screen.findByRole("button", { name: /アガベ/ }));
}

describe("TagPicker", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("世話/記録のクイックタグを選ぶと onPick が1回呼ばれる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} caption="" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(onPick.mock.calls).toEqual([["水やり"]]);
  });

  it("本文に入っているタグは満たされた色（aria-pressed=true）になる", () => {
    const onPick = vi.fn();
    render(<TagPicker popular={[]} caption="今日は #水やり した" onPick={onPick} />);
    expect(screen.getByRole("button", { name: "#水やり" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "#開花" })).toHaveAttribute("aria-pressed", "false");
  });

  it("品種を選ぶと上位の属タグも前置して #属 #品種 の順で入れる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} caption="" onPick={onPick} />);

    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: "#チタノタ" }));
    expect(onPick.mock.calls).toEqual([["アガベ"], ["チタノタ"]]);
  });

  it("「#属 をこのまま使う」は属だけを1回入れる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} caption="" onPick={onPick} />);

    await drillToAgave(user);
    await user.click(await screen.findByRole("button", { name: /#アガベ をこのまま使う/ }));
    expect(onPick.mock.calls).toEqual([["アガベ"]]);
  });

  it("人気の“属”をタップしたら挿入せず階層（品種一覧）に入る", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[{ tag: "パキポディウム", count: 5 }]} caption="" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "#パキポディウム" }));
    // 階層に入る＝品種（グラキリス）と「このまま使う」が出る。直接挿入はしない。
    expect(await screen.findByRole("button", { name: "#グラキリス" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /#パキポディウム をこのまま使う/ })).toBeTruthy();
    expect(onPick).not.toHaveBeenCalled();
  });

  it("パネル内の検索で品種を引き、上位属を補って挿入する", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} caption="" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "グラキリス");
    await user.click(await screen.findByRole("button", { name: /#グラキリス/ }));
    expect(onPick.mock.calls).toEqual([["パキポディウム"], ["グラキリス"]]);
  });

  it("検索で該当が無くても「そのまま使う」でフリーフォーム挿入できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<TagPicker popular={[]} caption="" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: /植物から選ぶ/ }));
    await user.type(await screen.findByLabelText("タグを検索"), "我が家のレア株");
    await user.click(await screen.findByRole("button", { name: /そのまま #我が家のレア株 を使う/ }));
    expect(onPick.mock.calls).toEqual([["我が家のレア株"]]);
  });

  it("選んだタグが「最近使った」に積まれ、再表示できる", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { rerender } = render(<TagPicker popular={[]} caption="" onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "#開花" }));
    rerender(<TagPicker popular={[]} caption="#開花 " onPick={onPick} />);

    const recent = screen.getByText("最近使った").parentElement!;
    expect(within(recent).getByRole("button", { name: "#開花" })).toBeTruthy();
  });
});
