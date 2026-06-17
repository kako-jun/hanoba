// CaptionInput の #165 キャレット制御テスト。
//
// focusEndSignal（タグチップ挿入/解除の合図）が変わったら textarea を focus し
// キャレットを本文末尾へ送る。0（初期値）では発火しない。手打ち補完（applyCandidate）は
// この経路を通らず従来どおりキャレット位置で確定する——を検証する。
//
// rAF は happy-dom でも発火するが、focus/setSelectionRange を同期で確定させるため
// requestAnimationFrame を即時実行へ差し替える（flush）。

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CaptionInput from "./CaptionInput.tsx";

// value/onChange を持つ制御コンポーネント。テストから caption と focusEndSignal を動かす。
function Harness({ initialValue = "", pool = [] as string[] }: { initialValue?: string; pool?: string[] }) {
  const [value, setValue] = useState(initialValue);
  const [signal, setSignal] = useState(0);
  return (
    <div>
      <CaptionInput value={value} onChange={setValue} pool={pool} focusEndSignal={signal} />
      {/* テスト操作用: 親から caption を末尾追記しつつ signal を increment（チップ挿入相当）。 */}
      <button type="button" onClick={() => { setValue((v) => `${v}\n#アガベ `); setSignal((n) => n + 1); }}>
        chip-insert
      </button>
      {/* caption を変えずに signal だけ increment（=signal 単独の挙動を見る）。 */}
      <button type="button" onClick={() => setSignal((n) => n + 1)}>signal-only</button>
    </div>
  );
}

describe("CaptionInput focusEndSignal（#165）", () => {
  beforeEach(() => {
    // rAF を即時実行にして focus/setSelectionRange を同期確定させる。
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("focusEndSignal が 0→1 に変わると textarea が focus されキャレットが本文末尾へ行く", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="開花した" />);
    const textarea = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;

    // 初期状態: focus されていない。
    expect(document.activeElement).not.toBe(textarea);

    // チップ挿入相当（value 末尾追記 + signal increment）。
    await user.click(screen.getByRole("button", { name: "chip-insert" }));

    expect(document.activeElement).toBe(textarea);
    // 追記後の value 長へキャレットが寄る（末尾）。
    expect(textarea.value).toBe("開花した\n#アガベ ");
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });

  it("caption を変えず signal だけ increment しても末尾へ寄る（解除でタグ行が縮む場合の整合）", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="水やり #アガベ " />);
    const textarea = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;

    await user.click(screen.getByRole("button", { name: "signal-only" }));

    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });

  it("初期 focusEndSignal=0 ではマウント時に focus もキャレット移動もしない", () => {
    render(<CaptionInput value="メモ" onChange={() => {}} pool={[]} focusEndSignal={0} />);
    const textarea = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;
    expect(document.activeElement).not.toBe(textarea);
  });

  it("focusEndSignal を渡さない（undefined→既定 0）でもマウント時に発火しない", () => {
    render(<CaptionInput value="メモ" onChange={() => {}} pool={[]} />);
    const textarea = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;
    expect(document.activeElement).not.toBe(textarea);
  });

  it("signal が 1→2 と続けて増えても毎回末尾へ寄る", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="開花した" />);
    const textarea = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;

    await user.click(screen.getByRole("button", { name: "chip-insert" }));
    expect(textarea.value).toBe("開花した\n#アガベ ");
    expect(textarea.selectionStart).toBe(textarea.value.length);

    // 既に #アガベ が居るので chip-insert は重ねて積む（value がさらに伸びる）。
    await user.click(screen.getByRole("button", { name: "chip-insert" }));
    expect(textarea.selectionStart).toBe(textarea.value.length);
    expect(textarea.selectionEnd).toBe(textarea.value.length);
  });
});

describe("CaptionInput 手打ち補完のキャレット（focusEndSignal 経路を通らない・#165 退行防止）", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("候補確定後のキャレットは末尾ではなく挿入直後（従来位置）に留まる", async () => {
    const user = userEvent.setup();
    // value/onChange 制御で「#アガ」を打ち、候補をクリックして確定する。
    function Wrap() {
      const [value, setValue] = useState("");
      // focusEndSignal は渡さない（手打ち経路がそれに依存しないことを示す）。
      return <CaptionInput value={value} onChange={setValue} pool={["アガベ"]} />;
    }
    render(<Wrap />);
    const textarea = screen.getByLabelText("ひとこと") as HTMLTextAreaElement;

    // 「先 #アガ」を打つ。キャレットは末尾＝#アガ の直後なので補完ポップアップが開く。
    await user.type(textarea, "先 #アガ");

    // 候補 "#アガベ" を選択（onMouseDown で確定）。
    const option = await screen.findByRole("button", { name: "#アガベ" });
    fireEvent.mouseDown(option);

    // 置換結果: "先 " + "#アガベ " = "先 #アガベ "。今回は末尾＝挿入直後で一致するが、
    // 重要なのは applyCandidate が「value.length」ではなく before+inserted で算出すること。
    expect(textarea.value).toBe("先 #アガベ ");
    // 挿入直後（before.length=2 + "#アガベ ".length=5 = 7）にキャレットが置かれる。
    // applyCandidate は value.length ではなく before+inserted で算出する＝末尾送りとは別経路。
    expect(textarea.selectionStart).toBe(7);
    expect(textarea.selectionEnd).toBe(7);
  });
});

describe("CaptionInput a11y: aria-required（#151）", () => {
  afterEach(() => {
    cleanup();
  });

  it("textarea は aria-required=\"true\" を持つ（必須入力をスクリーンリーダーに伝える）", () => {
    render(<CaptionInput value="" onChange={() => {}} pool={[]} />);
    // label(htmlFor)→textarea の紐付けが健全なら getByLabelText で取得できる（CI-2 内包）。
    const textarea = screen.getByLabelText("ひとこと");
    expect(textarea).toHaveAttribute("aria-required", "true");
  });

  it("aria-required は value 空でも非空でも常に \"true\"（未入力時限定でない＝静的属性）", () => {
    const { rerender } = render(<CaptionInput value="" onChange={() => {}} pool={[]} />);
    expect(screen.getByLabelText("ひとこと")).toHaveAttribute("aria-required", "true");

    // value を非空にしても aria-required は外れない（条件付きでない静的属性であることを固定）。
    rerender(<CaptionInput value="開花した" onChange={() => {}} pool={[]} />);
    expect(screen.getByLabelText("ひとこと")).toHaveAttribute("aria-required", "true");
  });
});
