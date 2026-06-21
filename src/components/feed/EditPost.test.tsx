import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// ネットワーク境界（編集＝publish新規+kind:5削除／いいね・コメント数）をモックする。parsePost は実物を使う。
const editPost = vi.fn();
const fetchReactionCountsBatch = vi.fn();
const fetchCommentCountsBatch = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  editPost: (...a: unknown[]) => editPost(...a),
  fetchReactionCountsBatch: (...a: unknown[]) => fetchReactionCountsBatch(...a),
  fetchCommentCountsBatch: (...a: unknown[]) => fetchCommentCountsBatch(...a),
}));

import EditPost from "./EditPost.tsx";

const post: FeedPost = {
  id: "old-id",
  pubkey: "a".repeat(64),
  createdAt: 1000,
  caption: "うちのアガベ #アガベ",
  imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
  imageUrl: "https://example.com/a.jpg",
  hashtags: ["アガベ"],
  shotDates: ["2024-06-01", "2024-06-02"],
  photoShotDates: ["2024-06-01", "2024-06-02"],};

describe("EditPost（投稿の編集＝確認つき再投稿・#300）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchReactionCountsBatch.mockResolvedValue(new Map([["old-id", 3]]));
    fetchCommentCountsBatch.mockResolvedValue(new Map([["old-id", 2]]));
  });
  afterEach(() => cleanup());

  it("本文を初期表示し、無変更では「更新する」を無効にする", () => {
    render(<EditPost post={post} onClose={() => {}} onEdited={() => {}} />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("うちのアガベ #アガベ");
    expect(screen.getByRole("button", { name: "更新する" })).toBeDisabled();
  });

  it("本文を変えると確認が出て、いいね・コメント数を提示し、確定で editPost を画像 URL 再利用で呼ぶ", async () => {
    const user = userEvent.setup();
    const onEdited = vi.fn();
    const created = {
      id: "new-id",
      pubkey: "a".repeat(64),
      created_at: 2000,
      kind: 1,
      tags: [],
      content: "なおした #アガベ\nhttps://example.com/a.jpg\nhttps://example.com/b.jpg",
      sig: "s",
    };
    editPost.mockResolvedValue(created);

    render(<EditPost post={post} onClose={() => {}} onEdited={onEdited} />);
    // 数の取得を待つ（確認文に出る）。
    await waitFor(() => expect(fetchReactionCountsBatch).toHaveBeenCalled());

    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "なおした #アガベ");

    const update = screen.getByRole("button", { name: "更新する" });
    expect(update).toBeEnabled();
    await user.click(update);

    // 確認段：いいね 3・コメント 2 が引き継がれない旨を出す。
    expect(screen.getByText(/いいね 3・コメント 2/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "編集して再投稿" }));

    await waitFor(() => expect(editPost).toHaveBeenCalledTimes(1));
    expect(editPost).toHaveBeenCalledWith({
      oldEventId: "old-id",
      caption: "なおした #アガベ",
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      photoShotDates: ["2024-06-01", "2024-06-02"], // 撮影日（#324）は写真ごとに編集で引き継ぐ
    });
    // 新しい投稿（parsePost の結果）で差し替えを通知する。caption は画像 URL を除いた本文（#タグは残る）。
    await waitFor(() => expect(onEdited).toHaveBeenCalledTimes(1));
    const passed = onEdited.mock.calls[0]![0] as FeedPost;
    expect(passed.id).toBe("new-id");
    expect(passed.caption).toBe("なおした #アガベ");
    expect(passed.imageUrls).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
  });

  it("「もどる」で確認段から編集段に戻れる（誤操作の取り消し）", async () => {
    const user = userEvent.setup();
    render(<EditPost post={post} onClose={() => {}} onEdited={() => {}} />);
    const textarea = screen.getByRole("textbox");
    await user.clear(textarea);
    await user.type(textarea, "別の本文");
    await user.click(screen.getByRole("button", { name: "更新する" }));
    expect(screen.getByRole("button", { name: "編集して再投稿" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "もどる" }));
    expect(screen.getByRole("button", { name: "更新する" })).toBeInTheDocument();
    expect(editPost).not.toHaveBeenCalled();
  });
});
