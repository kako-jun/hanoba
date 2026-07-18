import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// nsec バックアップ念押しモーダル（#558 nit）。セキュリティ観点を明示で押さえる:
// (1) reveal 前は実 nsec を DOM に出さずマスクする、(2) reveal で実 nsec を出す、
// (3) 閉じるで onClose、(4) publish/ネットワーク送信を一切しない（exportNsec とクリップボード以外の
// 副作用が無い）。keys.ts は exportNsec だけモックし、他の鍵ロジックには触れない。
const FAKE_NSEC = "nsec1testtesttesttesttesttesttesttesttesttesttesttesttestqqqqqqq";
const exportNsec = vi.fn(() => FAKE_NSEC);
vi.mock("../../lib/nostr/keys.ts", () => ({
  exportNsec: () => exportNsec(),
}));

import NsecBackupPrompt from "./NsecBackupPrompt.tsx";

describe("NsecBackupPrompt（#558 nit・reveal 初期非表示）", () => {
  // クリップボード書き込みのスパイ（実書き込みはしない）。userEvent.setup() は独自の clipboard スタブを
  // 差すため、コピー検証は fireEvent.click で走らせてこのスパイを直接見る。
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    exportNsec.mockClear();
    writeText.mockClear();
    // navigator.clipboard は getter のみなので defineProperty で差す。
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  });

  afterEach(() => cleanup());

  it("初期表示は nsec をマスクし、実 nsec 文字列を DOM に出さない（reveal 前）", () => {
    render(<NsecBackupPrompt onClose={vi.fn()} />);
    const code = screen.getByLabelText("秘密鍵（nsec）");
    // マスク（• の連なり）で、実 nsec は含まない。
    expect(code.textContent).toMatch(/^•+$/);
    expect(code.textContent).not.toContain(FAKE_NSEC);
    expect(document.body.textContent).not.toContain(FAKE_NSEC);
    // reveal 前は exportNsec を読まない（bech32 の遅延エンコード）。
    expect(exportNsec).not.toHaveBeenCalled();
  });

  it("[表示] トグルで実 nsec を表示する", async () => {
    const user = userEvent.setup();
    render(<NsecBackupPrompt onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "秘密鍵を表示する" }));
    expect(screen.getByLabelText("秘密鍵（nsec）").textContent).toBe(FAKE_NSEC);
  });

  it("[控えました]（主アクション）で onClose を呼ぶ", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NsecBackupPrompt onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "控えました" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("[あとで]（副アクション）でも onClose を呼ぶ", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<NsecBackupPrompt onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "あとで" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("publish/送信は一切しない — [コピー] はクリップボード書き込みのみ（外向き副作用なし）", async () => {
    render(<NsecBackupPrompt onClose={vi.fn()} />);
    // fireEvent（userEvent の clipboard スタブを噛ませない）でボタンを押し、自前スパイを直接見る。
    fireEvent.click(screen.getByRole("button", { name: "秘密鍵をコピーする" }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(FAKE_NSEC));
    // ネットワーク publish 用のモックは存在しない（client.ts を import しない＝送信経路を持たない）。
  });
});
