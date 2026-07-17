import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// カードの花/コメント数（#276 / #462）はグリッド単位で **1回** 統合バッチ取得する（N+1 回避・購読 4→3）。
// 花リアクション（kind:7）とコメント（kind:1）は1クエリで取り、返り値 { reactions, comments, myReactionIds } に分かれる。
// ここでは呼び出し回数と引数を観測したいので spy にする。返り値は各テストで差し替える。
const fetchEngagementCountsBatch = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  // PostGrid → PostDetail（選択時）が呼ぶ花/コメント取得・プロフィールはこの検証では使わない。
  // #537: fetchReactionCount → fetchReactionState（件数＋自分の反応）。
  fetchReactionState: () => Promise.resolve({ count: 0, myReactionId: undefined }),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
  // 観測対象：グリッドの統合バッチ取得。
  fetchEngagementCountsBatch: (...a: unknown[]) => fetchEngagementCountsBatch(...a),
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

describe("PostGrid × カードの花/コメント数バッチ取得（#276）", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchEngagementCountsBatch.mockReset().mockResolvedValue({ reactions: new Map(), comments: new Map(), myReactionIds: new Map() });
  });

  afterEach(() => {
    cleanup();
  });

  it("グリッド描画で統合バッチ取得を id 列1セットで1回だけ呼ぶ（カードごとの N+1 にしない・購読 4→3）", async () => {
    const posts = [
      makePost({ id: "p1", caption: "p1" }),
      makePost({ id: "p2", caption: "p2" }),
      makePost({ id: "p3", caption: "p3" }),
    ];
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    // 取得は非同期。完了を待ってから回数を確認する。
    await waitFor(() => {
      expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(1);
    });
    // 3件でも N+1（3回や6回）にならず、花・コメントを 1 クエリで id 列をまとめて1回で渡す。
    expect(fetchEngagementCountsBatch).toHaveBeenCalledWith(["p1", "p2", "p3"]);
  });

  it("「もっと見る」で ids が伸びた時は増分（新規 id だけ）を引く＝全件再取得しない（#554 delta）", async () => {
    const initial = [makePost({ id: "p1" }), makePost({ id: "p2" })];
    const { rerender } = render(<PostGrid posts={initial} onSelectHashtag={() => {}} />);
    await waitFor(() => expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(1));
    expect(fetchEngagementCountsBatch).toHaveBeenLastCalledWith(["p1", "p2"]);

    // loadMore で p3/p4 が末尾に追記された（既存 id は据え置き＝追記のみ＝superset）。
    rerender(
      <PostGrid posts={[...initial, makePost({ id: "p3" }), makePost({ id: "p4" })]} onSelectHashtag={() => {}} />,
    );
    // 2回目は**新規分だけ**（全4件でなく）を引く。
    await waitFor(() => expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(2));
    expect(fetchEngagementCountsBatch).toHaveBeenLastCalledWith(["p3", "p4"]);
  });

  it("追記のみで新規 id が無い再レンダーでは fetch しない（同じ集合は取り直さない）", async () => {
    const posts = [makePost({ id: "p1" }), makePost({ id: "p2" })];
    const { rerender } = render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);
    await waitFor(() => expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(1));

    // 同一 id 集合（順序も同じ）＝ idsKey 不変で useEffect は再実行されない。
    rerender(<PostGrid posts={[makePost({ id: "p1" }), makePost({ id: "p2" })]} onSelectHashtag={() => {}} />);
    // 追加の呼び出しは起きない。
    await waitFor(() => expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(1));
  });

  it("id 集合が入れ替わる（filter 変更等・superset でない）時はリセットして全件引き直す（#554 reset）", async () => {
    const initial = [makePost({ id: "p1" }), makePost({ id: "p2" }), makePost({ id: "p3" })];
    const { rerender } = render(<PostGrid posts={initial} onSelectHashtag={() => {}} />);
    await waitFor(() => expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(1));
    expect(fetchEngagementCountsBatch).toHaveBeenLastCalledWith(["p1", "p2", "p3"]);

    // discover の filter 変更で総入れ替え（旧処理済みを包含しない＝superset でない）。
    rerender(<PostGrid posts={[makePost({ id: "q1" }), makePost({ id: "q2" })]} onSelectHashtag={() => {}} />);
    // 増分でなく新集合の全件を引き直す。
    await waitFor(() => expect(fetchEngagementCountsBatch).toHaveBeenCalledTimes(2));
    expect(fetchEngagementCountsBatch).toHaveBeenLastCalledWith(["q1", "q2"]);
  });

  it("返った Map の花>0 のカードに数が出て、Map に無い（=0扱い）カードには出ない", async () => {
    // 統合バッチは { reactions, comments } を返す。flowers は p1 のみ・comments は p2 のみ（他は 0 扱い）。
    fetchEngagementCountsBatch.mockResolvedValue({
      reactions: new Map([["p1", 4]]), // p2 は未掲載＝0扱い
      comments: new Map([["p2", 7]]), // p1 は未掲載＝0扱い
      myReactionIds: new Map(),
    });
    const posts = [
      makePost({ id: "p1", caption: "p1" }),
      makePost({ id: "p2", caption: "p2" }),
    ];
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    // p1 は花4、p2 はコメント7 がロード後に出る。
    expect(await screen.findByLabelText("花 4")).toBeInTheDocument();
    expect(await screen.findByLabelText("コメント 7")).toBeInTheDocument();
    // 逆側（Map に無い）は要素ごと出ない＝カードは0非表示。
    // 花要素は p1 の1つだけ（p2 は花が Map に無い＝0扱いで出ない）。
    expect(screen.getAllByLabelText(/^花/)).toHaveLength(1);
    // コメント要素も p2 の1つだけ（p1 はコメントが Map に無い＝0扱いで出ない）。
    expect(screen.getAllByLabelText(/^コメント/)).toHaveLength(1);
  });

  it("自分の花があるカードはリロード直後の CTA も「花を添えた」表示になる", async () => {
    fetchEngagementCountsBatch.mockResolvedValue({
      reactions: new Map([["p1", 1]]),
      comments: new Map(),
      myReactionIds: new Map([["p1", "my-reaction"]]),
    });
    render(<PostGrid posts={[makePost({ id: "p1", caption: "短い本文" })]} onSelectHashtag={() => {}} />);

    expect(await screen.findByRole("button", { name: "花を添えた" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "花を添える" })).not.toBeInTheDocument();
  });
});
