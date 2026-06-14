import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ネットワークはモック境界で止める（実 relay・実アップロードを呼ばない）。
const fetchMyProfile = vi.fn();
const saveProfile = vi.fn();
const uploadImage = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyProfile: (...args: unknown[]) => fetchMyProfile(...args),
  saveProfile: (...args: unknown[]) => saveProfile(...args),
}));
vi.mock("../../lib/nostr/upload.ts", () => ({
  uploadImage: (...args: unknown[]) => uploadImage(...args),
}));

import ProfileEditor from "./ProfileEditor.tsx";

describe("ProfileEditor (#35 Piece3)", () => {
  beforeEach(() => {
    fetchMyProfile.mockReset().mockResolvedValue(null);
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
    expect(screen.getByText("先に上でユーザー名を設定してください。")).toBeInTheDocument();
  });
});
