import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("本文 <p> から #タグ を除き、タグはチップにだけ出す（二重表示解消・#43）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const { container } = render(
      <PostDetail
        post={makePost({ id: "t1", caption: "きれいに咲いた #アガベ", hashtags: ["アガベ"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const body = container.querySelector("p.whitespace-pre-wrap");
    expect(body?.textContent).toBe("きれいに咲いた");
    expect(body?.textContent).not.toContain("#");
    // タグは下のチップ（ボタン）にだけ出る。
    expect(screen.getByRole("button", { name: "#アガベ" })).toBeInTheDocument();
  });

  it("タグだけの投稿は本文 <p> を出さない（空段落の余白を作らない・#43）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const { container } = render(
      <PostDetail
        post={makePost({ id: "t2", caption: "#アガベ #多肉", hashtags: ["アガベ", "多肉"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    expect(container.querySelector("p.whitespace-pre-wrap")).toBeNull();
    expect(screen.getByRole("button", { name: "#アガベ" })).toBeInTheDocument();
  });

  it("X でシェア（短文）= 1クリックで X intent を開く・採番なし（#37）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <PostDetail
        // permalink（njump nevent）は 64hex の id を要求するため有効な id を使う。
        post={makePost({ id: "e".repeat(64), caption: "開花した #アガベ", hashtags: ["アガベ"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const shareBtn = screen.getByRole("button", { name: "X でシェア" });
    // 短文はメニューを開かず直接 intent（aria-haspopup なし）。
    expect(shareBtn).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(shareBtn);
    expect(open).toHaveBeenCalledTimes(1);
    const url = open.mock.calls[0]![0] as string;
    expect(url.startsWith("https://twitter.com/intent/tweet?text=")).toBe(true);
    const text = decodeURIComponent(url.replace("https://twitter.com/intent/tweet?text=", ""));
    // 生 caption（インライン #タグ込み）を共有し、採番は付かない。njump パーマリンクが末尾に付く。
    expect(text).toContain("開花した #アガベ");
    expect(text).not.toMatch(/\(\d+\/\d+\)/);
    expect(text).toContain("https://njump.me/");
    open.mockRestore();
  });

  it("X でシェア（長文）= メニューで全文／各パートを開ける（#37）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <PostDetail
        post={makePost({ id: "f".repeat(64), caption: "あ".repeat(400) })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const shareBtn = screen.getByRole("button", { name: "X でシェア" });
    // 長文はメニュー（aria-haspopup="menu"）。
    expect(shareBtn).toHaveAttribute("aria-haspopup", "menu");
    fireEvent.click(shareBtn);
    // 「全文」と 各パート（1/n…）が menuitem として並ぶ。
    expect(screen.getByRole("menuitem", { name: "全文" })).toBeInTheDocument();
    const part1 = screen.getByRole("menuitem", { name: /^1\/\d+$/ });
    fireEvent.click(part1);
    expect(open).toHaveBeenCalledTimes(1);
    // パートを開いたらメニューは閉じる。
    expect(screen.queryByRole("menu")).toBeNull();
    open.mockRestore();
  });

  it("本文から植物を認識し 学名＋著名表記を並べ discover 検索へリンクする（#23）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "p4", caption: "うちのパキポ、いい形" })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 学名（フォーマル）と著名表記を両方表示。
    expect(await screen.findByText("Pachypodium")).toBeInTheDocument();
    expect(screen.getByText("パキポディウム")).toBeInTheDocument();
    // クリックでその植物の discover 検索へ。
    const link = screen.getByRole("link", { name: /Pachypodium/ });
    // タグ集約モードで検索するため #（=%23）付きで discover へ。
    expect(link).toHaveAttribute(
      "href",
      "/discover?q=%23%E3%83%91%E3%82%AD%E3%83%9D%E3%83%87%E3%82%A3%E3%82%A6%E3%83%A0",
    );
  });
});
