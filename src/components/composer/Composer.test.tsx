import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ネットワーク・canvas 焼き込みはモック境界で止める（実ネットワーク・実 canvas を呼ばない）。
const uploadImage = vi.fn();
const deleteImage = vi.fn();
const signAndPublishNote = vi.fn();
const confirmEventStored = vi.fn();
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
  confirmEventStored: (...args: unknown[]) => confirmEventStored(...args),
  fetchKnownHashtags: (...args: unknown[]) => fetchKnownHashtags(...args),
  fetchPopularHashtags: (...args: unknown[]) => fetchPopularHashtags(...args),
  saveDisplayName: (...args: unknown[]) => saveDisplayName(...args),
  fetchProfileName: (...args: unknown[]) => fetchProfileName(...args),
}));
vi.mock("../../lib/image/crop.ts", () => ({
  computeSquareCropRect: () => ({ sx: 0, sy: 0, size: 100 }),
  renderSquareImageFromRect: (...args: unknown[]) => renderSquareImageFromRect(...args),
  // 回転（#314）: 焼き込みの素材生成は canvas なのでスタブ、UI が使う純関数は本物相当を返す。
  renderInPlaceRotation: () => document.createElement("canvas"),
  rotationFine: (deg: number) => deg - Math.round(deg / 90) * 90,
  MAX_FINE_ROTATION: 15,
}));

