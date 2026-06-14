import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
const fetchDiscover = vi.fn();
// PostDetail がマウント時に呼ぶいいね数取得もモックで止める（#12）。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscover: (...args: unknown[]) => fetchDiscover(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

// 検索ボックスの aria-label（タグ/キーワード両対応・#24）。
const SEARCH_BOX = "植物のタグ または 本文キーワード";

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
    fetchDiscover.mockReset();
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    // 各テストで URL のクエリを空に戻す（初期検索が走らないように）。
    window.history.replaceState(null, "", "/discover");
  });

  afterEach(() => {
    cleanup();
  });

  it("未検索（idle）では集約の断り書きと案内文を出す", () => {
    render(<DiscoverGrid />);
    expect(screen.getByText(/hanoba 以外のクライアントの投稿も含みます/)).toBeInTheDocument();
    expect(screen.getByText(/「探す」を押すと/)).toBeInTheDocument();
    expect(fetchDiscover).not.toHaveBeenCalled();
  });

  it("キーワード（# 無し）で検索すると fetchDiscover に素の語を渡す（本文検索・#24）", async () => {
    const user = userEvent.setup();
    fetchDiscover.mockResolvedValue([
      makePost({ id: "a", caption: "葉焼けした" }),
      makePost({ id: "b", caption: "また葉焼け" }),
    ]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "葉焼け");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    // 正規化せず raw を渡す（モード分岐は fetchDiscover 側）。
    expect(fetchDiscover).toHaveBeenCalledWith("葉焼け");
  });

  it("先頭 # 付きはそのまま fetchDiscover に渡す（タグモードは内部で分岐）", async () => {
    const user = userEvent.setup();
    fetchDiscover.mockResolvedValue([]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "#パキポ");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#パキポ"));
  });

  it("0 件なら見つからない文言を出す", async () => {
    const user = userEvent.setup();
    fetchDiscover.mockResolvedValue([]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "サボテン");
    await user.click(screen.getByRole("button", { name: "探す" }));

    expect(await screen.findByText(/「サボテン」の投稿は見つかりませんでした/)).toBeInTheDocument();
  });

  it("セルクリックで PostDetail（dialog）を開く", async () => {
    const user = userEvent.setup();
    fetchDiscover.mockResolvedValue([makePost({ id: "a", caption: "開花した" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花した" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("詳細内のタグクリックでそのタグを # 付き（タグモード）で再検索する", async () => {
    const user = userEvent.setup();
    fetchDiscover
      .mockResolvedValueOnce([makePost({ id: "a", caption: "開花 #パキポ", hashtags: ["パキポ"] })])
      .mockResolvedValueOnce([makePost({ id: "z", caption: "別のパキポ" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花 #パキポ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));

    // モーダルは閉じ、#パキポ（タグモード）で再検索される。
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchDiscover).toHaveBeenLastCalledWith("#パキポ");
  });

  it("URL の ?q= があればマウント時に初期検索する", async () => {
    fetchDiscover.mockResolvedValue([makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
    expect(await screen.findAllByRole("img")).toHaveLength(1);
  });

  it("旧 ?tag= リンクも後方互換で初期検索する", async () => {
    fetchDiscover.mockResolvedValue([makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?tag=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
  });
});
