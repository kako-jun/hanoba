import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
