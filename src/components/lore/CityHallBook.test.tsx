import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { TENURE_DAYS, TENURE_POSTS } from "../../lib/lore/citizen.ts";

// ネットワーク・鍵はモック境界で止める（実 relay・localStorage を呼ばない）。
const fetchMyPosts = vi.fn();
const getDisplayName = vi.fn();
const getPublicKeyHex = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyPosts: (...a: unknown[]) => fetchMyPosts(...a),
}));
vi.mock("../../lib/nostr/keys.ts", () => ({
  getDisplayName: (...a: unknown[]) => getDisplayName(...a),
  getPublicKeyHex: (...a: unknown[]) => getPublicKeyHex(...a),
}));

import CityHallBook from "./CityHallBook.tsx";

const NOW_MS = 1781913600 * 1000;
const DAY = 86400;

function makePost(createdAt: number, id: string): FeedPost {
  return {
    id,
    pubkey: "a".repeat(64),
    createdAt,
    caption: "",
    imageUrls: ["https://x/y.jpg"],
    imageUrl: "https://x/y.jpg",
    hashtags: [],
  };
}

/** L2（古参）相当の投稿: 5 件・最古は 20 日前。 */
function tenuredPosts(): FeedPost[] {
  const now = Math.floor(NOW_MS / 1000);
  return Array.from({ length: TENURE_POSTS }, (_, i) =>
    makePost(now - (TENURE_DAYS + 6) * DAY + i * DAY, `p${i}`),
  );
}

describe("CityHallBook（ハノーバ市民手帳・#163）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset().mockResolvedValue([]);
    getDisplayName.mockReset().mockReturnValue(null);
    getPublicKeyHex.mockReset().mockResolvedValue("a".repeat(64));
    vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("常に手帳のタイトルを出す", async () => {
    render(<CityHallBook />);
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳" })).toBeInTheDocument();
  });

  it("L0 訪問者（名前なし）: 1p 移住案内のみ・次はティザー止まり", async () => {
    getDisplayName.mockReturnValue(null);
    render(<CityHallBook />);

    // 移住案内の歓迎の辞が出る。
    expect(await screen.findByText(/ハノーバ市長、ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
    // 実務注（site の一言説明）も出る。
    expect(screen.getByText(/植物専用の写真SNSです/)).toBeInTheDocument();
    // 前は不可、次（ティザー）へは進める。
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
  });

  it("L0: 次を押すと？？？ティザー、その先へは進めない", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue(null);
    render(<CityHallBook />);
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);

    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    // ティザーの先（市役所中身）には行けない。
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    // 後方には戻れる。
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
  });

  it("L1 市民（名前あり・投稿少）: 既定で 2p 市役所ハブを開く", async () => {
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);

    // 既定ページ＝市役所ハブ。
    expect(await screen.findByText(/ここは市役所だ/)).toBeInTheDocument();
    // 実在ルートはリンクとして機能する。
    const ranking = screen.getByRole("link", { name: /品種ランキング/ });
    expect(ranking).toHaveAttribute("href", "/ranking");
    expect(screen.getByRole("link", { name: /あなたの植物/ })).toHaveAttribute("href", "/me");
    expect(screen.getByRole("link", { name: /投稿する/ })).toHaveAttribute("href", "/compose");
    expect(screen.getByRole("link", { name: /みんなの植物/ })).toHaveAttribute("href", "/discover");
    // 未開設は「近日開庁」でリンクにならない。
    expect(screen.queryByRole("link", { name: /住民投票/ })).toBeNull();
    expect(screen.getAllByText("近日開庁").length).toBeGreaterThanOrEqual(4);
    // 昇格の味付け。
    expect(screen.getByText(/移住、確かに受理した/)).toBeInTheDocument();
  });

  it("L1: 沿革（3p）はロックされ、次を押すとティザー", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);
    await screen.findByText(/ここは市役所だ/);

    // 2p から次 → 3p はティザー。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("L2 古参（名前＋5投稿＋14日以上）: 沿革・条文まで開ける", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("ふるつわもの");
    fetchMyPosts.mockResolvedValue(tenuredPosts());
    render(<CityHallBook />);

    // 既定は 2p（奥は自動で開かない）。
    await screen.findByText(/ここは市役所だ/);
    // 3p 沿革へ。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/荒れ地に最初の一鉢を植える/)).toBeInTheDocument();
    expect(screen.getByText(/諸君はもう、市の古い友人だ/)).toBeInTheDocument();
    // 4p 条文へ。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/第一条（土地）/)).toBeInTheDocument();
    expect(screen.getByText(/育てる意志こそが地代だ/)).toBeInTheDocument();
    // 4p が最後（次は無い）。
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("名前ありで投稿取得が失敗しても L1（締め出さない・resilient）", async () => {
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockRejectedValue(new Error("relay down"));
    render(<CityHallBook />);

    // 取得失敗でも市役所ハブ（2p）まで開く。
    expect(await screen.findByText(/ここは市役所だ/)).toBeInTheDocument();
  });

  it("後方オープン: 2p から前へ戻ると 1p 移住案内に行ける", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/ここは市役所だ/);

    await user.click(screen.getByRole("button", { name: "前のページ" }));
    expect(await screen.findByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
  });
});
