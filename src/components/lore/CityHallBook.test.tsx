import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMyPosts = vi.fn();
const getDisplayName = vi.fn();
const getPublicKeyHex = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({ fetchMyPosts: (...args: unknown[]) => fetchMyPosts(...args) }));
vi.mock("../../lib/nostr/keys.ts", () => ({
  getDisplayName: (...args: unknown[]) => getDisplayName(...args),
  getPublicKeyHex: (...args: unknown[]) => getPublicKeyHex(...args),
}));

import CityHallBook, { BOOK_PAGE_STORAGE_KEY } from "./CityHallBook.tsx";

describe("CityHallBook 10ページナビ（#137）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset().mockResolvedValue([]);
    getDisplayName.mockReset().mockReturnValue(null);
    getPublicKeyHex.mockReset().mockResolvedValue("a".repeat(64));
    localStorage.clear();
    localStorage.setItem("hanoba:lang", "ja");
    history.replaceState(null, "", "/about");
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("全10ページを最初から開放し、画像と説明を含む1ページ目を表示する", async () => {
    render(<CityHallBook />);
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳" })).toBeInTheDocument();
    expect(screen.queryByText(/L1/)).not.toBeInTheDocument();
    expect(await screen.findByText(/ようこそ、緑の市へ/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "緑に包まれたハノーバ市の俯瞰" })).toHaveAttribute("src", "/hanoba-welcome-vista.webp");
    expect(screen.getByText(/植物専用の写真SNSです/)).toBeInTheDocument();
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });

  it("最後に開いた安定IDから再開する", async () => {
    localStorage.setItem(BOOK_PAGE_STORAGE_KEY, "crest");
    render(<CityHallBook />);
    expect(await screen.findByRole("heading", { level: 2, name: "市章" })).toBeInTheDocument();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
  });

  it("URL指定を保存位置より優先する", async () => {
    localStorage.setItem(BOOK_PAGE_STORAGE_KEY, "crest");
    history.replaceState(null, "", "/about?page=ordinances");
    render(<CityHallBook />);
    expect(await screen.findByRole("heading", { level: 2, name: "市の条文" })).toBeInTheDocument();
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
  });

  it("既存ページャーから先頭・末尾へ一気に移動できる", async () => {
    const user = userEvent.setup();
    render(<CityHallBook />);
    await screen.findByText("1 / 10");
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByText("10 / 10")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "最初のページ" }));
    expect(screen.getByText("1 / 10")).toBeInTheDocument();
  });

  it("市政の窓口は全ページ下部に表示する", async () => {
    render(<CityHallBook />);
    expect(screen.getByRole("heading", { name: "市政の窓口" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /住民投票/ })).toHaveAttribute("href", "/vote");
  });

  it("窓口の市勢調査は /ranking へのリンクとして開庁している（#525）", async () => {
    render(<CityHallBook />);
    expect(screen.getByRole("link", { name: /市勢調査/ })).toHaveAttribute("href", "/ranking");
  });

  it("品評会・市長ブログは非リンク（aria-disabled）のまま近日開庁バッジを持つ（開庁済みと混同しない）", async () => {
    render(<CityHallBook />);
    const exhibition = screen.getByText("品評会（コンテスト）").closest("li");
    expect(exhibition).toHaveAttribute("aria-disabled", "true");
    expect(exhibition).toHaveTextContent("近日開庁");
    const mayorBlog = screen.getByText("市長ブログ").closest("li");
    expect(mayorBlog).toHaveAttribute("aria-disabled", "true");
    expect(mayorBlog).toHaveTextContent("近日開庁");
    // 対照: 開庁済みの住民投票は aria-disabled を持たない。
    expect(screen.getByRole("link", { name: /住民投票/ }).closest("li")).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("矢印キーとスワイプでもページ・URL・保存位置を同期する", async () => {
    const user = userEvent.setup();
    render(<CityHallBook />);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("2 / 10")).toBeInTheDocument();
    expect(new URLSearchParams(location.search).get("page")).toBe("map");

    const content = document.querySelector('[aria-live="polite"]')!;
    const panel = content.parentElement!;
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 80, clientY: 100 }] });
    expect(screen.getByText("3 / 10")).toBeInTheDocument();
    expect(localStorage.getItem(BOOK_PAGE_STORAGE_KEY)).toBe("district-1");
  });
});
