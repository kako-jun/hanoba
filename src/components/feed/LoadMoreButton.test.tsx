import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoadMoreButton from "./LoadMoreButton.tsx";

// LoadMoreButton は 3 画面共通の「もっと見る」ボタン（#554）。Provider 未装着＝原典 ja で描く
// （context 既定＝ja・DEFAULT_LOCALE 非依存）。hasMore/loading/onClick の契約だけを単体で検証する。
describe("LoadMoreButton（#554・共通コンポーネント）", () => {
  afterEach(() => cleanup());

  it("hasMore=false → 何も描画しない（null）", () => {
    const { container } = render(<LoadMoreButton hasMore={false} loading={false} onClick={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("hasMore=true, loading=false → ラベル「もっと見る」・有効", () => {
    render(<LoadMoreButton hasMore={true} loading={false} onClick={() => {}} />);
    const btn = screen.getByRole("button", { name: "もっと見る" });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAttribute("aria-busy", "false");
  });

  it("loading=true → disabled＋aria-busy=true＋ラベル差替（読み込み中…）", () => {
    render(<LoadMoreButton hasMore={true} loading={true} onClick={() => {}} />);
    const btn = screen.getByRole("button", { name: "読み込み中…" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("クリックで onClick が1回・disabled 中は発火しない", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    const { rerender } = render(<LoadMoreButton hasMore={true} loading={false} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "もっと見る" }));
    expect(onClick).toHaveBeenCalledTimes(1);

    // loading 中（disabled）はクリックしても発火しない。
    rerender(<LoadMoreButton hasMore={true} loading={true} onClick={onClick} />);
    await user.click(screen.getByRole("button", { name: "読み込み中…" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
