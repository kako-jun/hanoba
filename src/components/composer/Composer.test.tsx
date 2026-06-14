import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const fetchProfileName = vi.fn();
vi.mock("../../lib/nostr/client.ts", () => ({
  signAndPublishNote: (...args: unknown[]) => signAndPublishNote(...args),
  fetchKnownHashtags: (...args: unknown[]) => fetchKnownHashtags(...args),
  fetchPopularHashtags: (...args: unknown[]) => fetchPopularHashtags(...args),
  saveDisplayName: (...args: unknown[]) => saveDisplayName(...args),
  fetchProfileName: (...args: unknown[]) => fetchProfileName(...args),
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
    fetchProfileName.mockReset().mockResolvedValue(null);
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
    // 撮影とアルバムは別ボタン（#29: 単一 input + capture のカメラ直起動を回避）。
    expect(screen.getByRole("button", { name: /撮影/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /アルバム/ })).toBeInTheDocument();
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
    // なぜ押せないかをボタン近くに明示する（文言は span 分割なので末尾ノードで確認）。
    expect(screen.getByText(/を入れると投稿できます/)).toBeInTheDocument();

    // 一言を入力 → enabled、不足理由は消える。
    await user.type(screen.getByLabelText("ひとこと・必須"), "開花した");
    expect(submit).toBeEnabled();
    expect(screen.queryByText(/を入れると投稿できます/)).not.toBeInTheDocument();
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

  it("投稿成功で公開し、自分の植物（/me）へ遷移する（#32）", async () => {
    const user = userEvent.setup();
    // 遷移先を捕まえるため window.location を差し替える（このテスト内のみ・finally で復元）。
    const orig = Object.getOwnPropertyDescriptor(window, "location");
    const stub = { href: "" } as Location;
    Object.defineProperty(window, "location", { configurable: true, value: stub });
    try {
      render(<Composer />);
      // 画像選択 → クロップ画像の load で初期正方形クロップが親に確定する。
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(input, makeImageFile());
      const img = document.querySelector("img");
      expect(img).not.toBeNull();
      fireEvent.load(img!);
      // 一言を入れて投稿。
      await user.type(screen.getByLabelText("ひとこと・必須"), "開花した");
      await user.click(await screen.findByRole("button", { name: /投稿する/ }));

      await waitFor(() => expect(signAndPublishNote).toHaveBeenCalled());
      expect(uploadImage).toHaveBeenCalled();
      // 成功メッセージ＋ /me へ遷移。
      expect(await screen.findByText(/自分の植物へ移動します/)).toBeInTheDocument();
      expect(stub.href).toBe("/me");
    } finally {
      if (orig) Object.defineProperty(window, "location", orig);
    }
  });
});
