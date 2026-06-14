import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
const fetchHanobaFeed = vi.fn();
// PostDetail がマウント時に呼ぶいいね数取得もモックで止める（#12）。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchHanobaFeed: (...args: unknown[]) => fetchHanobaFeed(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
}));

import FeedGrid from "./FeedGrid.tsx";

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

describe("FeedGrid", () => {
  beforeEach(() => {
    fetchHanobaFeed.mockReset();
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
  });

  afterEach(() => {
    cleanup();
  });

  it("投稿が無ければ空状態の文言と投稿リンクを出す", async () => {
    fetchHanobaFeed.mockResolvedValue([]);
    render(<FeedGrid />);
    expect(await screen.findByText(/なにも灯っていない棚/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "投稿する" })).toHaveAttribute("href", "/compose");
  });

  it("投稿 2 件で img が 2 つ並び、src は parsePost の imageUrl になる", async () => {
    // 一言必須（DESIGN §1）＝ alt は非空。空 alt の img は presentational になり role=img で拾えない。
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "a", caption: "一枚目", imageUrl: "https://image.nostr.build/a.jpg" }),
      makePost({ id: "b", caption: "二枚目", imageUrl: "https://image.nostr.build/b.png" }),
    ]);
    render(<FeedGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    const imgs = screen.getAllByRole("img");
    expect(imgs.map((el) => el.getAttribute("src"))).toEqual([
      "https://image.nostr.build/a.jpg",
      "https://image.nostr.build/b.png",
    ]);
  });

  it("タグチップのクリックで絞り込まれ件数が減る", async () => {
    const user = userEvent.setup();
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "a", caption: "開花 #アガベ", hashtags: ["アガベ"] }),
      makePost({ id: "b", caption: "水やり #パキポ", hashtags: ["パキポ"] }),
      makePost({ id: "c", caption: "発根 #アガベ", hashtags: ["アガベ"] }),
    ]);
    render(<FeedGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));

    // セルを開いて詳細モーダルを出し、その中の #アガベ チップで絞り込む。
    await user.click(screen.getByRole("button", { name: "開花 #アガベ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#アガベ" }));

    // モーダルは閉じ、アガベの 2 件だけ残る。
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByRole("img")).toHaveLength(2);
    // 絞り込みチップと解除ボタンが出る。
    expect(screen.getByRole("button", { name: "絞り込みを解除" })).toBeInTheDocument();
  });

  it("絞り込み解除で全件に戻る", async () => {
    const user = userEvent.setup();
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "a", caption: "開花 #アガベ", hashtags: ["アガベ"] }),
      makePost({ id: "b", caption: "水やり #パキポ", hashtags: ["パキポ"] }),
    ]);
    render(<FeedGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "開花 #アガベ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#アガベ" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "絞り込みを解除" }));
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });
});
