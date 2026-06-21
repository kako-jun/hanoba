import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// カードのいいね/コメント数（#276）はグリッド単位で **1回ずつ** バッチ取得する（N+1 回避）。
// ここでは呼び出し回数と引数を観測したいので spy にする。返り値 Map は各テストで差し替える。
const fetchReactionCountsBatch = vi.fn();
const fetchCommentCountsBatch = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  // PostGrid → PostDetail（選択時）が呼ぶいいね/コメント取得・プロフィールはこの検証では使わない。
  fetchReactionCount: () => Promise.resolve(0),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
  // 観測対象：グリッドのバッチ取得。
  fetchReactionCountsBatch: (...a: unknown[]) => fetchReactionCountsBatch(...a),
  fetchCommentCountsBatch: (...a: unknown[]) => fetchCommentCountsBatch(...a),
}));

import PostGrid from "./PostGrid.tsx";

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    caption: overrides.caption ?? overrides.id,
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
    shotDates: [],  };
}

describe("PostGrid × カードのいいね/コメント数バッチ取得（#276）", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchReactionCountsBatch.mockReset().mockResolvedValue(new Map());
    fetchCommentCountsBatch.mockReset().mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup();
  });

  it("グリッド描画でバッチ取得を id 列1セットでそれぞれ1回ずつ呼ぶ（カードごとの N+1 にしない）", async () => {
    const posts = [
      makePost({ id: "p1", caption: "p1" }),
      makePost({ id: "p2", caption: "p2" }),
      makePost({ id: "p3", caption: "p3" }),
    ];
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    // 取得は非同期。完了を待ってから回数を確認する。
    await waitFor(() => {
      expect(fetchReactionCountsBatch).toHaveBeenCalledTimes(1);
    });
    expect(fetchCommentCountsBatch).toHaveBeenCalledTimes(1);
    // 3件でも N+1（3回や6回）にならず、id 列をまとめて1回で渡す。
    expect(fetchReactionCountsBatch).toHaveBeenCalledWith(["p1", "p2", "p3"]);
    expect(fetchCommentCountsBatch).toHaveBeenCalledWith(["p1", "p2", "p3"]);
  });

  it("返った Map のいいね>0 のカードに数が出て、Map に無い（=0扱い）カードには出ない", async () => {
    fetchReactionCountsBatch.mockResolvedValue(new Map([["p1", 4]])); // p2 は未掲載＝0扱い
    fetchCommentCountsBatch.mockResolvedValue(new Map([["p2", 7]])); // p1 は未掲載＝0扱い
    const posts = [
      makePost({ id: "p1", caption: "p1" }),
      makePost({ id: "p2", caption: "p2" }),
    ];
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    // p1 はいいね4、p2 はコメント7 がロード後に出る。
    expect(await screen.findByLabelText("いいね 4")).toBeInTheDocument();
    expect(await screen.findByLabelText("コメント 7")).toBeInTheDocument();
    // 逆側（Map に無い）は要素ごと出ない＝カードは0非表示。
    // いいね要素は p1 の1つだけ（p2 はいいねが Map に無い＝0扱いで出ない）。
    expect(screen.getAllByLabelText(/^いいね/)).toHaveLength(1);
    // コメント要素も p2 の1つだけ（p1 はコメントが Map に無い＝0扱いで出ない）。
    expect(screen.getAllByLabelText(/^コメント/)).toHaveLength(1);
  });
});
