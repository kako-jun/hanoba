import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ネットワーク・canvas 焼き込みはモック境界で止める（実ネットワーク・実 canvas を呼ばない）。
const uploadImage = vi.fn();
const deleteImage = vi.fn();
const signAndPublishNote = vi.fn();
const fetchKnownHashtags = vi.fn();
const renderSquareImageFromRect = vi.fn();

vi.mock("../../lib/nostr/upload.ts", () => ({
  uploadImage: (...args: unknown[]) => uploadImage(...args),
  deleteImage: (...args: unknown[]) => deleteImage(...args),
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
  computeSquareCropRect: () => ({ sx: 0, sy: 0, size: 100 }),
  renderSquareImageFromRect: (...args: unknown[]) => renderSquareImageFromRect(...args),
}));

import Composer from "./Composer.tsx";

function makeImageFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "plant.jpg", { type: "image/jpeg" });
}

function makeNamedImageFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

function makeVideoFile(): File {
  return new File([new Uint8Array([1, 2, 3])], "clip.mp4", { type: "video/mp4" });
}

describe("Composer", () => {
  beforeEach(() => {
    uploadImage.mockReset().mockResolvedValue({ url: "https://image.nostr.build/abc.jpg" });
    deleteImage.mockReset().mockResolvedValue(true);
    signAndPublishNote.mockReset().mockResolvedValue({ id: "evt1" });
    fetchKnownHashtags.mockReset().mockResolvedValue([]);
    fetchPopularHashtags.mockReset().mockResolvedValue([]);
    fetchProfileName.mockReset().mockResolvedValue(null);
    saveDisplayName.mockReset().mockResolvedValue(undefined);
    renderSquareImageFromRect.mockReset().mockResolvedValue(new Blob([new Uint8Array([9])], { type: "image/jpeg" }));
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        naturalWidth = 100;
        naturalHeight = 100;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    // ユーザー名は設定済みにして名前ゲートを隠す（#28・各テストは投稿条件に集中）。
    localStorage.setItem("hanoba:name", "テスト栽培家");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
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
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    // 画像ありでも一言が空 → disabled（両条件のうち一言条件）。
    const submit = await screen.findByRole("button", { name: /投稿する/ });
    expect(submit).toBeDisabled();
    // なぜ押せないかをボタン近くに明示する（文言は span 分割なので末尾ノードで確認）。
    expect(screen.getByText(/を入れると投稿できます/)).toBeInTheDocument();

    // 一言を入力 → enabled、不足理由は消える。
    await user.type(screen.getByLabelText("ひとこと"), "開花した");
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
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
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
      const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
      await user.upload(input, makeImageFile());
      fireEvent.load(await screen.findByAltText("クロップ対象の写真"));
      // 一言を入れて投稿。
      await user.type(screen.getByLabelText("ひとこと"), "開花した");
      await user.click(await screen.findByRole("button", { name: /投稿する/ }));

      await waitFor(() => expect(signAndPublishNote).toHaveBeenCalled());
      expect(uploadImage).toHaveBeenCalled();
      // 成功メッセージ＋ /me へ遷移。
      expect(await screen.findByText(/あなたの植物へ移動します/)).toBeInTheDocument();
      expect(stub.href).toBe("/me");
    } finally {
      if (orig) Object.defineProperty(window, "location", orig);
    }
  });

  it("複数写真を選び、各写真を焼き込んで複数 URL で投稿する", async () => {
    const user = userEvent.setup();
    uploadImage
      .mockReset()
      .mockResolvedValueOnce({ url: "https://image.nostr.build/one.jpg" })
      .mockResolvedValueOnce({ url: "https://image.nostr.build/two.jpg" });
    render(<Composer />);

    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const secondThumb = screen.getByAltText("2枚目").closest("button");
    expect(secondThumb).not.toBeNull();
    await user.click(secondThumb!);
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    await user.type(screen.getByLabelText("ひとこと"), "成長記録");
    await user.click(await screen.findByRole("button", { name: /投稿する/ }));

    await waitFor(() => expect(signAndPublishNote).toHaveBeenCalled());
    expect(renderSquareImageFromRect).toHaveBeenCalledTimes(2);
    expect(uploadImage).toHaveBeenCalledTimes(2);
    expect(signAndPublishNote).toHaveBeenCalledWith({
      caption: "成長記録",
      imageUrls: ["https://image.nostr.build/one.jpg", "https://image.nostr.build/two.jpg"],
    });
  });

  it("5枚選んでも4枚までに切り詰める", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [
      makeNamedImageFile("1.jpg"),
      makeNamedImageFile("2.jpg"),
      makeNamedImageFile("3.jpg"),
      makeNamedImageFile("4.jpg"),
      makeNamedImageFile("5.jpg"),
    ]);

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "4/4枚")).toBeInTheDocument());
    expect(screen.getByText("写真は4枚までです。追加できる分だけ追加しました。")).toBeInTheDocument();
    expect(screen.getAllByAltText(/枚目$/)).toHaveLength(4);
  });

  it("複数写真から1枚外すと残数が戻る", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "この写真を外す" }));
    expect(screen.getByText((_, el) => el?.textContent === "1/4枚")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "写真を選び直す" })).toBeInTheDocument();
  });

  it("写真を追加したら追加した写真を自動選択する", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, makeNamedImageFile("one.jpg"));

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "1/4枚")).toBeInTheDocument());
    const add = screen.getByRole("button", { name: "写真を追加" });
    await user.click(add);
    const nextInput = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(nextInput, makeNamedImageFile("two.jpg"));

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());
    expect(screen.getByAltText("2枚目").closest("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("4枚すべてを焼き込んで投稿する", async () => {
    const user = userEvent.setup();
    uploadImage
      .mockReset()
      .mockResolvedValueOnce({ url: "https://image.nostr.build/1.jpg" })
      .mockResolvedValueOnce({ url: "https://image.nostr.build/2.jpg" })
      .mockResolvedValueOnce({ url: "https://image.nostr.build/3.jpg" })
      .mockResolvedValueOnce({ url: "https://image.nostr.build/4.jpg" });
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [
      makeNamedImageFile("1.jpg"),
      makeNamedImageFile("2.jpg"),
      makeNamedImageFile("3.jpg"),
      makeNamedImageFile("4.jpg"),
    ]);

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "4/4枚")).toBeInTheDocument());
    await user.type(screen.getByLabelText("ひとこと"), "四枚記録");
    await waitFor(() => expect(screen.getByRole("button", { name: /投稿する/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /投稿する/ }));

    await waitFor(() => expect(signAndPublishNote).toHaveBeenCalled());
    expect(renderSquareImageFromRect).toHaveBeenCalledTimes(4);
    expect(uploadImage).toHaveBeenCalledTimes(4);
    expect(signAndPublishNote).toHaveBeenCalledWith({
      caption: "四枚記録",
      imageUrls: [
        "https://image.nostr.build/1.jpg",
        "https://image.nostr.build/2.jpg",
        "https://image.nostr.build/3.jpg",
        "https://image.nostr.build/4.jpg",
      ],
    });
  });

  it("複数写真の投稿途中で失敗したらアップロード済み画像を削除する", async () => {
    const user = userEvent.setup();
    uploadImage
      .mockReset()
      .mockResolvedValueOnce({ url: "https://image.nostr.build/one.jpg" })
      .mockRejectedValueOnce(new Error("upload failed"));
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());
    await user.type(screen.getByLabelText("ひとこと"), "失敗時 cleanup");
    await waitFor(() => expect(screen.getByRole("button", { name: /投稿する/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /投稿する/ }));

    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith("https://image.nostr.build/one.jpg"));
    expect(signAndPublishNote).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("upload failed");
  });

  it("散文を打ってからタグチップを選ぶと一言が prose\\n#tag 形になる（#165）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    // CaptionInput/TagPicker は画像選択後に出る。
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const caption = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;
    await user.type(caption, "開花した");

    // クイックタグ #水やり を選ぶ（TagPicker→insertTag 経由で本文へ）。
    await user.click(screen.getByRole("button", { name: "#水やり" }));

    // 散文とタグは改行で分かれ、タグ行が下にできる。
    expect(caption.value).toBe("開花した\n#水やり ");
  });

  it("タグチップを2つ続けて選ぶと同じタグ行にスペース区切りで積む（#165）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const caption = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;
    await user.type(caption, "成長記録");
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    await user.click(screen.getByRole("button", { name: "#開花" }));

    expect(caption.value).toBe("成長記録\n#水やり #開花 ");
  });

  it("選択済みチップを外すと空タグ行のぶら下がり改行を畳む（#165）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const caption = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;
    await user.type(caption, "開花した");
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(caption.value).toBe("開花した\n#水やり ");

    // 選択済み（aria-pressed=true）になったチップを再タップ＝removeTag で外す。
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(caption.value).toBe("開花した ");
  });

  it("ひとこと入力欄は大きなハンドルで高さを変えられる", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    const caption = await screen.findByLabelText("ひとこと");
    const handle = screen.getByRole("separator", { name: "入力欄の高さを調整" });

    expect(caption).toHaveStyle({ height: "124px" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(caption).toHaveStyle({ height: "140px" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(caption).toHaveStyle({ height: "124px" });
  });
});
