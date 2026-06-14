import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ネットワーク・canvas 焼き込みはモック境界で止める（実ネットワーク・実 canvas を呼ばない）。
const uploadImage = vi.fn();
const signAndPublishNote = vi.fn();
const fetchKnownHashtags = vi.fn();
const renderSquareImage = vi.fn();

vi.mock("../../lib/nostr/upload.ts", () => ({
  uploadImage: (...args: unknown[]) => uploadImage(...args),
}));
const saveDisplayName = vi.fn();
const fetchPopularHashtags = vi.fn();
vi.mock("../../lib/nostr/client.ts", () => ({
  signAndPublishNote: (...args: unknown[]) => signAndPublishNote(...args),
  fetchKnownHashtags: (...args: unknown[]) => fetchKnownHashtags(...args),
  fetchPopularHashtags: (...args: unknown[]) => fetchPopularHashtags(...args),
  saveDisplayName: (...args: unknown[]) => saveDisplayName(...args),
}));
vi.mock("../../lib/image/crop.ts", () => ({
  renderSquareImage: (...args: unknown[]) => renderSquareImage(...args),
}));

import Composer from "./Composer.tsx";

function makeImageFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "plant.jpg", { type: "image/jpeg" });
}

function makeVideoFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });
}

describe("Composer", () => {
  beforeEach(() => {
    uploadImage.mockReset().mockResolvedValue({ url: "https://image.nostr.build/abc.jpg" });
    signAndPublishNote.mockReset().mockResolvedValue({ id: "evt1" });
    fetchKnownHashtags.mockReset().mockResolvedValue([]);
    fetchPopularHashtags.mockReset().mockResolvedValue([]);
    saveDisplayName.mockReset().mockResolvedValue(undefined);
    renderSquareImage.mockReset().mockResolvedValue(new Blob([new Uint8Array([9])], { type: "image/jpeg" }));
    // ユーザー名は設定済みにして名前ゲートを隠す（#28・各テストは投稿条件に集中）。
    localStorage.setItem("hanoba:name", "テスト栽培家");
  });

  afterEach(() => {
    cleanup();
  });

  it("画像未選択ではピッカーを表示し、送信ボタンは無い", async () => {
    render(<Composer />);
    expect(screen.getByText("写真を選ぶ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /投稿する/ })).not.toBeInTheDocument();
    // マウント時の fetchKnownHashtags 解決による state 更新を待つ（act 警告回避）。
    await waitFor(() => expect(fetchKnownHashtags).toHaveBeenCalled());
  });

  it("画像があっても一言が空なら送信ボタンは disabled、一言を入れると enabled になる", async () => {
    const user = userEvent.setup();
    render(<Composer />);

    // 画像を選ぶ（ImagePicker の input は sr-only だが upload で対象にできる）。
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeImageFile());

    // 画像ありでも一言が空 → disabled（両条件のうち一言条件）。
    const submit = await screen.findByRole("button", { name: /投稿する/ });
    expect(submit).toBeDisabled();

    // 一言を入力 → enabled。
    await user.type(screen.getByLabelText("ひとこと・必須"), "開花した");
    expect(submit).toBeEnabled();
  });

  it("一言だけで画像が無ければ送信できない（画像条件）", async () => {
    render(<Composer />);
    // 画像未選択なので送信ボタン自体が存在しない＝画像なしでは投稿不能。
    expect(screen.queryByRole("button", { name: /投稿する/ })).not.toBeInTheDocument();
    await waitFor(() => expect(fetchKnownHashtags).toHaveBeenCalled());
  });

  it("動画ファイルは拒否し、エラーを表示してピッカーのまま", async () => {
    // accept="image/*" の filter を外して、ハンドラ側の type ガードを検証する
    // （実ブラウザでも accept は soft filter なので、最終防御は type.startsWith）。
    const user = userEvent.setup({ applyAccept: false });
    render(<Composer />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, makeVideoFile());

    expect(screen.getByText(/動画は投稿できません/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /投稿する/ })).not.toBeInTheDocument();
  });

  it("マウント時に過去タグを取得する", async () => {
    render(<Composer />);
    await waitFor(() => expect(fetchKnownHashtags).toHaveBeenCalled());
  });
});
