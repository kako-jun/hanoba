import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ネットワークはモック境界で止める（実 relay・実アップロードを呼ばない）。
// 編集欄は #93 で単発取得をやめ fetchMyProfileResilient を使う。keys.ts（控えの読み書き）は
// 実装のまま（happy-dom の localStorage）使い、書き戻しを実 localStorage で検証する。
const fetchMyProfileResilient = vi.fn();
const saveProfile = vi.fn();
const uploadImage = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyProfileResilient: (...args: unknown[]) => fetchMyProfileResilient(...args),
  saveProfile: (...args: unknown[]) => saveProfile(...args),
}));
vi.mock("../../lib/nostr/upload.ts", () => ({
  uploadImage: (...args: unknown[]) => uploadImage(...args),
}));

import ProfileEditor from "./ProfileEditor.tsx";

describe("ProfileEditor (#35 Piece3)", () => {
  beforeEach(() => {
    fetchMyProfileResilient.mockReset().mockResolvedValue(null);
    saveProfile.mockReset().mockResolvedValue({ id: "evt1" });
    uploadImage.mockReset().mockResolvedValue({ url: "https://image.nostr.build/x.jpg" });
    localStorage.clear();
    // ユーザー名・鍵を設定済みにする（名前ゲートを通す）。
    localStorage.setItem("hanoba:name", "テスト栽培家");
    localStorage.setItem("hanoba:sk", "67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa");
  });

  afterEach(() => cleanup());

  it("既定は折りたたみ、編集で開く", async () => {
    render(<ProfileEditor />);
    expect(screen.getByText("テスト栽培家")).toBeInTheDocument();
    // 折りたたみ時は about 入力は無い。
    expect(screen.queryByLabelText("自己紹介")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /編集/ }));
    expect(screen.getByLabelText("自己紹介")).toBeInTheDocument();
  });

  it("bare では glass カードを描かず、見出しは名前でなく『プロフィール』（#104）", () => {
    const { container } = render(<ProfileEditor bare />);
    // 名前は上の AccountName が主表示するので、bare の見出しは重複させない。
    expect(screen.getByText("プロフィール")).toBeInTheDocument();
    expect(screen.queryByText("テスト栽培家")).not.toBeInTheDocument();
    // 外側のガラスカードは親（統合カード）に委ねる＝自分では描かない。
    expect(container.querySelector(".glass")).toBeNull();
    expect(container.querySelector("section")?.className).not.toContain("glass");
  });

  it("サイトを追加して URL を入れるとサービス名が出る", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "＋ サイトを追加" }));
    const input = screen.getByLabelText("サイト 1 の URL");
    await user.type(input, "https://github.com/kako-jun");
    expect(await screen.findByText("GitHub")).toBeInTheDocument();
  });

  it("保存で saveProfile に name＋websites＋about を渡す", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.type(screen.getByLabelText("自己紹介"), "アガベ育ててます");
    await user.click(screen.getByRole("button", { name: "＋ サイトを追加" }));
    await user.type(screen.getByLabelText("サイト 1 の URL"), "https://llll-ll.com");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    expect(saveProfile).toHaveBeenCalledWith({
      name: "テスト栽培家",
      picture: null,
      about: "アガベ育ててます",
      websites: ["https://llll-ll.com"],
    });
    expect(await screen.findByText("保存しました。")).toBeInTheDocument();
  });

  it("ユーザー名未設定なら保存できない（促しを出す）", async () => {
    localStorage.removeItem("hanoba:name");
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByText("先に上でハンドルネームを設定してください。")).toBeInTheDocument();
  });

  it("名前未設定ならヘッダに「ハンドルネーム 未設定」が出る（#92）", () => {
    localStorage.removeItem("hanoba:name");
    render(<ProfileEditor />);
    expect(screen.getByText("ハンドルネーム 未設定")).toBeInTheDocument();
  });

  // #93: nsec 取り込み直後は控えが空（websites:[]）になりうる。relay から websites を
  // 表示に回復するだけでなく、ローカル控えにも書き戻して clobber 経路を塞ぐ。
  it("控えが空でも relay の websites を表示に出し、控えにも書き戻す（#93）", async () => {
    // import 直後を模す: 控えは空、relay には websites がある。
    localStorage.setItem(
      "hanoba:profileExtra",
      JSON.stringify({ picture: null, about: null, websites: [] }),
    );
    fetchMyProfileResilient.mockResolvedValue({
      name: "テスト栽培家",
      picture: null,
      about: null,
      websites: ["https://midori-en.example.com", "https://x.com/midori_test"],
    });
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    // 表示: relay の 2 サイトが編集欄に出る。
    await waitFor(() =>
      expect(screen.getByLabelText("サイト 1 の URL")).toHaveValue("https://midori-en.example.com"),
    );
    expect(screen.getByLabelText("サイト 2 の URL")).toHaveValue("https://x.com/midori_test");
    // 書き戻し: 控えにも websites が入る（名前変更時の saveDisplayName が空で潰さない）。
    await waitFor(() => {
      const extra = JSON.parse(localStorage.getItem("hanoba:profileExtra") ?? "{}");
      expect(extra.websites).toEqual([
        "https://midori-en.example.com",
        "https://x.com/midori_test",
      ]);
    });
  });

  it("控えに websites があれば relay 値で上書きしない（local 優先・#93）", async () => {
    localStorage.setItem(
      "hanoba:profileExtra",
      JSON.stringify({ picture: null, about: null, websites: ["https://local-only.example.com"] }),
    );
    fetchMyProfileResilient.mockResolvedValue({
      name: "テスト栽培家",
      picture: null,
      about: null,
      websites: ["https://relay-different.example.com"],
    });
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("サイト 1 の URL")).toHaveValue("https://local-only.example.com"),
    );
    // relay は別 URL を返すが local を保持。控えも local のまま（上書きしない）。
    expect(screen.queryByDisplayValue("https://relay-different.example.com")).not.toBeInTheDocument();
    const extra = JSON.parse(localStorage.getItem("hanoba:profileExtra") ?? "{}");
    expect(extra.websites).toEqual(["https://local-only.example.com"]);
  });

  it("relay が null（取得失敗）なら控えを書き換えない（空で潰さない・#93）", async () => {
    localStorage.setItem(
      "hanoba:profileExtra",
      JSON.stringify({ picture: null, about: null, websites: ["https://keep.example.com"] }),
    );
    fetchMyProfileResilient.mockResolvedValue(null);
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await waitFor(() =>
      expect(screen.getByLabelText("サイト 1 の URL")).toHaveValue("https://keep.example.com"),
    );
    const extra = JSON.parse(localStorage.getItem("hanoba:profileExtra") ?? "{}");
    expect(extra.websites).toEqual(["https://keep.example.com"]);
  });
});

