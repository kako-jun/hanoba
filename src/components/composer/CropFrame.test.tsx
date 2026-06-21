import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CropFrame from "./CropFrame.tsx";

afterEach(() => cleanup());

// CropFrame は ReactCrop＋img を含むが、回転コントロールは img のロードに依存せず常に出る。
// 回転の焼き込み（renderInPlaceRotation）は canvas＝browser 専用なので純関数 crop.test と実機 blink で
// 担保し、ここでは **コントロールが onRotate を正しい絶対角で呼ぶ配線**だけを検証する（#314）。
function Harness({ rotation = 0, onRotate }: { rotation?: number; onRotate?: (n: number) => void }) {
  const ref = useRef<HTMLImageElement>(null);
  return <CropFrame src="x.jpg" imgRef={ref} filter={null} onCropComplete={() => {}} rotation={rotation} onRotate={onRotate} />;
}

describe("CropFrame 回転（#314・mypace 方式）", () => {
  it("左/右90°ボタンは現在角 ±90 を onRotate に渡す", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn();
    render(<Harness rotation={10} onRotate={onRotate} />);
    await user.click(screen.getByRole("button", { name: "写真を左に90度回転" }));
    expect(onRotate).toHaveBeenLastCalledWith(-80); // 10 - 90
    await user.click(screen.getByRole("button", { name: "写真を右に90度回転" }));
    expect(onRotate).toHaveBeenLastCalledWith(100); // 10 + 90
  });

  it("±0.5°ボタンは最寄り90度成分＋微調整で onRotate を呼ぶ（90度を保ったまま微調整）", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn();
    render(<Harness rotation={90} onRotate={onRotate} />); // quarter=90, fine=0
    await user.click(screen.getByRole("button", { name: "0.5度 右へ" }));
    expect(onRotate).toHaveBeenLastCalledWith(90.5);
    await user.click(screen.getByRole("button", { name: "0.5度 左へ" }));
    expect(onRotate).toHaveBeenLastCalledWith(89.5);
  });

  it("微調整スライダは最寄り90度成分＋スライダ値を渡す", () => {
    const onRotate = vi.fn();
    render(<Harness rotation={180} onRotate={onRotate} />); // quarter=180
    fireEvent.change(screen.getByLabelText("角度の微調整（0.5度きざみ）"), { target: { value: "3.5" } });
    expect(onRotate).toHaveBeenLastCalledWith(183.5);
  });

  it("onRotate 未指定なら回転コントロールを出さない", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "写真を右に90度回転" })).not.toBeInTheDocument();
  });
});
