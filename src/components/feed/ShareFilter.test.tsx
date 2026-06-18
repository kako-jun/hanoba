import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ShareFilter from "./ShareFilter.tsx";

describe("ShareFilter (#139 段階2 共有導線)", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト"));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("active=false（既定表示）では何も出さない", () => {
    const { container } = render(<ShareFilter active={false} summary="みんなの植物" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("button", { name: /リンクをコピー/ })).not.toBeInTheDocument();
  });

  it("active=true で コピー／シェア ボタンを出す", () => {
    render(<ShareFilter active summary="トマト" />);
    expect(screen.getByRole("button", { name: /リンクをコピー/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "X でシェアする" })).toBeInTheDocument();
  });

  it("リンクをコピーで現在 URL を writeText し「コピーしました」を出す", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ShareFilter active summary="トマト" />);

    await user.click(screen.getByRole("button", { name: /リンクをコピー/ }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText("コピーしました")).toBeInTheDocument();
  });

  it("コピー失敗時は「コピーしました」を出さず黙る", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<ShareFilter active summary="トマト" />);

    await user.click(screen.getByRole("button", { name: /リンクをコピー/ }));

    // 失敗しても落ちず、成功メッセージは出ない。
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
  });

  // 「コピーしました」の約2秒後の自動消去は ProfileEditor #213 と同一の setTimeout パターン
  // （copyLink は同一実装）でそちらのテストが担保するため、ここでは fake-timers+userEvent の
  // 不安定な組み合わせを避けて再テストしない（コピー成功表示までを上で確認済み）。

  it("X でシェアは intent URL（要約＋現在 URL）を新規タブで開く", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(<ShareFilter active summary="トマト・実生" />);

    await user.click(screen.getByRole("button", { name: "X でシェアする" }));

    expect(open).toHaveBeenCalledTimes(1);
    // #37 の openXShare を再利用＝twitter.com intent・本文に要約＋現在 URL を畳む（単一 text= param）。
    const url = open.mock.calls[0]![0] as string;
    expect(url).toContain("https://twitter.com/intent/tweet");
    expect(url).toContain(encodeURIComponent("hanoba で「トマト・実生」の植物"));
    expect(url).toContain(encodeURIComponent(window.location.href));
    expect(open.mock.calls[0]![1]).toBe("_blank");
  });
});