// 下書きの永続化境界（#228）をスパイ化する。IndexedDB 実体には触れず、配線（呼び出し有無・引数・
// hydration ガード・デバウンス）だけを検証する。loadDraft の既定は「下書き無し（null）」で、
// 既存テスト（実 draft.ts も happy-dom では null を返す）と同じ振る舞いに揃える。
const loadDraft = vi.fn();
const syncBlobs = vi.fn();
const saveMeta = vi.fn();
const clearDraft = vi.fn();
vi.mock("../../lib/composer/draft.ts", () => ({
  loadDraft: (...args: unknown[]) => loadDraft(...args),
  syncBlobs: (...args: unknown[]) => syncBlobs(...args),
  saveMeta: (...args: unknown[]) => saveMeta(...args),
  clearDraft: (...args: unknown[]) => clearDraft(...args),
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
    confirmEventStored.mockReset().mockResolvedValue(true); // #350: 既定は実在確認 OK（成功パス）。
    fetchKnownHashtags.mockReset().mockResolvedValue([]);
    fetchPopularHashtags.mockReset().mockResolvedValue([]);
    fetchProfileName.mockReset().mockResolvedValue(null);
    saveDisplayName.mockReset().mockResolvedValue(undefined);
    renderSquareImageFromRect.mockReset().mockResolvedValue(new Blob([new Uint8Array([9])], { type: "image/jpeg" }));
    // 下書き境界（#228）: 既定は「下書き無し」。保存系は resolve する no-op スパイ。
    loadDraft.mockReset().mockResolvedValue(null);
    syncBlobs.mockReset().mockResolvedValue(undefined);
    saveMeta.mockReset().mockResolvedValue(undefined);
    clearDraft.mockReset().mockResolvedValue(undefined);
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
    // 並列アップロード（#167）では完了順が非決定なので、呼び出し順依存の mockResolvedValueOnce を
    // やめ、ファイル名（hanoba-1.jpg…）でURLを決める。imageUrls は images 順（Promise.all 結果）で決定的。
    uploadImage.mockReset();
    uploadImage.mockImplementation((file: File) =>
      Promise.resolve({ url: `https://image.nostr.build/${file.name}` }),
    );
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
      imageUrls: ["https://image.nostr.build/hanoba-1.jpg", "https://image.nostr.build/hanoba-2.jpg"],
      photoShotDates: [null, null], // 撮影日（#324）: テスト画像は EXIF/日付名なし＝写真ごと null
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
    // 並列でも images 順で決定的になるよう、ファイル名（hanoba-N.jpg）でURLを決める（#167）。
    uploadImage.mockReset();
    uploadImage.mockImplementation((file: File) =>
      Promise.resolve({ url: `https://image.nostr.build/${file.name}` }),
    );
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
        "https://image.nostr.build/hanoba-1.jpg",
        "https://image.nostr.build/hanoba-2.jpg",
        "https://image.nostr.build/hanoba-3.jpg",
        "https://image.nostr.build/hanoba-4.jpg",
      ],
      photoShotDates: [null, null, null, null],
    });
  });

  it("並列投稿で一部が失敗したら成功した分だけ削除し error 表示する（#167）", async () => {
    const user = userEvent.setup();
    // 並列なので「N番目」ではなくファイル名で失敗を決める。2枚目（hanoba-2.jpg）だけ reject。
    // 1枚目（hanoba-1.jpg）は成功 → その URL だけ deleteImage で巻き戻す。
    uploadImage.mockReset();
    uploadImage.mockImplementation((file: File) =>
      file.name === "hanoba-2.jpg"
        ? Promise.reject(new Error("upload failed"))
        : Promise.resolve({ url: `https://image.nostr.build/${file.name}` }),
    );
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());
    await user.type(screen.getByLabelText("ひとこと"), "失敗時 cleanup");
    await waitFor(() => expect(screen.getByRole("button", { name: /投稿する/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /投稿する/ }));

    await waitFor(() => expect(deleteImage).toHaveBeenCalledWith("https://image.nostr.build/hanoba-1.jpg"));
    // 失敗した 2枚目は URL を得ていないので deleteImage されない。
    expect(deleteImage).not.toHaveBeenCalledWith("https://image.nostr.build/hanoba-2.jpg");
    expect(signAndPublishNote).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("upload failed");
  });

  it("散文を打ってからタグチップを選ぶと一言が prose\\n\\n#tag 形になる（#282）", async () => {
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

    // 散文とタグ群は空行（\n\n）で分かれ、タグ行が末尾にできる（#282）。
    expect(caption.value).toBe("開花した\n\n#水やり ");
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
    await user.click(screen.getByRole("button", { name: "#肥料" }));

    expect(caption.value).toBe("成長記録\n\n#水やり #肥料 ");
  });

  it("選択済みチップを外すと空タグ行のぶら下がり空行を畳む（#282）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const caption = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;
    await user.type(caption, "開花した");
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(caption.value).toBe("開花した\n\n#水やり ");

    // 選択済み（aria-pressed=true）になったチップを再タップ＝removeTag で外す。
    // 空行ごと畳んで散文だけに戻る（#282）。
    await user.click(screen.getByRole("button", { name: "#水やり" }));
    expect(caption.value).toBe("開花した");
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

  // #151 不足理由の a11y: role=status / aria-live=polite と describedby の dangling 防止。
  it("不足あり（D2）では不足理由 <p> が role=status・aria-live=polite・id=hanoba-compose-shortfall を持つ", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    // 画像1枚選択＋caption 空なら missing は非空（最低でも「ひとこと」）。この観点は missing 非空で足り、
    // crop の確定状態には依存しないので fireEvent.load は不要。
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());

    const shortfall = await screen.findByText(/を入れると投稿できます/);
    // 文言は span 分割なので、role=status を持つ告知ラッパ <p> を id 経由で取り直して属性を見る。
    const region = document.getElementById("hanoba-compose-shortfall");
    expect(region).not.toBeNull();
    expect(region).toBe(shortfall.closest("p"));
    expect(region).toHaveAttribute("role", "status");
    expect(region).toHaveAttribute("aria-live", "polite");
  });

  it("不足あり（D2）では送信ボタンの aria-describedby が実在する不足理由 <p> を指す（dangling でない）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());

    const submit = await screen.findByRole("button", { name: /投稿する/ });
    expect(submit).toHaveAttribute("aria-describedby", "hanoba-compose-shortfall");
    // 参照先 id が DOM に実在する（dangling reference でない）。
    expect(document.getElementById("hanoba-compose-shortfall")).not.toBeNull();
  });

  it("不足解消（D2→D1）で不足理由 <p> が消え、かつ送信ボタンの aria-describedby も同時に外れる", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    // crop 確定（fireEvent.load）で写真枠を満たし、残る不足を「一言」だけにする。
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const submit = await screen.findByRole("button", { name: /投稿する/ });
    // 入力前は D2: <p> と describedby が揃って存在。
    expect(submit).toHaveAttribute("aria-describedby", "hanoba-compose-shortfall");
    expect(document.getElementById("hanoba-compose-shortfall")).not.toBeNull();

    // 一言を入れて missing を空に＝D1 へ遷移。<p> 消滅と describedby 除去が同時であること。
    await user.type(screen.getByLabelText("ひとこと"), "開花した");
    expect(screen.queryByText(/を入れると投稿できます/)).not.toBeInTheDocument();
    expect(document.getElementById("hanoba-compose-shortfall")).toBeNull();
    expect(submit).not.toHaveAttribute("aria-describedby");
  });

  // 写真の並べ替え行（#274）。サムネ列直下に ◀左へ／カウンタ／右へ▶ を出す。
  // 並べ替えのコアは reorder.test.ts（moveById 単体）が担保。ここでは UI の出し分け・
  // disabled 状態・押下による順序とカウンタの更新だけを実 DOM ベースで検証する。
  it("画像が1枚のときは並べ替え行（◀左へ/右へ▶）を出さない", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());

    // 1枚選択済み（サムネは出る）でも並べ替え行は出ない。
    await screen.findByAltText("1枚目");
    expect(screen.queryByRole("button", { name: "選択中の写真を左へ移動" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "選択中の写真を右へ移動" })).not.toBeInTheDocument();
  });

  it("画像が2枚以上のときは並べ替え行が表示される", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);

    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "選択中の写真を左へ移動" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "選択中の写真を右へ移動" })).toBeInTheDocument();
    // カウンタは「N枚目 / 全M枚」。追加直後は先頭（1枚目）が選択中。
    expect(screen.getByText((_, el) => el?.textContent === "1枚目 / 全2枚")).toBeInTheDocument();
  });

  it("先頭の写真を選択中のとき ◀左へ が disabled・右へ▶ が enabled", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());

    // 追加直後は先頭（index 0）が選択中＝左へは押せない・右へは押せる。
    expect(screen.getByRole("button", { name: "選択中の写真を左へ移動" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "選択中の写真を右へ移動" })).toBeEnabled();
  });

  it("末尾の写真を選択中のとき 右へ▶ が disabled・◀左へ が enabled", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());

    // 末尾（2枚目）を選択中にする。
    await user.click(screen.getByAltText("2枚目").closest("button")!);
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2枚目 / 全2枚")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "選択中の写真を右へ移動" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "選択中の写真を左へ移動" })).toBeEnabled();
  });

  it("右へ▶ を押すと選択中の写真が後ろへ移動しカウンタが増える", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());

    // 追加直後は先頭（1枚目）が選択中。右へ移動で 2枚目位置へ。
    expect(screen.getByText((_, el) => el?.textContent === "1枚目 / 全2枚")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "選択中の写真を右へ移動" }));

    // カウンタの N が 1→2 に増える＝選択中の写真が後ろへ動いた。
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2枚目 / 全2枚")).toBeInTheDocument());
    // 末尾へ来たので右へはもう押せない・左へは押せる。
    expect(screen.getByRole("button", { name: "選択中の写真を右へ移動" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "選択中の写真を左へ移動" })).toBeEnabled();
  });

  it("右へ▶ 押下後はサムネの alt 順序（1枚目/2枚目）が入れ替わる", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());

    // 並べ替え前: alt="1枚目" は one.jpg・alt="2枚目" は two.jpg（alt は配列 index 由来）。
    const before1 = screen.getByAltText("1枚目") as HTMLImageElement;
    const before2 = screen.getByAltText("2枚目") as HTMLImageElement;
    const srcOne = before1.getAttribute("src");
    const srcTwo = before2.getAttribute("src");
    expect(srcOne).not.toBe(srcTwo);

    // 先頭（one.jpg）を右へ動かす＝配列は [two, one] になる。
    await user.click(screen.getByRole("button", { name: "選択中の写真を右へ移動" }));
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2枚目 / 全2枚")).toBeInTheDocument());

    // alt の付番（index+1）は固定枠なので、各枠の中身（src）が入れ替わっている。
    const after1 = screen.getByAltText("1枚目") as HTMLImageElement;
    const after2 = screen.getByAltText("2枚目") as HTMLImageElement;
    expect(after1.getAttribute("src")).toBe(srcTwo); // 1枠目に元 two が来た
    expect(after2.getAttribute("src")).toBe(srcOne); // 2枠目に元 one が来た
  });
});

