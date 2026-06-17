// ResizableTextarea（#188）の単体テスト。高さクランプ（純関数）・×クリア・キーボードでの高さ調整を見る。
// ひとこと入力欄と自己紹介欄が共有する共通部品なので、両者の挙動の土台をここで固定する。

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import ResizableTextarea, { clampHeight } from "./ResizableTextarea.tsx";

// 制御コンポーネントとして使うためのラッパ。
function Harness(props: {
  initialValue?: string;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  step?: number;
}) {
  const { initialValue = "", ...rest } = props;
  const [value, setValue] = useState(initialValue);
  return (
    <ResizableTextarea
      id="t1"
      label="テスト欄"
      value={value}
      onValueChange={setValue}
      placeholder="ここに入力"
      {...rest}
    />
  );
}

describe("clampHeight（高さクランプ純関数・#188）", () => {
  it("min 未満は min に、max 超は max に丸める", () => {
    expect(clampHeight(50, 104, 360)).toBe(104);
    expect(clampHeight(500, 104, 360)).toBe(360);
  });
  it("範囲内はそのまま返す", () => {
    expect(clampHeight(200, 104, 360)).toBe(200);
    expect(clampHeight(104, 104, 360)).toBe(104);
    expect(clampHeight(360, 104, 360)).toBe(360);
  });
});

describe("ResizableTextarea（#188）", () => {
  afterEach(() => cleanup());

  it("label と id が紐づき getByLabelText で textarea を取得できる", () => {
    render(<Harness />);
    const textarea = screen.getByLabelText("テスト欄") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.id).toBe("t1");
  });

  it("既定の初期高さは 124px、glass・resize-none を持つ", () => {
    render(<Harness />);
    const textarea = screen.getByLabelText("テスト欄") as HTMLTextAreaElement;
    expect(textarea).toHaveStyle({ height: "124px" });
    expect(textarea.className).toContain("glass");
    expect(textarea.className).toContain("resize-none");
  });

  it("ドラッグバー（separator）の矢印キーで高さが step ずつ増減する", () => {
    render(<Harness />);
    const textarea = screen.getByLabelText("テスト欄");
    const handle = screen.getByRole("separator", { name: "入力欄の高さを調整" });

    expect(textarea).toHaveStyle({ height: "124px" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(textarea).toHaveStyle({ height: "140px" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(textarea).toHaveStyle({ height: "124px" });
  });

  it("矢印キーで増やしても max を超えない・減らしても min を下回らない", () => {
    render(<Harness initialHeight={110} minHeight={104} maxHeight={140} step={16} />);
    const textarea = screen.getByLabelText("テスト欄");
    const handle = screen.getByRole("separator", { name: "入力欄の高さを調整" });

    // 110 → 126 → 140（max でクランプ）→ そのまま 140。
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(textarea).toHaveStyle({ height: "126px" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(textarea).toHaveStyle({ height: "140px" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(textarea).toHaveStyle({ height: "140px" });

    // 下げる: 140 → 124 → 108 → 104（min でクランプ）。
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(textarea).toHaveStyle({ height: "124px" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(textarea).toHaveStyle({ height: "108px" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(textarea).toHaveStyle({ height: "104px" });
  });

  it("separator の aria-valuemin/max/now が高さに追従する", () => {
    render(<Harness initialHeight={120} minHeight={100} maxHeight={300} />);
    const handle = screen.getByRole("separator", { name: "入力欄の高さを調整" });
    expect(handle).toHaveAttribute("aria-valuemin", "100");
    expect(handle).toHaveAttribute("aria-valuemax", "300");
    expect(handle).toHaveAttribute("aria-valuenow", "120");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(handle).toHaveAttribute("aria-valuenow", "136");
  });

  it("値が空のときは×ボタンを出さず、入力すると出る", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "入力をクリア" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("テスト欄"), "なにか");
    expect(screen.getByRole("button", { name: "入力をクリア" })).toBeInTheDocument();
  });

  it("×ボタンで値が空になり textarea にフォーカスが戻る", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="消す対象" />);
    const textarea = screen.getByLabelText("テスト欄") as HTMLTextAreaElement;
    await user.click(screen.getByRole("button", { name: "入力をクリア" }));
    expect(textarea.value).toBe("");
    expect(document.activeElement).toBe(textarea);
    // 空になったので×は消える。
    expect(screen.queryByRole("button", { name: "入力をクリア" })).not.toBeInTheDocument();
  });

  it("clearLabel を上書きできる", () => {
    render(
      <ResizableTextarea id="t2" value="x" onValueChange={() => {}} clearLabel="自己紹介をクリア" />,
    );
    expect(screen.getByRole("button", { name: "自己紹介をクリア" })).toBeInTheDocument();
  });

  it("label 省略時は <label> を描かない（CaptionInput のように外でラベルを持つ場合）", () => {
    const { container } = render(<ResizableTextarea id="t3" value="" onValueChange={() => {}} />);
    expect(container.querySelector("label")).toBeNull();
  });
});
