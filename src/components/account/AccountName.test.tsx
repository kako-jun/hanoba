import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ネットワークはモック境界で止める（実 relay を呼ばない）。
// keys.ts は実物のまま localStorage（hanoba:name）で初期状態を作る。
// #93: 取り込みは単発でなく fetchMyProfileResilient を使う。
const saveDisplayName = vi.fn();
const fetchMyProfileResilient = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  saveDisplayName: (...args: unknown[]) => saveDisplayName(...args),
  fetchMyProfileResilient: (...args: unknown[]) => fetchMyProfileResilient(...args),
}));

import AccountName from "./AccountName.tsx";

describe("AccountName（#92 ハンドルネーム表記＋クリアボタン）", () => {
  beforeEach(() => {
    saveDisplayName.mockReset().mockResolvedValue(undefined);
    fetchMyProfileResilient.mockReset().mockResolvedValue(null);
    localStorage.clear();
  });

  afterEach(() => cleanup());

  it("未設定でマウントすると edit モードで「ハンドルネーム」入力欄が出る", () => {
    render(<AccountName />);
    expect(screen.getByLabelText("ハンドルネーム")).toBeInTheDocument();
  });

  it("設定済みでマウントすると display で名前と「ハンドルネームを変更」が出る", () => {
    localStorage.setItem("hanoba:name", "アガベ太郎");
    render(<AccountName />);
    expect(screen.getByText("アガベ太郎")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ハンドルネームを変更" })).toBeInTheDocument();
  });

  it("bare では glass カードを描かず、操作ボタンは名前の下段に並ぶ（#104）", () => {
    localStorage.setItem("hanoba:name", "アガベ太郎");
    const { container } = render(<AccountName bare />);
    // 外側のガラスカードは親（統合カード）に委ねる。
    expect(container.querySelector(".glass")).toBeNull();
    // 名前と操作（変更/アカウント変更）が縦積みの flex-col に入る＝名前の下段にボタン。
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("flex-col");
    expect(screen.getByRole("button", { name: "ハンドルネームを変更" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アカウントを変更" })).toBeInTheDocument();
  });

  it("「ハンドルネームを変更」押下で既存名を初期値に edit へ遷移する", async () => {
    localStorage.setItem("hanoba:name", "アガベ太郎");
    const user = userEvent.setup();
    render(<AccountName />);
    await user.click(screen.getByRole("button", { name: "ハンドルネームを変更" }));
    expect(screen.getByLabelText("ハンドルネーム")).toHaveValue("アガベ太郎");
  });

  it("edit で入力して保存すると saveDisplayName が呼ばれ display に戻る", async () => {
    const user = userEvent.setup();
    render(<AccountName />);
    await user.type(screen.getByLabelText("ハンドルネーム"), "新太郎");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(saveDisplayName).toHaveBeenCalledWith("新太郎");
    expect(screen.getByText("新太郎")).toBeInTheDocument();
    expect(screen.queryByLabelText("ハンドルネーム")).not.toBeInTheDocument();
  });

  it("【境界】未設定 edit 直後（draft 空）は「入力をクリア」ボタンが無い", () => {
    render(<AccountName />);
    expect(screen.queryByRole("button", { name: "入力をクリア" })).toBeNull();
  });

  it("【境界】1 文字入力すると「入力をクリア」ボタンが現れる", async () => {
    const user = userEvent.setup();
    render(<AccountName />);
    await user.type(screen.getByLabelText("ハンドルネーム"), "あ");
    expect(screen.getByRole("button", { name: "入力をクリア" })).toBeInTheDocument();
  });

  it("【境界往復】×押下で入力が空になり、×ボタンが消える", async () => {
    const user = userEvent.setup();
    render(<AccountName />);
    await user.type(screen.getByLabelText("ハンドルネーム"), "あいう");
    await user.click(screen.getByRole("button", { name: "入力をクリア" }));
    expect(screen.getByLabelText("ハンドルネーム")).toHaveValue("");
    expect(screen.queryByRole("button", { name: "入力をクリア" })).toBeNull();
  });

  it("×押下直後、name 入力欄にフォーカスが戻る", async () => {
    const user = userEvent.setup();
    render(<AccountName />);
    await user.type(screen.getByLabelText("ハンドルネーム"), "あ");
    await user.click(screen.getByRole("button", { name: "入力をクリア" }));
    expect(screen.getByLabelText("ハンドルネーム")).toHaveFocus();
  });

  it("display モードでは「入力をクリア」ボタンが存在しない", () => {
    localStorage.setItem("hanoba:name", "アガベ太郎");
    render(<AccountName />);
    expect(screen.queryByRole("button", { name: "入力をクリア" })).toBeNull();
  });

  it("【異常/同値】空白のみ入力は ×は出るが保存しても saveDisplayName を呼ばない", async () => {
    const user = userEvent.setup();
    render(<AccountName />);
    await user.type(screen.getByLabelText("ハンドルネーム"), "   ");
    expect(screen.getByRole("button", { name: "入力をクリア" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(saveDisplayName).not.toHaveBeenCalled();
  });

  it("promptLabel 未指定なら「ハンドルネームは？」（新デフォルト回帰）", () => {
    render(<AccountName />);
    expect(screen.getByText("ハンドルネームは？")).toBeInTheDocument();
  });

  it("promptLabel を渡すとそのラベルが描画される（上書きが効く）", () => {
    render(<AccountName promptLabel="テスト用ラベル" />);
    expect(screen.getByText("テスト用ラベル")).toBeInTheDocument();
    expect(screen.queryByText("ハンドルネームは？")).toBeNull();
  });

  it("edit のヒント文に本名想起回避の文言が出る", () => {
    render(<AccountName />);
    expect(
      screen.getByText("ハンドルネームを決めると、見るだけでなく投稿できます。"),
    ).toBeInTheDocument();
  });

  it("マウント時に onChange が現在名で呼ばれる（設定済み→値／未設定→null）", () => {
    const onChangeSet = vi.fn();
    localStorage.setItem("hanoba:name", "アガベ太郎");
    render(<AccountName onChange={onChangeSet} />);
    expect(onChangeSet).toHaveBeenCalledWith("アガベ太郎");

    cleanup();
    localStorage.clear();
    const onChangeUnset = vi.fn();
    render(<AccountName onChange={onChangeUnset} />);
    expect(onChangeUnset).toHaveBeenCalledWith(null);
  });

  it("保存すると onChange がトリム後の新名で呼ばれる", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<AccountName onChange={onChange} />);
    onChange.mockClear(); // マウント時の null 呼び出しを除く
    await user.type(screen.getByLabelText("ハンドルネーム"), "  新太郎  ");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onChange).toHaveBeenCalledWith("新太郎");
  });

  // #93: 取り込みは resilient fetch で relay の websites を掴み、控えにシードする。
  // 単発取得だと取りこぼして websites:[] を焼き、編集欄にサイトが出ない原因になっていた。
  it("nsec 取り込みで relay の websites を控えにシードする（#93）", async () => {
    const reload = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    fetchMyProfileResilient.mockResolvedValue({
      name: "みどり園",
      picture: null,
      about: null,
      websites: ["https://midori-en.example.com", "https://x.com/midori_test"],
    });
    const user = userEvent.setup();
    render(<AccountName />);
    await user.click(screen.getByRole("button", { name: "すでにアカウントをお持ちですか？" }));
    await user.type(
      screen.getByLabelText("nsec 秘密鍵"),
      "nsec1d75nkk0cywkgsz35zjnxtmhkqsgaxvzv927sv7ndzanl00pfhprqlaqwz7",
    );
    await user.click(screen.getByRole("button", { name: "続ける" }));
    await waitFor(() => {
      const extra = JSON.parse(localStorage.getItem("hanoba:profileExtra") ?? "{}");
      expect(extra.websites).toEqual([
        "https://midori-en.example.com",
        "https://x.com/midori_test",
      ]);
    });
    expect(fetchMyProfileResilient).toHaveBeenCalled();
    reload.mockRestore();
  });
});