// 秘密鍵（nsec）バックアップ欄（#213）。表示＋コピー専用で、kind:0（save）の payload には
// 絶対に載せない。固定の hanoba:sk から exportNsec() は決定的に下記 nsec を返す。
const NSEC = "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5";
const MASK = "•".repeat(24);

describe("ProfileEditor 秘密鍵バックアップ欄（#213）", () => {
  beforeEach(() => {
    fetchMyProfileResilient.mockReset().mockResolvedValue(null);
    saveProfile.mockReset().mockResolvedValue({ id: "evt1" });
    uploadImage.mockReset().mockResolvedValue({ url: "https://image.nostr.build/x.jpg" });
    localStorage.clear();
    localStorage.setItem("hanoba:name", "テスト栽培家");
    localStorage.setItem("hanoba:sk", "67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa");
  });

  afterEach(() => cleanup());

  // ---- A. 状態遷移・表示 ----------------------------------------------------

  it("折りたたみ時は nsec 欄が存在しない（普段は隠す）", () => {
    render(<ProfileEditor />);
    expect(screen.queryByLabelText("秘密鍵（nsec）")).not.toBeInTheDocument();
  });

  it("展開すると nsec 欄が出るが既定はマスク（平文を漏らさない）", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    const code = screen.getByLabelText("秘密鍵（nsec）");
    expect(code).toBeInTheDocument();
    expect(code).toHaveTextContent(MASK);
    expect(code.textContent).not.toContain("nsec1");
  });

  it("[表示]で平文 nsec が出る", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵を表示する" }));
    expect(screen.getByLabelText("秘密鍵（nsec）")).toHaveTextContent(NSEC);
  });

  it("[隠す]でマスクへ戻る（平文を出しっぱなしにしない）", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵を表示する" }));
    await user.click(screen.getByRole("button", { name: "秘密鍵を隠す" }));
    const code = screen.getByLabelText("秘密鍵（nsec）");
    expect(code).toHaveTextContent(MASK);
    expect(code.textContent).not.toContain("nsec1");
  });

  it("表示トグルの aria-label がマスク/表示で入れ替わる", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    // マスク時は「表示する」。
    expect(screen.getByRole("button", { name: "秘密鍵を表示する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "秘密鍵を隠す" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "秘密鍵を表示する" }));
    // 表示時は「隠す」。
    expect(screen.getByRole("button", { name: "秘密鍵を隠す" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "秘密鍵を表示する" })).not.toBeInTheDocument();
  });

  // ---- B. クリップボード ----------------------------------------------------

  it("[コピー]はマスク状態でも平文 nsec を writeText に渡す", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    // マスク表示のまま（[表示]を押さずに）コピーする。
    await user.click(screen.getByRole("button", { name: "秘密鍵をコピーする" }));
    expect(writeText).toHaveBeenCalledWith(NSEC);
    writeText.mockRestore();
  });

  it("コピー成功で「コピーしました」が出る", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵をコピーする" }));
    expect(await screen.findByText("コピーしました")).toBeInTheDocument();
    writeText.mockRestore();
  });

  it("「コピーしました」は約2秒後に消える", async () => {
    // fake timers は mount 後に入れる（mount 時の async effect / userEvent の内部遅延が
    // 偽タイマーで固まるため）。アクションは fireEvent + act で timer 依存なしに行う。
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ProfileEditor />);
    fireEvent.click(screen.getByRole("button", { name: /編集/ }));
    vi.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "秘密鍵をコピーする" }));
      });
      expect(screen.getByText("コピーしました")).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      writeText.mockRestore();
    }
  });

  it("writeText 失敗時は「コピーしました」を出さず黙る（エラーも console も増やさない）", async () => {
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockRejectedValue(new Error("denied"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵をコピーする" }));
    // catch は無言: 成功文言も出ず、画面にエラー文言も増えない。
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
    writeText.mockRestore();
    consoleError.mockRestore();
  });

  // ---- C. publish 非混入（鍵流出防止・最重要回帰） --------------------------

  it("鍵流出防止: nsec 表示状態で保存しても payload に nsec が混入しない", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵を表示する" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    // 完全一致: nsec を含まない初期 payload のみ（picture:null, about:"", websites:[]）。
    expect(saveProfile).toHaveBeenCalledWith({
      name: "テスト栽培家",
      picture: null,
      about: "",
      websites: [],
    });
  });

  it("鍵流出防止: コピー実行後に保存しても payload は不変（nsec 非混入）", async () => {
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵をコピーする" }));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledTimes(1));
    expect(saveProfile).toHaveBeenCalledWith({
      name: "テスト栽培家",
      picture: null,
      about: "",
      websites: [],
    });
    writeText.mockRestore();
  });

  // ---- D. a11y・配置 --------------------------------------------------------

  it("表示・コピーボタンに aria-label が付く", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    expect(screen.getByRole("button", { name: "秘密鍵を表示する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "秘密鍵をコピーする" })).toBeInTheDocument();
  });

  it("nsec ブロックは保存ボタンより DOM 後方（最下部・最も目立たない位置）", async () => {
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    const save = screen.getByRole("button", { name: "保存" });
    const copy = screen.getByRole("button", { name: "秘密鍵をコピーする" });
    // copy が save の後方にあると FOLLOWING ビットが立つ。
    expect(
      save.compareDocumentPosition(copy) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // ---- E. 任意 --------------------------------------------------------------

  it("鍵未設定でも欄が壊れず、表示で生成鍵の nsec が出る", async () => {
    localStorage.removeItem("hanoba:sk");
    const user = userEvent.setup();
    render(<ProfileEditor />);
    await user.click(screen.getByRole("button", { name: /編集/ }));
    await user.click(screen.getByRole("button", { name: "秘密鍵を表示する" }));
    // getOrCreateSecretKey が生成するので nsec1 プレフィックスが出る。
    expect(screen.getByLabelText("秘密鍵（nsec）").textContent).toMatch(/^nsec1/);
  });
});
