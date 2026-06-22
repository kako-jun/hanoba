import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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
// crop の正方形矩形算出はスパイ化（#393）。既定は中央正方形相当 {0,0,100}。ユーザー crop の undo テストは
// 「変更前と異なる矩形」が要るので、テスト側で computeSquareCropRect.mockReturnValueOnce を差し込んで区別する。
const computeSquareCropRect = vi.fn((..._args: unknown[]) => ({ sx: 0, sy: 0, size: 100 }));
vi.mock("../../lib/image/crop.ts", () => ({
  computeSquareCropRect: (...args: unknown[]) => computeSquareCropRect(...args),
  renderSquareImageFromRect: (...args: unknown[]) => renderSquareImageFromRect(...args),
  // 回転（#314）: 焼き込みの素材生成は canvas なのでスタブ、UI が使う純関数は本物相当を返す。
  renderInPlaceRotation: () => document.createElement("canvas"),
  rotationFine: (deg: number) => deg - Math.round(deg / 90) * 90,
  // #348: クロップの可視領域 clamp。clamp の正しさは crop.test で検証する。ここは素通しでよい
  //（Composer テストは 90 度回転後のクロップ枠の clamp 自体は検証しない）。
  clampCropToVisible: (crop: { x: number; y: number; width: number; height: number }) => crop,
  // #403: 自然座標矩形→% 変換。純関数の境界は crop.test が担保するので、ここは本物相当の素直な変換でよい
  //（undo の cropSyncToken 再同期 effect が initialCrop から矩形を引き直すのに使う）。
  squareRectToPercentCrop: (rect: { sx: number; sy: number; size: number }, naturalW: number, naturalH: number) =>
    naturalW <= 0 || naturalH <= 0
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: (rect.sx / naturalW) * 100, y: (rect.sy / naturalH) * 100, width: (rect.size / naturalW) * 100, height: (rect.size / naturalH) * 100 },
  MAX_FINE_ROTATION: 15,
}));

