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

describe("CityHallBook 20ページナビ（#137）", () => {
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

  it("全20ページを最初から開放し、1ページ目を表示する", async () => {
    render(<CityHallBook />);
    expect(await screen.findByText(/ようこそ、緑の市へ/)).toBeInTheDocument();
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
  });

  it("最後に開いた安定IDから再開する", async () => {
    localStorage.setItem(BOOK_PAGE_STORAGE_KEY, "crest");
    render(<CityHallBook />);
    expect(await screen.findByRole("heading", { level: 2, name: "市章" })).toBeInTheDocument();
    expect(screen.getByText("11 / 20")).toBeInTheDocument();
  });

  it("URL指定を保存位置より優先する", async () => {
    localStorage.setItem(BOOK_PAGE_STORAGE_KEY, "crest");
    history.replaceState(null, "", "/about?page=specialties");
    render(<CityHallBook />);
    expect(await screen.findByRole("heading", { level: 2, name: "特産物" })).toBeInTheDocument();
    expect(screen.getByText("12 / 20")).toBeInTheDocument();
  });

  it("5ページ進む・先頭・末尾へ一気に移動できる", async () => {
    const user = userEvent.setup();
    render(<CityHallBook />);
    await screen.findByText("1 / 20");
    await user.click(screen.getByRole("button", { name: "5ページ進む" }));
    expect(screen.getByText("6 / 20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByText("20 / 20")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "最初のページ" }));
    expect(screen.getByText("1 / 20")).toBeInTheDocument();
  });

  it("目次から任意ページへ直接移動し位置を保存する", async () => {
    const user = userEvent.setup();
    render(<CityHallBook />);
    const toc = screen.getByLabelText("目次");
    await user.selectOptions(toc, "district-3");
    expect(screen.getByRole("heading", { level: 2, name: "果樹の丘" })).toBeInTheDocument();
    expect(localStorage.getItem(BOOK_PAGE_STORAGE_KEY)).toBe("district-3");
    expect(new URLSearchParams(location.search).get("page")).toBe("district-3");
  });

  it("市政の窓口は巻末だけに表示する", async () => {
    const user = userEvent.setup();
    render(<CityHallBook />);
    expect(screen.queryByRole("heading", { name: "市政の窓口" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByRole("heading", { name: "市政の窓口" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /住民投票/ })).toHaveAttribute("href", "/vote");
  });

  it("矢印キーとスワイプでもページ・URL・保存位置を同期する", async () => {
    const user = userEvent.setup();
    render(<CityHallBook />);
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("2 / 20")).toBeInTheDocument();
    expect(new URLSearchParams(location.search).get("page")).toBe("settlement");

    const content = document.querySelector('[aria-live="polite"]')!;
    const panel = content.parentElement!;
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 80, clientY: 100 }] });
    expect(screen.getByText("3 / 20")).toBeInTheDocument();
    expect(localStorage.getItem(BOOK_PAGE_STORAGE_KEY)).toBe("vista");
  });
});
