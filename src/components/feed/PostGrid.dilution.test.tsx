import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
// PostGrid は useProfiles（fetchProfiles）、PostDetail はいいね/コメント取得を呼ぶ。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchReactionCount: (...a: unknown[]) => fetchReactionCount(...a),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
}));

import PostGrid from "./PostGrid.tsx";
import PostDetail from "./PostDetail.tsx";

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    caption: overrides.caption ?? overrides.id,
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
  };
}

// diluteFeed は id の FNV-1a ハッシュ % level === 0 を残す。
// level=2 では alice の a1/a3/a5 が落ち（hash%2=1）、a2/a4/a6 が残る（hash%2=0）。
// bob は未設定なので b1/b2 は全件残る。これは実装に対し決定的（dilution.ts の hashId）。
const ALICE = "a".repeat(64);
const BOB = "b".repeat(64);

describe("PostGrid × 薄める設定（取得後・表示前の間引き段・#138）", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchReactionCount.mockReset().mockResolvedValue(0);
  });

  afterEach(() => {
    cleanup();
  });

  it("ある著者を 1/2 設定すると その著者の投稿が部分的に消え、未設定の著者は全件残る", async () => {
    // alice を 1/2 に設定（取得前に localStorage へ入れておく＝マウント時に反映される）。
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ [ALICE]: 2 }));
    const posts = [
      makePost({ id: "a1", caption: "a1", pubkey: ALICE }),
      makePost({ id: "a2", caption: "a2", pubkey: ALICE }),
      makePost({ id: "a3", caption: "a3", pubkey: ALICE }),
      makePost({ id: "a4", caption: "a4", pubkey: ALICE }),
      makePost({ id: "a5", caption: "a5", pubkey: ALICE }),
      makePost({ id: "a6", caption: "a6", pubkey: ALICE }),
      makePost({ id: "b1", caption: "b1", pubkey: BOB }),
      makePost({ id: "b2", caption: "b2", pubkey: BOB }),
    ];
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    // alice は 6 件中 3 件（a2/a4/a6）だけ残る＝部分的に消える。
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "a2" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "a4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "a6" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "a1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "a3" })).toBeNull();
    expect(screen.queryByRole("button", { name: "a5" })).toBeNull();
    // bob（未設定）は全件残る。
    expect(screen.getByRole("button", { name: "b1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "b2" })).toBeInTheDocument();
  });

  it("薄めた著者の残った投稿はモーダルを開け、コントロールに現在 level が反映される（selected/profile は間引き前 posts 由来）", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ [ALICE]: 2 }));
    const posts = [
      makePost({ id: "a2", caption: "残ったアリスの投稿", pubkey: ALICE }),
    ];
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    const thumb = await screen.findByRole("button", { name: "残ったアリスの投稿" });
    await user.click(thumb);

    // モーダルが開く（selected を間引き前 posts から id 引きできている）。
    const dialog = await screen.findByRole("dialog", { name: "投稿の詳細" });
    // フィード経由なので薄めるコントロールが出て、現在 level（1/2）が checked。
    expect(within(dialog).getByRole("radio", { name: "1/2" })).toHaveAttribute("aria-checked", "true");
  });

  it("間引きで完全に消えた著者でも、間引き前 posts に居れば selected として開ける（PostGrid は間引き前から id 引き）", async () => {
    // a1 は alice@2 で落ちるが、PostGrid は selected/profiles を間引き前 posts から引く。
    // グリッドからは見えないので、ここでは「PostGrid のロジック上 selected は間引き前由来」を
    // PostDetail を直接描画して間引き対象の投稿でもモーダル内容が描けることで確認する
    // （PostGrid 内のセル経由クリックは不可＝間引きで消えているため・観点10の補完）。
    render(
      <PostDetail
        post={makePost({ id: "a1", caption: "落ちたアリスの投稿", pubkey: ALICE })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
        showDilution
      />,
    );
    expect(await screen.findByRole("dialog", { name: "投稿の詳細" })).toBeInTheDocument();
    expect(screen.getByText("落ちたアリスの投稿")).toBeInTheDocument();
  });

  it("/me 相当（showDilution 既定 false の PostDetail）では薄めるコントロールが出ない＝自分を薄める導線が無い", async () => {
    // MyGrid は PostDetail を showDilution 無し（既定 false）で描く＝自分を薄められない。
    render(
      <PostDetail
        post={makePost({ id: "mine", caption: "自分の投稿", pubkey: ALICE })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByText("フィードで薄める")).toBeNull();
  });
});
