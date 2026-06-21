import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// ネットワークはモック境界で止める。子の AccountName/ProfileEditor は本テストの関心外なのでスタブ。
const fetchMyPosts = vi.fn();
const deletePost = vi.fn();
const fetchMyProfileResilient = vi.fn();
const fetchReactionCount = vi.fn();
const getPublicKeyHex = vi.fn();
// 編集モーダル（#300・EditPost）が使う client 関数。MyGrid から EditPost を開く統合テスト用にスタブ。
const editPost = vi.fn();
const fetchReactionCountsBatch = vi.fn((..._a: unknown[]) => Promise.resolve(new Map<string, number>()));
const fetchCommentCountsBatch = vi.fn((..._a: unknown[]) => Promise.resolve(new Map<string, number>()));

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyPosts: (...a: unknown[]) => fetchMyPosts(...a),
  deletePost: (...a: unknown[]) => deletePost(...a),
  fetchMyProfileResilient: (...a: unknown[]) => fetchMyProfileResilient(...a),
  fetchReactionCount: (...a: unknown[]) => fetchReactionCount(...a),
  editPost: (...a: unknown[]) => editPost(...a),
  fetchReactionCountsBatch: (...a: unknown[]) => fetchReactionCountsBatch(...a),
  fetchCommentCountsBatch: (...a: unknown[]) => fetchCommentCountsBatch(...a),
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

describe("MyGrid（あなたの植物・#28/#101）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset().mockResolvedValue([post]);
    deletePost.mockReset().mockResolvedValue({ noteDeleted: true, imageDeleted: true });
    fetchMyProfileResilient.mockReset().mockResolvedValue(null);
    fetchReactionCount.mockReset().mockResolvedValue(0);
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
    fetchMyPosts.mockResolvedValue([]);
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
});
