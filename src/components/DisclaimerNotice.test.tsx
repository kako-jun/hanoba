import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DisclaimerNotice from "./DisclaimerNotice.tsx";

describe("DisclaimerNotice", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("断り書きの文言をレンダリングする", () => {
    render(<DisclaimerNotice />);
    expect(screen.getByText(/Nostr のフィードを表示しているだけです/)).toBeInTheDocument();
    expect(screen.getByText(/mypace でも見られます/)).toBeInTheDocument();
  });

  it("閉じるボタンでバナーが消え、localStorage に記憶する", async () => {
    const user = userEvent.setup();
    render(<DisclaimerNotice />);

    await user.click(screen.getByRole("button", { name: "この案内を閉じる" }));

    expect(screen.queryByText(/Nostr のフィードを表示しているだけです/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("hanoba:disclaimer-dismissed")).toBe("1");
  });

  it("既に閉じている場合は最初から表示しない", () => {
    window.localStorage.setItem("hanoba:disclaimer-dismissed", "1");
    render(<DisclaimerNotice />);
    expect(screen.queryByText(/Nostr のフィードを表示しているだけです/)).not.toBeInTheDocument();
  });
});
