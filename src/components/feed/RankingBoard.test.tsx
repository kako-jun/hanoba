import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
// カタログ（variety-catalog）と純ロジック（ranking.ts）は本物を使う＝動的 import は実モジュールに解決される。
const fetchRankingPosts = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchRankingPosts: (...args: unknown[]) => fetchRankingPosts(...args),
}));

import RankingBoard from "./RankingBoard.tsx";

// 距離のある ISO 週（水曜 12:00 UTC）。now は W25 に固定する（Date.now をスタブ）。
const W23 = 1780488000; // 2026-W23
const W24 = 1781092800; // 2026-W24
const W25_NOW_MS = 1781697600 * 1000; // 2026-W25（now）

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1781697600,
    caption: overrides.caption ?? "",
    imageUrls: overrides.imageUrls ?? ["https://image.example/x.jpg"],
    imageUrl: overrides.imageUrl ?? "https://image.example/x.jpg",
    hashtags: overrides.hashtags ?? [],
  };
}

describe("RankingBoard", () => {
  beforeEach(() => {
    fetchRankingPosts.mockReset();
    fetchRankingPosts.mockResolvedValue([]);
    // now を W25 に固定（純ロジックには component が Date.now を渡す）。
    vi.spyOn(Date, "now").mockReturnValue(W25_NOW_MS);
    window.history.replaceState(null, "", "/ranking");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("投稿ゼロのとき、正直な空案内と投稿 CTA を出す（壊れて見せない）", async () => {
    render(<RankingBoard />);
    expect(
      await screen.findByText(/まだランキングを出すほどの投稿が集まっていません/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /投稿する/ })).toHaveAttribute("href", "/compose");
  });

  it("単週のみなら全行 NEW で、先週比は来週からと注記する（偽の矢印を出さない）", async () => {
    fetchRankingPosts.mockResolvedValue([
      makePost({ id: "1", hashtags: ["チタノタ"], createdAt: 1781697600 }),
      makePost({ id: "2", hashtags: ["チタノタ"], createdAt: 1781697600 }),
      makePost({ id: "3", hashtags: ["オベサ"], createdAt: 1781697600 }),
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // 全行 NEW。
    expect(within(list).getAllByText("NEW")).toHaveLength(2);
    // 「先週比は来週から」注記。
    expect(screen.getByText(/先週との比較（↑↓）は来週から表示されます/)).toBeInTheDocument();
    // 1位はチタノタ（2件）。
    expect(items[0]).toHaveAttribute("aria-label", expect.stringContaining("1位 チタノタ"));
  });

  it("先週比で ↑↓ と件数を出す（複数週）", async () => {
    fetchRankingPosts.mockResolvedValue([
      // 先週(W24): チタノタ=2(1位), オベサ=1(2位)
      makePost({ id: "p1", hashtags: ["チタノタ"], createdAt: W24 }),
      makePost({ id: "p2", hashtags: ["チタノタ"], createdAt: W24 }),
      makePost({ id: "p3", hashtags: ["オベサ"], createdAt: W24 }),
      // 今週(W25): オベサ=3(1位↑1), チタノタ=2(2位↓1)
      makePost({ id: "c1", hashtags: ["オベサ"] }),
      makePost({ id: "c2", hashtags: ["オベサ"] }),
      makePost({ id: "c3", hashtags: ["オベサ"] }),
      makePost({ id: "c4", hashtags: ["チタノタ"] }),
      makePost({ id: "c5", hashtags: ["チタノタ"] }),
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("aria-label", "1位 オベサ 3件 1ランクアップ");
    expect(items[1]).toHaveAttribute("aria-label", "2位 チタノタ 2件 1ランクダウン");
    // 単週注記は出ない（複数週ある）。
    expect(screen.queryByText(/先週との比較（↑↓）は来週から表示されます/)).not.toBeInTheDocument();
  });

  it("RE（再登場）を出す: 過去週に居て直前週に居ない品種", async () => {
    fetchRankingPosts.mockResolvedValue([
      makePost({ id: "a", hashtags: ["グラキリス"], createdAt: W23 }), // 過去に登場
      makePost({ id: "b", hashtags: ["チタノタ"], createdAt: W24 }), // 直前週（グラキリスは不在）
      makePost({ id: "c", hashtags: ["グラキリス"] }), // 今週復帰 = RE
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    const grakRow = within(list)
      .getAllByRole("listitem")
      .find((li) => li.getAttribute("aria-label")?.includes("グラキリス"));
    expect(grakRow).toBeDefined();
    expect(within(grakRow!).getByText("RE")).toBeInTheDocument();
  });

  it("学名（SciName）を表示する", async () => {
    fetchRankingPosts.mockResolvedValue([makePost({ id: "1", hashtags: ["チタノタ"] })]);
    render(<RankingBoard />);
    await screen.findByRole("list");
    // SciName はトークンを span で分割描画する（属＋種小名）。属名が出ていれば学名行が描画されている。
    expect(screen.getByText("Agave")).toBeInTheDocument();
  });

  it("取得失敗（reject）でも再読み込み導線を出す（クラッシュしない）", async () => {
    fetchRankingPosts.mockRejectedValue(new Error("relay down"));
    render(<RankingBoard />);
    expect(await screen.findByText(/ランキングを読み込めませんでした/)).toBeInTheDocument();
  });
});
