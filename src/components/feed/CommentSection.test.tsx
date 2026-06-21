import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Comment, CommentOrder } from "../../lib/feed/comments.ts";
import type { Profile } from "../../lib/feed/parse.ts";

// useComments（relay 経由の取得/送信/削除）と useProfiles（kind:0 取得）はモック境界で止める。
// 実ネットワーク・リレーは呼ばない（#142）。
const useCommentsState = {
  comments: null as Comment[] | null,
  loading: true,
  myPubkey: null as string | null,
  order: "old" as CommentOrder,
  setOrder: vi.fn<(o: CommentOrder) => void>(),
  submit: vi.fn<(content: string) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
};

vi.mock("./useComments.ts", () => ({
  useComments: () => useCommentsState,
}));

const profiles = new Map<string, Profile>();
vi.mock("./useProfiles.ts", () => ({
  useProfiles: () => profiles,
}));

import CommentSection from "./CommentSection.tsx";

function comment(overrides: Partial<Comment> & { id: string }): Comment {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    content: overrides.content ?? "いい色ですね",
    createdAt: overrides.createdAt ?? Math.floor(Date.now() / 1000),
  };
}

describe("CommentSection", () => {
  beforeEach(() => {
    useCommentsState.comments = null;
    useCommentsState.loading = true;
    useCommentsState.myPubkey = null;
    useCommentsState.order = "old";
    useCommentsState.setOrder = vi.fn();
    useCommentsState.submit = vi.fn().mockResolvedValue(undefined);
    useCommentsState.remove = vi.fn().mockResolvedValue(undefined);
    profiles.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("読み込み中はプレースホルダを出す", () => {
    useCommentsState.comments = null;
    useCommentsState.loading = true;
    render(<CommentSection postId="p1" />);
    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });

  it("0件のときは空メッセージを出し、件数 0 を表示する・並び替えトグルは出さない（kako-jun）", () => {
    useCommentsState.comments = [];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    expect(screen.getByText("まだコメントはありません")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /コメント 0/ })).toBeInTheDocument();
    // 並べ替える対象が無いので「古い順」トグルは出さない。
    expect(screen.queryByRole("button", { name: /並べ替える/ })).not.toBeInTheDocument();
  });

  it("1件のときも並び替えトグルは出さない（順序が無い）", () => {
    useCommentsState.comments = [comment({ id: "c1" })];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    expect(screen.queryByRole("button", { name: /並べ替える/ })).not.toBeInTheDocument();
  });

  it("コメント一覧と件数を表示する", () => {
    useCommentsState.comments = [
      comment({ id: "c1", content: "ひとつ目" }),
      comment({ id: "c2", content: "ふたつ目" }),
    ];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    expect(screen.getByRole("heading", { name: /コメント 2/ })).toBeInTheDocument();
    expect(screen.getByText("ひとつ目")).toBeInTheDocument();
    expect(screen.getByText("ふたつ目")).toBeInTheDocument();
  });

  it("並び替えトグルで setOrder を呼ぶ（古い順 → 新しい順）", () => {
    // トグルは並べ替える対象（2件以上）があるときだけ出る。
    useCommentsState.comments = [comment({ id: "c1" }), comment({ id: "c2" })];
    useCommentsState.loading = false;
    useCommentsState.order = "old";
    render(<CommentSection postId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "新しい順に並べ替える" }));
    expect(useCommentsState.setOrder).toHaveBeenCalledWith("new");
  });

  it("自分のコメントにだけ削除ボタンを出す", () => {
    const mine = "aa".repeat(32);
    const other = "bb".repeat(32);
    useCommentsState.myPubkey = mine;
    useCommentsState.comments = [
      comment({ id: "mine1", pubkey: mine, content: "自分の" }),
      comment({ id: "other1", pubkey: other, content: "他人の" }),
    ];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    // 自分のコメントは1件＝削除ボタンは1つだけ。
    const delButtons = screen.getAllByRole("button", { name: "このコメントを削除" });
    expect(delButtons).toHaveLength(1);
  });

  it("削除は確認を挟んでから remove を呼ぶ", async () => {
    const mine = "aa".repeat(32);
    useCommentsState.myPubkey = mine;
    useCommentsState.comments = [comment({ id: "mine1", pubkey: mine, content: "自分の" })];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    // 削除を押すと確認が出る（その時点では remove は未呼び出し）。
    fireEvent.click(screen.getByRole("button", { name: "このコメントを削除" }));
    expect(screen.getByText("削除しますか？")).toBeInTheDocument();
    expect(useCommentsState.remove).not.toHaveBeenCalled();
    // 確認の「削除」を押すと remove(id) が走る。
    const confirmDelete = screen.getAllByRole("button", { name: "削除" }).at(-1)!;
    fireEvent.click(confirmDelete);
    await waitFor(() => expect(useCommentsState.remove).toHaveBeenCalledWith("mine1"));
    // 確認 UI が閉じる（後続の state 確定まで待って act 警告を出さない）。
    await waitFor(() => expect(screen.queryByText("削除しますか？")).toBeNull());
  });

  it("入力して送信すると submit を呼び、空入力では送信ボタンが無効", async () => {
    useCommentsState.comments = [];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    const submitBtn = screen.getByRole("button", { name: "コメント" });
    // 空のうちは無効。
    expect(submitBtn).toBeDisabled();
    // 入力すると有効化し、押すと submit が本文付きで呼ばれる。
    fireEvent.change(screen.getByLabelText("コメントを入力"), { target: { value: "きれいですね" } });
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);
    await waitFor(() => expect(useCommentsState.submit).toHaveBeenCalledWith("きれいですね"));
    // 送信成功で下書きがクリアされる（後続の state 確定まで待って act 警告を出さない）。
    await waitFor(() => expect(screen.getByLabelText("コメントを入力")).toHaveValue(""));
  });

  it("プロフィールが無い著者は npub フォールバック名で表示する", () => {
    useCommentsState.comments = [comment({ id: "c1", pubkey: "cc".repeat(32), content: "やあ" })];
    useCommentsState.loading = false;
    render(<CommentSection postId="p1" />);
    // 名前は npub 短縮（npub1…）になる＝profile が無いとき。
    expect(screen.getByText(/^npub1/)).toBeInTheDocument();
  });
});
