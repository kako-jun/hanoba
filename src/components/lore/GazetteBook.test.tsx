import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GazetteBook, { GAZETTE_PAGE_STORAGE_KEY } from "./GazetteBook.tsx";
import CityHallBook, { BOOK_PAGE_STORAGE_KEY } from "./CityHallBook.tsx";

describe("GazetteBook（#164）", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("hanoba:lang", "ja");
    history.replaceState(null, "", "/gazette");
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("初期表示で最新記事（1ページ目）が表示され1 / 4になる", async () => {
    render(<GazetteBook />);
    expect(await screen.findByRole("heading", { level: 2, name: "市民手帳、全面改訂" })).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
  });

  it("表示中の記事にMayorMark（市長アイコン+肩書き）が出る", async () => {
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    expect(screen.getByText("ボタニクス市長")).toBeInTheDocument();
    expect(document.querySelector("img[alt='']")).not.toBeNull();
  });

  it("「次へ」クリックで1つ古い記事に移り2 / 4になる（逆順ページングの直接検証）", async () => {
    const user = userEvent.setup();
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "表示言語、世界へ開く" })).toBeInTheDocument();
  });

  it("1ページ目で「前へ」「最初のページ」がdisabled", async () => {
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
  });

  it("4ページ目（最古）で「次へ」「最後のページ」がdisabled", async () => {
    const user = userEvent.setup();
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "「あなたの植物」を一枚の札に" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeDisabled();
  });

  it("記事0のリンクが実際のhrefを指す", async () => {
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    expect(screen.getByRole("link", { name: /市民手帳を開く/ })).toHaveAttribute("href", "/about");
  });

  it("links0件の記事は関連リンクのul自体が描画されない", async () => {
    const user = userEvent.setup();
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText("2 / 4")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("links複数件の記事は全リンクが描画される", async () => {
    const user = userEvent.setup();
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText("3 / 4")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /住民投票へ/ })).toHaveAttribute("href", "/vote");
    expect(screen.getByRole("link", { name: /市勢調査へ/ })).toHaveAttribute("href", "/ranking");
  });

  it("GAZETTE_PAGE_STORAGE_KEYはCityHallBookのBOOK_PAGE_STORAGE_KEYと異なる文字列（保存位置の相互汚染を防ぐ）", () => {
    expect(GAZETTE_PAGE_STORAGE_KEY).not.toBe(BOOK_PAGE_STORAGE_KEY);
  });

  it("gazetteの?page=<id>を手帳側で開いても該当idが見つからず1ページ目にフォールバックする（逆方向も同様）", async () => {
    history.replaceState(null, "", "/about?page=handbook-revision");
    render(<CityHallBook />);
    expect(await screen.findByText("1 / 10")).toBeInTheDocument();
    cleanup();

    history.replaceState(null, "", "/gazette?page=welcome");
    render(<GazetteBook />);
    expect(await screen.findByText("1 / 4")).toBeInTheDocument();
  });

  it("article.dateはlocaleを切り替えても書式が変化しない", async () => {
    // resolveClientLocale() は localStorage 保存値を最優先で読む（lang prop は初期値のみ）ので、
    // locale切替は localStorage 側で行う。
    localStorage.setItem("hanoba:lang", "ja");
    const { unmount } = render(<GazetteBook />);
    expect(await screen.findByText("2026-07-09")).toBeInTheDocument();
    unmount();
    cleanup();

    localStorage.setItem("hanoba:lang", "en");
    render(<GazetteBook />);
    expect(await screen.findByText("2026-07-09")).toBeInTheDocument();
  });

  it("GazetteBookのレンダリングにfetchMyPostsモックが不要（Nostr依存を暗黙に引き継いでいない）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GazetteBook />);
    await screen.findByText("1 / 4");
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
