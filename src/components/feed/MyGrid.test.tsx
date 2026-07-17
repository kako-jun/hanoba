import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// ネットワークはモック境界で止める。子の AccountName/ProfileEditor は本テストの関心外なのでスタブ。
const fetchMyPosts = vi.fn();
const deletePost = vi.fn();
const fetchMyProfileResilient = vi.fn();
const fetchReactionState = vi.fn();
const getPublicKeyHex = vi.fn();
// 編集モーダル（#300・EditPost）が使う client 関数。MyGrid から EditPost を開く統合テスト用にスタブ。
const editPost = vi.fn();
const fetchEngagementCountsBatch = vi.fn((..._a: unknown[]) =>
  Promise.resolve({ reactions: new Map<string, number>(), comments: new Map<string, number>() }),
);

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyPosts: (...a: unknown[]) => fetchMyPosts(...a),
  deletePost: (...a: unknown[]) => deletePost(...a),
  fetchMyProfileResilient: (...a: unknown[]) => fetchMyProfileResilient(...a),
  fetchReactionState: (...a: unknown[]) => fetchReactionState(...a),
  editPost: (...a: unknown[]) => editPost(...a),
  fetchEngagementCountsBatch: (...a: unknown[]) => fetchEngagementCountsBatch(...a),
  // コメント欄（#142）は検証対象外なので空（コメント0件）で固定。
  fetchReplies: () => Promise.resolve([]),
}));
vi.mock("../../lib/nostr/keys.ts", () => ({
  getPublicKeyHex: (...a: unknown[]) => getPublicKeyHex(...a),
  // CitizenStats（#272・活動スタッツ）が市民レベル判定に使う。テストでは名乗り済み（市民）固定。
  getDisplayName: () => "テスト栽培家",
}));
vi.mock("../account/AccountName.tsx", () => ({ default: () => <div data-testid="account-name" /> }));
vi.mock("../account/ProfileEditor.tsx", () => ({ default: () => <div data-testid="profile-editor" /> }));

import MyGrid from "./MyGrid.tsx";

const post: FeedPost = {
  id: "id1",
  pubkey: "a".repeat(64),
  createdAt: 1000,
  caption: "うちのアガベ",
  imageUrls: ["https://example.com/a.jpg"],
  imageUrl: "https://example.com/a.jpg",
  hashtags: [],
  shotDates: [],};

// #554: fetchMyPosts は { posts, rawCount } を返す。rawCount 未指定は生バッチ＝posts と同数。
function res(posts: FeedPost[], rawCount = posts.length): { posts: FeedPost[]; rawCount: number } {
  return { posts, rawCount };
}

