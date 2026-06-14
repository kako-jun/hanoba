import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない・#12）。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
}));

import PostDetail from "./PostDetail.tsx";

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? Math.floor(Date.now() / 1000),
    caption: overrides.caption ?? "開花した",
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
  };
}

describe("PostDetail いいね数表示", () => {
  beforeEach(() => {
    fetchReactionCount.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("取得したいいね数をハート＋数で表示する", async () => {
    fetchReactionCount.mockResolvedValue(3);
    render(<PostDetail post={makePost({ id: "p1" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    // ハートはアイコン化したので数は aria-label（いいね N）で確認する。
    const like = await screen.findByLabelText("いいね 3");
    expect(like).toHaveTextContent("3");
    expect(fetchReactionCount).toHaveBeenCalledWith("p1");
  });

  it("0 でも いいね 0 を表示する", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(<PostDetail post={makePost({ id: "p2" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const like = await screen.findByLabelText("いいね 0");
    expect(like).toHaveTextContent("0");
  });

  it("取得前は いいね 取得中（プレースホルダ -）を出す", async () => {
    // 解決しない Promise で「取得中」のまま固定する。
    fetchReactionCount.mockReturnValue(new Promise(() => {}));
    render(<PostDetail post={makePost({ id: "p3" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    await waitFor(() => {
      const like = screen.getByLabelText("いいね 取得中");
      expect(like).toHaveTextContent("-");
    });
  });
});
