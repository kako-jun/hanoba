import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
const fetchDiscoverByTag = vi.fn();
// PostDetail がマウント時に呼ぶいいね数取得もモックで止める（#12）。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscoverByTag: (...args: unknown[]) => fetchDiscoverByTag(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    caption: overrides.caption ?? "",
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
  };
}

describe("DiscoverGrid", () => {
  beforeEach(() => {
    fetchDiscoverByTag.mockReset();
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    // 各テストで URL の ?tag= を空に戻す（初期検索が走らないように）。
    window.history.replaceState(null, "", "/discover");
  });

  afterEach(() => {
    cleanup();
  });

  it("未検索（idle）では集約の断り書きと案内文を出す", () => {
    render(<DiscoverGrid />);
    expect(screen.getByText(/hanoba 以外のクライアントの投稿も含みます/)).toBeInTheDocument();
    expect(screen.getByText(/「探す」を押すと/)).toBeInTheDocument();
    expect(fetchDiscoverByTag).not.toHaveBeenCalled();
  });

  it("検索で fetchDiscoverByTag が呼ばれグリッドに件数が並ぶ", async () => {
    const user = userEvent.setup();
    fetchDiscoverByTag.mockResolvedValue([
      makePost({ id: "a", caption: "アガベ自慢" }),
      makePost({ id: "b", caption: "別のアガベ" }),
    ]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: "探したい植物のタグ" }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(fetchDiscoverByTag).toHaveBeenCalledWith("アガベ");
  });

  it("先頭 # 付きで入力しても normalize して検索する", async () => {
    const user = userEvent.setup();
    fetchDiscoverByTag.mockResolvedValue([]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: "探したい植物のタグ" }), "#パキポ");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(fetchDiscoverByTag).toHaveBeenCalledWith("パキポ"));
  });

  it("0 件なら見つからない文言を出す", async () => {
    const user = userEvent.setup();
    fetchDiscoverByTag.mockResolvedValue([]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: "探したい植物のタグ" }), "サボテン");
    await user.click(screen.getByRole("button", { name: "探す" }));

    expect(await screen.findByText(/「#サボテン」の投稿は見つかりませんでした/)).toBeInTheDocument();
  });

  it("セルクリックで PostDetail（dialog）を開く", async () => {
    const user = userEvent.setup();
    fetchDiscoverByTag.mockResolvedValue([makePost({ id: "a", caption: "開花した" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: "探したい植物のタグ" }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花した" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("詳細内のタグクリックでそのタグを再検索する", async () => {
    const user = userEvent.setup();
    fetchDiscoverByTag
      .mockResolvedValueOnce([makePost({ id: "a", caption: "開花 #パキポ", hashtags: ["パキポ"] })])
      .mockResolvedValueOnce([makePost({ id: "z", caption: "別のパキポ" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: "探したい植物のタグ" }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花 #パキポ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));

    // モーダルは閉じ、パキポで再検索される。
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchDiscoverByTag).toHaveBeenLastCalledWith("パキポ");
  });

  it("URL の ?tag= があればマウント時に初期検索する", async () => {
    fetchDiscoverByTag.mockResolvedValue([makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?tag=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscoverByTag).toHaveBeenCalledWith("アガベ"));
    expect(await screen.findAllByRole("img")).toHaveLength(1);
  });
});