describe("MyGrid（あなたの植物・#28/#101）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset().mockResolvedValue(res([post]));
    deletePost.mockReset().mockResolvedValue({ noteDeleted: true, imageDeleted: true });
    fetchMyProfileResilient.mockReset().mockResolvedValue(null);
    fetchReactionState.mockReset().mockResolvedValue({ count: 0, myReactionId: undefined });
    getPublicKeyHex.mockReset().mockResolvedValue("a".repeat(64));
  });
  afterEach(() => cleanup());

  it("サムネをクリックすると拡大モーダル（PostDetail）が開く（#101）", async () => {
    const user = userEvent.setup();
    render(<MyGrid />);
    // 投稿読み込み後、サムネ（開くボタン＝caption が aria-label）が出る。
    const thumb = await screen.findByRole("button", { name: "うちのアガベ" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(thumb);
    const dialog = await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(dialog).toBeInTheDocument();
  });

  it("0 件なら『まだ、あなたの植物はありません。』を出す", async () => {
    fetchMyPosts.mockResolvedValue(res([]));
    render(<MyGrid />);
    expect(await screen.findByText(/まだ、あなたの植物はありません。/)).toBeInTheDocument();
  });

  it("編集ボタンで編集モーダル（EditPost）が本文プリフィルで開く（#300）", async () => {
    const user = userEvent.setup();
    render(<MyGrid />);
    const editBtn = await screen.findByRole("button", { name: "この投稿を編集" });
    expect(screen.queryByRole("dialog", { name: "投稿を編集" })).toBeNull();
    await user.click(editBtn);
    const dialog = await screen.findByRole("dialog", { name: "投稿を編集" });
    expect(dialog).toBeInTheDocument();
    // 本文が元投稿でプリフィルされている。
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("うちのアガベ");
  });

  // #554: もっと見る（自分の投稿を過去へ遡って追記）。編集/削除（id ベース）と両立し、
  // CitizenStats は増えた posts 全体を見て自然に更新される。
  describe("もっと見る（#554）", () => {
    function mp(overrides: Partial<FeedPost> & { id: string }): FeedPost {
      return {
        id: overrides.id,
        pubkey: overrides.pubkey ?? "a".repeat(64),
        createdAt: overrides.createdAt ?? 1000,
        caption: overrides.caption ?? "",
        imageUrls: overrides.imageUrls ?? ["https://example.com/" + overrides.id + ".jpg"],
        imageUrl: overrides.imageUrl ?? "https://example.com/" + overrides.id + ".jpg",
        hashtags: overrides.hashtags ?? [],
        shotDates: [],
      };
    }

    it("loadMore で fetchMyPosts が (pubkey, limit, 最古 createdAt) で呼ばれる", async () => {
      const user = userEvent.setup();
      const pk = "a".repeat(64);
      getPublicKeyHex.mockResolvedValue(pk);
      fetchMyPosts
        .mockReset()
        .mockResolvedValueOnce(res([
          mp({ id: "a", caption: "新", createdAt: 2000 }),
          mp({ id: "b", caption: "古", createdAt: 1000 }),
        ]))
        .mockResolvedValueOnce(res([]));
      render(<MyGrid />);
      await screen.findByRole("button", { name: "新" });

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(fetchMyPosts).toHaveBeenLastCalledWith(pk, 100, 1000));
    });

    it("追記後 CitizenStats が増えた posts 全体（投稿数）を反映する", async () => {
      const user = userEvent.setup();
      fetchMyPosts
        .mockReset()
        .mockResolvedValueOnce(res([mp({ id: "a", caption: "新", createdAt: 2000 })]))
        .mockResolvedValueOnce(res([mp({ id: "b", caption: "古", createdAt: 1000 })]));
      render(<MyGrid />);
      await screen.findByRole("button", { name: "新" });

      // 活動スタッツの「投稿」欄が 1。
      const postStat = () => screen.getByText("投稿").parentElement!.querySelector("dd")!.textContent;
      expect(postStat()).toContain("1");

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      // 追記後は 2 件を反映。
      await waitFor(() => expect(postStat()).toContain("2"));
    });

    it("id 重複は prev 優先で畳まれ、既存の状態（caption）が保持される", async () => {
      const user = userEvent.setup();
      fetchMyPosts
        .mockReset()
        .mockResolvedValueOnce(res([mp({ id: "a", caption: "元キャプション", createdAt: 2000 })]))
        // batch に同 id a（中身違い）＋新規 b。prev 側の a が保持され b だけ足される。
        .mockResolvedValueOnce(res([
          mp({ id: "a", caption: "書き換え後", createdAt: 2000 }),
          mp({ id: "b", caption: "新規", createdAt: 1000 }),
        ]));
      render(<MyGrid />);
      await screen.findByRole("button", { name: "元キャプション" });

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await screen.findByRole("button", { name: "新規" });
      // prev 優先＝a は元キャプションのまま（書き換え後は採用されない）。
      expect(screen.getByRole("button", { name: "元キャプション" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "書き換え後" })).toBeNull();
    });

    // #554（軽い保険版）: 打ち止めは生バッチ rawCount===0 のときだけ。
    it("rawCount=0（生バッチ空＝枯渇）でボタンが消える（打ち止め）", async () => {
      const user = userEvent.setup();
      fetchMyPosts
        .mockReset()
        .mockResolvedValueOnce(res([mp({ id: "a", caption: "新", createdAt: 2000 })]))
        .mockResolvedValueOnce(res([], 0)); // 生0件＝枯渇。
      render(<MyGrid />);
      await screen.findByRole("button", { name: "新" });

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull());
    });

    // #554（軽い保険版・S1）: 増分0でも生>0ならボタンを残す（取りこぼし窓で押し直せる）。
    it("増分0だが rawCount>0（取りこぼし窓）でボタンが残る", async () => {
      const user = userEvent.setup();
      fetchMyPosts
        .mockReset()
        .mockResolvedValueOnce(res([mp({ id: "a", caption: "新", createdAt: 2000 })]))
        // 既存 id "a" だけ返す＝merge 増分0。だが生バッチは2件返っている（rawCount=2）。
        .mockResolvedValueOnce(res([mp({ id: "a", caption: "新", createdAt: 2000 })], 2));
      render(<MyGrid />);
      await screen.findByRole("button", { name: "新" });

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(fetchMyPosts).toHaveBeenCalledTimes(2));
      expect(screen.getByRole("button", { name: "もっと見る" })).toBeInTheDocument();
    });
  });
});