// 下書きの自動保存・復元の配線（#228）。draft.ts はモック済み（呼び出し有無・引数・順序だけ見る）。
describe("Composer 下書き配線（#228）", () => {
  /** 手で resolve/reject できる Promise（loadDraft を未解決で止めるレース検証用）。 */
  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function snapshotWith(over: Partial<{
    caption: string;
    currentId: string | null;
    images: Array<{ id: string; name: string }>;
  }> = {}) {
    const images = (over.images ?? [{ id: "img-1", name: "saved.jpg" }]).map((i) => ({
      id: i.id,
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
      name: i.name,
      type: "image/jpeg",
      crop: { sx: 0, sy: 0, size: 100 },
      filters: [],
    }));
    return {
      caption: over.caption ?? "保存された本文",
      currentId: over.currentId ?? null,
      images,
    };
  }

  beforeEach(() => {
    loadDraft.mockReset().mockResolvedValue(null);
    syncBlobs.mockReset().mockResolvedValue(undefined);
    saveMeta.mockReset().mockResolvedValue(undefined);
    clearDraft.mockReset().mockResolvedValue(undefined);
    uploadImage.mockReset().mockResolvedValue({ url: "https://image.nostr.build/abc.jpg" });
    deleteImage.mockReset().mockResolvedValue(true);
    signAndPublishNote.mockReset().mockResolvedValue({ id: "evt1" });
    confirmEventStored.mockReset().mockResolvedValue(true); // #350: 既定は実在確認 OK（成功パス）。
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
    localStorage.setItem("hanoba:name", "テスト栽培家");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("復元完了前（loadDraft 未解決）は保存系を一切呼ばない（hydration ガード）", async () => {
    // loadDraft を未解決のまま止め、復元前に初期 images=[]/空 caption が走っても
    // clearDraft / syncBlobs / saveMeta が呼ばれないこと（race で下書きを上書き消去しない）。
    const d = deferred<null>();
    loadDraft.mockReturnValue(d.promise);

    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());
    // 復元待ちのまま少し回しても保存系は沈黙する。
    await Promise.resolve();
    expect(clearDraft).not.toHaveBeenCalled();
    expect(syncBlobs).not.toHaveBeenCalled();
    expect(saveMeta).not.toHaveBeenCalled();

    // 後片付け（dangling promise を解消）。
    d.resolve(null);
  });

  it("loadDraft が null 解決でも hydratedRef は立つ（その後の写真追加で syncBlobs が呼ばれる）", async () => {
    const user = userEvent.setup();
    loadDraft.mockResolvedValue(null);
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());

    // 復元が解禁済みなので、写真集合の変化で blobs 同期が走る。
    await waitFor(() => expect(syncBlobs).toHaveBeenCalled());
  });

  it("loadDraft が画像1件+本文を返すと、サムネ・本文・投稿ボタンが復元表示される", async () => {
    loadDraft.mockResolvedValue(snapshotWith({ caption: "復元された一言", images: [{ id: "img-1", name: "saved.jpg" }] }));
    render(<Composer />);

    // サムネ（1枚目）と投稿ボタンが出る＝写真ありの UI に切り替わっている。
    expect(await screen.findByAltText("1枚目")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /投稿する/ })).toBeInTheDocument();
    // 本文も復元されている。
    expect((screen.getByLabelText("ひとこと") as HTMLTextAreaElement).value).toBe("復元された一言");
  });

  it("復元直後は読んだばかりの blob を書き戻さない（syncBlobs を呼ばない・Fix1 の核心）", async () => {
    loadDraft.mockResolvedValue(snapshotWith({ caption: "復元", images: [{ id: "img-1", name: "saved.jpg" }] }));
    render(<Composer />);

    // 復元 UI が出る＝setImages(restored) が走った後でも、復元集合キーを控えてあるので blobs は書き戻さない。
    expect(await screen.findByAltText("1枚目")).toBeInTheDocument();
    expect(syncBlobs).not.toHaveBeenCalled();
  });

  it("復元後に写真を全部外すと blobs を空配列でクリアする（外した写真が IDB に残って復活しない）", async () => {
    const user = userEvent.setup();
    loadDraft.mockResolvedValue(snapshotWith({ caption: "", images: [{ id: "img-1", name: "saved.jpg" }] }));
    render(<Composer />);
    await screen.findByAltText("1枚目");
    // 復元直後は書き戻さない（前提）。
    expect(syncBlobs).not.toHaveBeenCalled();

    // 1枚を外して写真ゼロへ。集合キーが "" に変わる＝復元集合キーと不一致なので syncBlobs([]) が走る。
    await user.click(screen.getByRole("button", { name: "写真を選び直す" }));
    await waitFor(() => expect(syncBlobs).toHaveBeenCalled());
    expect(syncBlobs.mock.calls.at(-1)![0]).toEqual([]);
  });

  it("snapshot.images が空なら復元せずピッカーのまま（写真ゼロは下書き扱いしない）", async () => {
    loadDraft.mockResolvedValue(snapshotWith({ images: [] }));
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    // 写真が無いので投稿 UI に切り替わらない＝ピッカーのまま。
    expect(screen.getByRole("button", { name: /アルバム/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /投稿する/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("ひとこと")).not.toBeInTheDocument();
  });

  it("復元時 currentId=null なら先頭画像を選択状態にする", async () => {
    loadDraft.mockResolvedValue(
      snapshotWith({ currentId: null, images: [{ id: "img-1", name: "a.jpg" }, { id: "img-2", name: "b.jpg" }] }),
    );
    render(<Composer />);

    const firstThumb = (await screen.findByAltText("1枚目")).closest("button");
    expect(firstThumb).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByAltText("2枚目").closest("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("写真を追加すると order を振った blobs を syncBlobs に渡す", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);

    await waitFor(() => expect(syncBlobs).toHaveBeenCalled());
    // 最後の sync は 2 枚で order 0,1。
    const lastCall = syncBlobs.mock.calls.at(-1)![0] as Array<{ name: string; order: number }>;
    expect(lastCall.map((r) => r.order)).toEqual([0, 1]);
    expect(lastCall.map((r) => r.name)).toEqual(["one.jpg", "two.jpg"]);
  });

  it("並べ替え（右へ▶）後は新しい順序の id/order 列で syncBlobs が再保存される（#274 回帰固定）", async () => {
    // 狙い: blobSetKey（images の id 列）に誤って .sort() が入ると、順序変更で blobs effect が
    // 再発火しなくなり「再読込で並べ替えが巻き戻る」退行が起きる。その時このテストが即落ちる。
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);

    // 追加直後の sync は order 0,1 / one,two。これを並べ替え前の基準にする。
    await waitFor(() => expect(syncBlobs).toHaveBeenCalled());
    const before = syncBlobs.mock.calls.at(-1)![0] as Array<{ id: string; name: string; order: number }>;
    expect(before.map((r) => r.name)).toEqual(["one.jpg", "two.jpg"]);
    const firstId = before[0]!.id; // 元の先頭（one.jpg）の id。並べ替えで末尾へ来るはず。
    syncBlobs.mockClear();

    // 追加直後は先頭（one.jpg）が選択中。右へ移動で配列は [two, one] になる。
    await user.click(screen.getByRole("button", { name: "選択中の写真を右へ移動" }));

    // blobSetKey が変わって blobs effect が再発火＝新しい順序で再保存される。
    await waitFor(() => expect(syncBlobs).toHaveBeenCalled());
    const after = syncBlobs.mock.calls.at(-1)![0] as Array<{ id: string; name: string; order: number }>;
    // order は配列添字どおり 0,1（穴あきでない）で、中身が入れ替わっている。
    expect(after.map((r) => r.order)).toEqual([0, 1]);
    expect(after.map((r) => r.name)).toEqual(["two.jpg", "one.jpg"]);
    // 元の先頭（one.jpg）の id が新しい末尾（order 最大）に来ている＝並べ替えが永続化される。
    expect(after.at(-1)!.id).toBe(firstId);
  });

  it("crop / filters の変更では syncBlobs を呼ばない（blob 再書き込み回避）が、saveMeta は呼ばれる", async () => {
    // 写真追加・crop 確定までは実タイマーで進める（userEvent + 全 timer fake の相互デッドロックを避ける）。
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    // 写真追加で 1 回 syncBlobs（集合が変わった）。
    await waitFor(() => expect(syncBlobs).toHaveBeenCalledTimes(1));
    const cropImg = await screen.findByAltText("クロップ対象の写真");

    // デバウンス窓だけ setTimeout を fake する（他は実時間のまま＝Promise/microtask は通常どおり）。
    // crop 変更より前に fake へ切り替え、meta デバウンスタイマーを fake 上で発火できるようにする。
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    saveMeta.mockClear();
    // crop を確定（fireEvent.load → 初期正方形 crop が親に入る＝crop 変更）。
    act(() => {
      fireEvent.load(cropImg);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    // crop 変更では blob 集合キー（id 列）は不変＝syncBlobs は増えない。
    expect(syncBlobs).toHaveBeenCalledTimes(1);
    // 一方、meta（crop を含む軽い側）はデバウンス後に保存される。
    expect(saveMeta).toHaveBeenCalled();
  });

  it("本文入力は約1000msデバウンスされる（経過前0回・経過後1回・最終値で保存）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    const caption = (await screen.findByLabelText("ひとこと")) as HTMLTextAreaElement;

    // デバウンス窓だけ setTimeout を fake にして、本文変更を fireEvent.change で 1 回入れる。
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    saveMeta.mockClear();
    act(() => {
      fireEvent.change(caption, { target: { value: "開花" } });
    });

    // 1000ms 未満では meta 保存はまだ走らない。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });
    expect(saveMeta).not.toHaveBeenCalled();

    // 1000ms 経過で 1 回だけ走り、最終値が渡る。
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(saveMeta).toHaveBeenCalledTimes(1);
    expect(saveMeta.mock.calls.at(-1)![0]).toMatchObject({ caption: "開花" });
  });

  it("投稿成功で clearDraft を呼ぶ（下書きの役目終わり）", async () => {
    const user = userEvent.setup();
    const orig = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", { configurable: true, value: { href: "" } as Location });
    try {
      render(<Composer />);
      await waitFor(() => expect(loadDraft).toHaveBeenCalled());
      const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
      await user.upload(input, makeImageFile());
      fireEvent.load(await screen.findByAltText("クロップ対象の写真"));
      await user.type(screen.getByLabelText("ひとこと"), "開花した");
      await user.click(await screen.findByRole("button", { name: /投稿する/ }));

      await waitFor(() => expect(signAndPublishNote).toHaveBeenCalled());
      expect(clearDraft).toHaveBeenCalled();
    } finally {
      if (orig) Object.defineProperty(window, "location", orig);
    }
  });

  it("#350: publish しても実在確認できなければ下書きを消さず・遷移せず・エラーを出す", async () => {
    const user = userEvent.setup();
    confirmEventStored.mockReset().mockResolvedValue(false); // 読む側に載っていない（accept-then-drop）。
    const orig = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", { configurable: true, value: { href: "" } as Location });
    try {
      render(<Composer />);
      await waitFor(() => expect(loadDraft).toHaveBeenCalled());
      await user.upload(screen.getByLabelText("カメラで撮影") as HTMLInputElement, makeImageFile());
      fireEvent.load(await screen.findByAltText("クロップ対象の写真"));
      await user.type(screen.getByLabelText("ひとこと"), "開花した");
      clearDraft.mockClear();
      await user.click(await screen.findByRole("button", { name: /投稿する/ }));

      await waitFor(() => expect(signAndPublishNote).toHaveBeenCalled());
      await waitFor(() => expect(confirmEventStored).toHaveBeenCalled());
      // 下書きは消さない・/me へ遷移しない・確認できない旨のエラーを出す（リトライ可）。
      expect(clearDraft).not.toHaveBeenCalled();
      // 実在投稿（別リレーに居る可能性）の画像を消さない＝確認失敗パスで deleteImage を呼ばない。
      expect(deleteImage).not.toHaveBeenCalled();
      expect(window.location.href).toBe("");
      expect(await screen.findByText(/投稿を確認できませんでした/)).toBeInTheDocument();
    } finally {
      if (orig) Object.defineProperty(window, "location", orig);
    }
  });

  it("写真ゼロ＋本文空になったら clearDraft で下書きを自動消去する", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    // 1枚入れてから「写真を選び直す」で写真ゼロへ戻す（本文は空のまま）。
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    await screen.findByAltText("1枚目");
    clearDraft.mockClear();

    await user.click(screen.getByRole("button", { name: "写真を選び直す" }));
    // 写真ゼロ かつ 本文空＝書きかけ無し → clearDraft。
    await waitFor(() => expect(clearDraft).toHaveBeenCalled());
  });

  it("1枚で「写真を選び直す」しても本文は保持する（clearDraft しない・挙動変更の核心）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    await user.type(await screen.findByLabelText("ひとこと"), "残したい本文");
    clearDraft.mockClear();

    await user.click(screen.getByRole("button", { name: "写真を選び直す" }));

    // 写真は消えてピッカーへ戻るが、本文が残っているので下書きは消さない。
    await waitFor(() => expect(screen.getByRole("button", { name: /アルバム/ })).toBeInTheDocument());
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it("2枚で「この写真を外す」と current の1枚だけ除去し、本文は保持する", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement;
    await user.upload(input, [makeNamedImageFile("one.jpg"), makeNamedImageFile("two.jpg")]);
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());
    await user.type(screen.getByLabelText("ひとこと"), "成長記録");
    clearDraft.mockClear();

    await user.click(screen.getByRole("button", { name: "この写真を外す" }));

    // 1枚に減るが本文は残る・全消去はしない。
    expect(screen.getByText((_, el) => el?.textContent === "1/4枚")).toBeInTheDocument();
    expect((screen.getByLabelText("ひとこと") as HTMLTextAreaElement).value).toBe("成長記録");
    expect(clearDraft).not.toHaveBeenCalled();
  });

  it("本文だけ × で消すと写真サムネは残り、投稿ボタンは disabled になる（退行確認）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    await waitFor(() => expect(loadDraft).toHaveBeenCalled());

    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));
    const caption = await screen.findByLabelText("ひとこと");
    await user.type(caption, "消す本文");
    await waitFor(() => expect(screen.getByRole("button", { name: /投稿する/ })).toBeEnabled());

    await user.clear(caption);

    // 写真サムネは残り、本文が空になったので投稿は不可。
    expect(screen.getByAltText("1枚目")).toBeInTheDocument();
    expect((caption as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByRole("button", { name: /投稿する/ })).toBeDisabled();
  });

  it("新 effect で act 警告 / console.error を増やさない", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    loadDraft.mockResolvedValue(snapshotWith({ caption: "復元", images: [{ id: "img-1", name: "a.jpg" }] }));
    render(<Composer />);
    // 復元 → 写真追加 → 本文編集まで一通り触る。
    await screen.findByAltText("1枚目");
    const add = screen.getByRole("button", { name: "写真を追加" });
    await user.click(add);
    await user.upload(screen.getByLabelText("アルバムから選ぶ") as HTMLInputElement, makeNamedImageFile("two.jpg"));
    await waitFor(() => expect(screen.getByText((_, el) => el?.textContent === "2/4枚")).toBeInTheDocument());

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