// react-image-crop の実ドラッグは pointer 計測に依存し happy-dom では onComplete が発火しない（#393）。
// crop の clamp/座標の正しさは crop.test/CropFrame.test が担保するので、ここでは ReactCrop を「children を
// そのまま描き、onComplete をテストから叩けるダミー」に差し替え、ユーザードラッグ由来の crop が1手アンドゥ
// 対象になる Composer 統合だけを検証する。centerCrop/makeAspectCrop は初期クロップ算出に要るので実物を借りる。
vi.mock("react-image-crop", async () => {
  const actual = await vi.importActual<typeof import("react-image-crop")>("react-image-crop");
  const ReactCrop = ({
    children,
    onComplete,
  }: {
    children?: ReactNode;
    onComplete?: (pixelCrop: unknown, percentCrop: unknown) => void;
    [key: string]: unknown;
  }) => (
    <div className="ReactCrop">
      <button
        type="button"
        data-testid="reactcrop-complete"
        onClick={() =>
          onComplete?.(
            { unit: "px", x: 0, y: 0, width: 60, height: 60 },
            { unit: "%", x: 20, y: 20, width: 60, height: 60 },
          )
        }
      />
      {children}
    </div>
  );
  return { ...actual, default: ReactCrop };
});

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
    // crop 矩形算出（#393）は既定 {0,0,100}。ユーザー crop の undo テストだけ mockReturnValueOnce で別矩形を出す。
    computeSquareCropRect.mockReset().mockReturnValue({ sx: 0, sy: 0, size: 100 });
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
    computeSquareCropRect.mockReset().mockReturnValue({ sx: 0, sy: 0, size: 100 });
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

  it("画像の角度編集を1手アンドゥでき、クロップ・初期状態は履歴に積まない（#363）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    // 初期は自動クロップだけ＝履歴は空（自動クロップは undo 対象外。ユーザー操作の crop は #393 で対象）。アンドゥボタンは無効。
    const undo = await screen.findByRole("button", { name: "直前の画像編集（角度・フィルタ・クロップ・撮影日）を1手戻す" });
    expect(undo).toBeDisabled();

    // 右90°回転＝1手。img の transform に即時反映され、アンドゥが有効になる。
    await user.click(screen.getByRole("button", { name: "写真を右に90度回転" }));
    const img = screen.getByAltText("クロップ対象の写真") as HTMLImageElement;
    expect(img.style.transform).toBe("rotate(90deg)");
    expect(undo).toBeEnabled();

    // アンドゥで回転が変更前（無回転）へ戻り、履歴が空になりボタンは再び無効。
    await user.click(undo);
    expect(img.style.transform).toBe("");
    expect(undo).toBeDisabled();
  });

  // #393: 矩形ドラッグ(crop)もユーザー操作なら1手アンドゥ対象。自動センタークロップ・回転由来の commit は対象外を維持する。
  const undoAria = "直前の画像編集（角度・フィルタ・クロップ・撮影日）を1手戻す";

  it("プログラム由来の crop（画像ロードの自動センタークロップ）はアンドゥ対象に積まない（#393）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    // 画像ロード＝初期 commit（fromUser=false）。これだけではアンドゥは有効化しない。
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const undo = await screen.findByRole("button", { name: undoAria });
    expect(undo).toBeDisabled();
  });

  it("ユーザーのドラッグ由来の crop は1手アンドゥでき、undo で前の crop に戻る（#393）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const undo = await screen.findByRole("button", { name: undoAria });
    expect(undo).toBeDisabled(); // 初期（自動クロップ）はまだ積まれていない。

    // ユーザーのドラッグ確定＝変更前と異なる矩形を返させて crop を動かす（fromUser=true）。
    computeSquareCropRect.mockReturnValueOnce({ sx: 10, sy: 10, size: 80 });
    await user.click(screen.getByTestId("reactcrop-complete"));
    // 投稿時に焼き込む crop が動いた矩形になっている＝ユーザー crop が反映された。
    expect(undo).toBeEnabled();

    // アンドゥで crop が変更前（自動センタークロップ）へ戻り、履歴が空になりボタンは再び無効。
    await user.click(undo);
    expect(undo).toBeDisabled();

    // 焼き込みに渡る crop が変更前の {0,0,100} に戻っていることを投稿で確認する。
    await user.type(screen.getByLabelText("ひとこと"), "位置を戻した");
    await waitFor(() => expect(screen.getByRole("button", { name: /投稿する/ })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /投稿する/ }));
    await waitFor(() => expect(renderSquareImageFromRect).toHaveBeenCalled());
    // renderSquareImageFromRect(source, crop, ...) の crop（第2引数）が undo 後の {0,0,100}。
    expect(renderSquareImageFromRect.mock.calls.at(-1)![1]).toEqual({ sx: 0, sy: 0, size: 100 });
  });

  it("連続したユーザー crop ドラッグはそれぞれ独立した1手として戻せる（畳まない・#393）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const undo = await screen.findByRole("button", { name: undoAria });

    // 1回目のユーザードラッグ。
    computeSquareCropRect.mockReturnValueOnce({ sx: 10, sy: 10, size: 80 });
    await user.click(screen.getByTestId("reactcrop-complete"));
    expect(undo).toBeEnabled();
    // 2回目のユーザードラッグ（同じ画像・同じ crop フィールドだが、別の1手として積まれるべき）。
    computeSquareCropRect.mockReturnValueOnce({ sx: 20, sy: 20, size: 60 });
    await user.click(screen.getByTestId("reactcrop-complete"));
    expect(undo).toBeEnabled();

    // 1手戻してもまだ有効（2手分積まれている＝畳まれていない）。
    await user.click(undo);
    expect(undo).toBeEnabled();
    // もう1手戻すと初期（自動クロップ）まで戻り、ボタンは無効。
    await user.click(undo);
    expect(undo).toBeDisabled();
  });

  // #403: フィルタは離散編集＝1アクション=1手（畳まない）。複数 on→off の後に undo で off 直前（複数 on）へ戻る。
  // 旧挙動は同一 field 連続変更として畳み、唯一の snapshot が「最初=空」になり off→undo で空のまま無変化だった（実機バグ）。
  it("フィルタを複数 on→off の後に undo すると off 直前（複数 on）へ戻る（#403）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const undo = await screen.findByRole("button", { name: undoAria });
    expect(undo).toBeDisabled();

    // フィルタを複数オン（翠露 弱→中、別フィルタも1段）。各クリックが独立した1手。
    const sui = screen.getByRole("button", { name: /翠露/ });
    await user.click(sui); // なし→弱（翠露 1段）
    await user.click(sui); // 弱→中（翠露 2段）
    expect(sui).toHaveAttribute("aria-pressed", "true");
    expect(sui).toHaveAttribute("data-strength", "2");
    // 「なし」（全 off）チップで全フィルタを外す＝この直前は「翠露=中」が選ばれている状態。
    const noneChip = screen.getByRole("button", { name: "なし" });
    await user.click(noneChip);
    expect(sui).toHaveAttribute("aria-pressed", "false");
    expect(sui).toHaveAttribute("data-strength", "0");
    expect(noneChip).toHaveAttribute("aria-pressed", "true"); // 全 off 状態。

    // 1手戻す＝off の直前（翠露=中が選ばれた複数 on 状態）へ戻る。空のままにならない（#403 の核心）。
    await user.click(undo);
    expect(sui).toHaveAttribute("aria-pressed", "true");
    expect(sui).toHaveAttribute("data-strength", "2");
    expect(screen.getByRole("button", { name: "なし" })).toHaveAttribute("aria-pressed", "false");
  });

  // #363/#403: 回転の微調整スライダ（rotation 単独の連続入力）は従来どおり 1 ドラッグ run を1手に畳む（退行確認）。
  // 離散編集（フィルタ/クロップ）が1手ずつになっても、連続入力の畳み込みは保つ。
  it("回転の微調整スライダ（連続入力）は1ドラッグ run を1手に畳む（#363 回帰）", async () => {
    const user = userEvent.setup();
    render(<Composer />);
    const input = screen.getByLabelText("カメラで撮影") as HTMLInputElement;
    await user.upload(input, makeImageFile());
    fireEvent.load(await screen.findByAltText("クロップ対象の写真"));

    const undo = await screen.findByRole("button", { name: undoAria });
    expect(undo).toBeDisabled();

    // 微調整スライダを連続で動かす（rotation 単独の連変更）＝run の最初だけ積んで畳む。
    const slider = screen.getByLabelText("角度の微調整（0.5度きざみ）");
    fireEvent.change(slider, { target: { value: "1.5" } });
    expect(undo).toBeEnabled();
    fireEvent.change(slider, { target: { value: "3" } });
    fireEvent.change(slider, { target: { value: "4.5" } });

    // 1手戻すと畳んだ run の最初（無回転）へ一気に戻り、履歴は空＝ボタン無効。
    const img = screen.getByAltText("クロップ対象の写真") as HTMLImageElement;
    await user.click(undo);
    expect(img.style.transform).toBe("");
    expect(undo).toBeDisabled();
  });
});
