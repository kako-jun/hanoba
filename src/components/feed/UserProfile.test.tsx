import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import type { FeedPost, Profile } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める。UserProfile は fetchMyPosts/fetchMyProfileResilient で
// 対象の公開投稿とプロフィールを引く。投稿一覧の PostGrid 依存（いいね/コメント/著者）も空で塞ぐ。
// nip19 は本物（npub → hex の decode 経路をそのまま検証するため）。
const fetchMyPosts = vi.fn();
const fetchMyProfileResilient = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyPosts: (...args: unknown[]) => fetchMyPosts(...args),
  fetchMyProfileResilient: (...args: unknown[]) => fetchMyProfileResilient(...args),
  // PostGrid のカード集計（#276）と著者プロフィール（#35）はこの検証では空 Map。
  fetchReactionCountsBatch: () => Promise.resolve(new Map()),
  fetchCommentCountsBatch: () => Promise.resolve(new Map()),
  fetchProfiles: () => Promise.resolve(new Map()),
  fetchReactionCount: () => Promise.resolve(0),
  fetchReplies: () => Promise.resolve([]),
}));

import UserProfile from "./UserProfile.tsx";

const PUBKEY = "a".repeat(64);
const NPUB = nip19.npubEncode(PUBKEY);

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    pubkey: PUBKEY,
    createdAt: Math.floor(Date.now() / 1000),
    caption: "植物",
    imageUrls: ["https://image.nostr.build/x.jpg"],
    imageUrl: "https://image.nostr.build/x.jpg",
    hashtags: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return { name: null, picture: null, about: null, websites: [], ...overrides };
}

describe("UserProfile（他人の公開プロフィール・#272 段階3）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset();
    fetchMyProfileResilient.mockReset();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/u");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("npub 欠落は invalid（取得に行かず案内を出す）", async () => {
    render(<UserProfile />);
    expect(await screen.findByText(/プロフィールが見つかりませんでした/)).toBeInTheDocument();
    expect(fetchMyPosts).not.toHaveBeenCalled();
  });

  it("npub でない bech32（note）は invalid", async () => {
    const note = nip19.noteEncode("b".repeat(64));
    window.history.replaceState(null, "", "/u?npub=" + note);
    render(<UserProfile />);
    expect(await screen.findByText(/プロフィールが見つかりませんでした/)).toBeInTheDocument();
    expect(fetchMyPosts).not.toHaveBeenCalled();
  });

  it("?npub= を pubkey hex に直して取得し、名前と活動スタッツ（市民/投稿/写真）を出す", async () => {
    fetchMyPosts.mockResolvedValue([
      makePost({ id: "1", imageUrls: ["a.jpg", "b.jpg"] }),
      makePost({ id: "2", imageUrls: ["c.jpg"] }),
    ]);
    fetchMyProfileResilient.mockResolvedValue(makeProfile({ name: "葉子" }));
    window.history.replaceState(null, "", "/u?npub=" + NPUB);
    render(<UserProfile />);

    // npub でなく decode 後の hex で取得する。
    await waitFor(() => expect(fetchMyPosts).toHaveBeenCalledWith(PUBKEY));
    // 見出し（プロフィール名）。
    expect(await screen.findByRole("heading", { level: 1, name: "葉子" })).toBeInTheDocument();
    // 活動スタッツ（名乗り済み＝市民・投稿2件・写真3枚）。
    const section = await screen.findByRole("region", { name: "葉子の活動" });
    expect(within(section).getByText("市民")).toBeInTheDocument();
    expect(within(section).getByText("投稿").parentElement).toHaveTextContent("2件");
    expect(within(section).getByText("写真").parentElement).toHaveTextContent("3枚");
  });

  it("プロフィール名が無い人は npub 短縮を見出しにし、活動は旅人（未名乗り）", async () => {
    fetchMyPosts.mockResolvedValue([makePost({ id: "1" })]);
    fetchMyProfileResilient.mockResolvedValue(null);
    window.history.replaceState(null, "", "/u?npub=" + NPUB);
    render(<UserProfile />);

    await waitFor(() => expect(fetchMyPosts).toHaveBeenCalledWith(PUBKEY));
    const h1 = await screen.findByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/^npub1/);
    // hasName=false → 旅人。
    const section = await screen.findByRole("region", { name: /の活動$/ });
    expect(within(section).getByText("旅人")).toBeInTheDocument();
  });

  it("取得失敗は error 状態（再試行ボタンを出す）", async () => {
    fetchMyPosts.mockRejectedValue(new Error("relay down"));
    fetchMyProfileResilient.mockResolvedValue(null);
    window.history.replaceState(null, "", "/u?npub=" + NPUB);
    render(<UserProfile />);
    expect(await screen.findByRole("button", { name: "再試行" })).toBeInTheDocument();
  });
});
