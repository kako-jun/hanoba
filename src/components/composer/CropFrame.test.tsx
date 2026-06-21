import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CropFrame from "./CropFrame.tsx";

afterEach(() => cleanup());

// CropFrame は ReactCrop＋img を含むが、回転コントロールは img のロードに依存せず常に出る。
// 回転の焼き込み（renderRotatedCanvas）は canvas＝browser 専用なので純関数 crop.test と実機 blink で担保し、
// ここでは**ボタンが onRotate を正しい delta で呼ぶ配線**だけを検証する。
function Harness({ onRotate }: { onRotate?: (d: 90 | -90) => void }) {
  const ref = useRef<HTMLImageElement>(null);
  return <CropFrame src="x.jpg" imgRef={ref} filter={null} onCropComplete={() => {}} onRotate={onRotate} />;
}

describe("CropFrame 回転（#314）", () => {
  it("左/右90°ボタンが onRotate(-90)/onRotate(90) を呼ぶ", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn();
    render(<Harness onRotate={onRotate} />);
    await user.click(screen.getByRole("button", { name: "写真を左に90度回転" }));
    await user.click(screen.getByRole("button", { name: "写真を右に90度回転" }));
    expect(onRotate.mock.calls).toEqual([[-90], [90]]);
  });

  it("onRotate 未指定なら回転コントロールを出さない", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "写真を右に90度回転" })).not.toBeInTheDocument();
  });
});
