import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import PostCaption from "./PostCaption.tsx";

// jsdom はレイアウトしないため scrollHeight は常に 0。長文判定（#40）を検証するには
// HTMLElement.prototype.scrollHeight を一時的にモックして自然高を擬似する。
function mockScrollHeight(px: number) {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get: () => px,
  });
  return () => {
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollHeight", original);
    else delete (HTMLElement.prototype as unknown as { scrollHeight?: number }).scrollHeight;
  };
}

describe("PostCaption", () => {
  afterEach(() => cleanup());

  it("上限内の本文は全文表示し「続きを読む」を出さない（1クリック不要）", () => {
    const restore = mockScrollHeight(100); // 上限(288)未満
    try {
      render(<PostCaption caption="開花した。今朝の一枚。" />);
      expect(screen.getByText("開花した。今朝の一枚。")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "続きを読む" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("上限を僅かに超えただけ（ヒステリシス内）は畳まない", () => {
    const restore = mockScrollHeight(320); // 288 < 320 < 288+48。隠れ量が小さい
    try {
      render(<PostCaption caption="ほどほどの長さの本文。" />);
      expect(screen.queryByRole("button", { name: "続きを読む" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("上限超過の長文は畳んで「続きを読む」を出し、クリックで展開・再クリックで畳む", async () => {
    const restore = mockScrollHeight(1000); // 上限(288)超過
    try {
      const user = userEvent.setup();
      render(<PostCaption caption={"とても長い栽培ログ。".repeat(80)} />);

      const more = screen.getByRole("button", { name: "続きを読む" });
      expect(more).toHaveAttribute("aria-expanded", "false");

      await user.click(more);
      const close = screen.getByRole("button", { name: "閉じる" });
      expect(close).toHaveAttribute("aria-expanded", "true");

      await user.click(close);
      expect(screen.getByRole("button", { name: "続きを読む" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
