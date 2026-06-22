import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ReactCrop の実ドラッグは getBoundingClientRect / pointer 計測に依存し happy-dom では onComplete が発火しない。
// crop の clamp/座標の正しさは crop.test が担保するので、ここでは ReactCrop を「children をそのまま描き、
// onChange/onComplete をテストから叩ける薄いダミー」に差し替えて、CropFrame の配線（どの経路が fromUser=true/false か）
// だけを検証する。centerCrop/makeAspectCrop は本物の挙動が要る（初期クロップ算出）ので実モジュールから借りる。
vi.mock("react-image-crop", async () => {
  const actual = await vi.importActual<typeof import("react-image-crop")>("react-image-crop");
  const ReactCrop = ({
    children,
    onComplete,
  }: {
    children?: React.ReactNode;
    onChange?: (...args: unknown[]) => void;
    onComplete?: (pixelCrop: unknown, percentCrop: unknown) => void;
    [key: string]: unknown;
  }) => (
    <div className="ReactCrop">
      {/* ユーザーのドラッグ/リサイズ終了を模す（テストから click で onComplete を発火）。 */}
      <button
        type="button"
        data-testid="reactcrop-complete"
        onClick={() =>
          onComplete?.(
            { unit: "px", x: 0, y: 0, width: 50, height: 50 },
            { unit: "%", x: 10, y: 10, width: 50, height: 50 },
          )
        }
      />
      {children}
    </div>
  );
  return { ...actual, default: ReactCrop };
});

import CropFrame from "./CropFrame.tsx";

afterEach(() => cleanup());

// CropFrame は ReactCrop＋img を含むが、回転コントロールは img のロードに依存せず常に出る。
// 回転の焼き込み（renderInPlaceRotation）は canvas＝browser 専用なので純関数 crop.test と実機 blink で
// 担保し、ここでは **コントロールが onRotate を正しい絶対角で呼ぶ配線**だけを検証する（#314）。
function Harness({
  rotation = 0,
  onRotate,
  onRotateGestureEnd,
  onCropComplete = () => {},
}: {
  rotation?: number;
  onRotate?: (n: number, continuous?: boolean) => void;
  onRotateGestureEnd?: () => void;
  onCropComplete?: (crop: unknown, fromUser: boolean) => void;
}) {
  const ref = useRef<HTMLImageElement>(null);
  return (
    <CropFrame
      src="x.jpg"
      imgRef={ref}
      filter={null}
      onCropComplete={onCropComplete}
      rotation={rotation}
      onRotate={onRotate}
      onRotateGestureEnd={onRotateGestureEnd}
    />
  );
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

  // #403: ±0.5°ボタンは離散＝continuous=false で呼ぶ（各クリックを親で1手に積ませる）。
  it("±0.5°ボタンは最寄り90度成分＋微調整で onRotate を呼ぶ（90度を保ったまま微調整・離散=false）", async () => {
    const user = userEvent.setup();
    const onRotate = vi.fn();
    render(<Harness rotation={90} onRotate={onRotate} />); // quarter=90, fine=0
    await user.click(screen.getByRole("button", { name: "0.5度 右へ" }));
    expect(onRotate).toHaveBeenLastCalledWith(90.5, false);
    await user.click(screen.getByRole("button", { name: "0.5度 左へ" }));
    expect(onRotate).toHaveBeenLastCalledWith(89.5, false);
  });

  // #403: 微調整スライダは連続入力＝continuous=true で呼ぶ（親で1ドラッグを1手に畳ませる）。
  it("微調整スライダは最寄り90度成分＋スライダ値を渡す（連続=true）", () => {
    const onRotate = vi.fn();
    render(<Harness rotation={180} onRotate={onRotate} />); // quarter=180
    fireEvent.change(screen.getByLabelText("角度の微調整（0.5度きざみ）"), { target: { value: "3.5" } });
    expect(onRotate).toHaveBeenLastCalledWith(183.5, true);
  });

  // #403: スライダのドラッグ終端（pointerUp 等）で onRotateGestureEnd を呼ぶ（親が畳み込みをリセット）。
  it("スライダのドラッグ終端で onRotateGestureEnd を呼ぶ（pointerUp/mouseUp/touchEnd/keyUp・#403）", () => {
    const onRotateGestureEnd = vi.fn();
    render(<Harness rotation={0} onRotate={() => {}} onRotateGestureEnd={onRotateGestureEnd} />);
    const slider = screen.getByLabelText("角度の微調整（0.5度きざみ）");
    fireEvent.pointerUp(slider);
    fireEvent.mouseUp(slider);
    fireEvent.touchEnd(slider);
    fireEvent.keyUp(slider);
    expect(onRotateGestureEnd).toHaveBeenCalledTimes(4);
  });

  it("onRotate 未指定なら回転コントロールを出さない", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "写真を右に90度回転" })).not.toBeInTheDocument();
  });
});

// #393: onCropComplete は (crop, fromUser) の2引数で呼ばれる。crop の値の正しさは crop.test（computeSquareCropRect）が
// 担保し、ここでは「どの経路がユーザー由来(fromUser=true)で、どの経路がプログラム由来(false)か」だけを検証する。
describe("CropFrame クロップ確定の由来フラグ（#393）", () => {
  /** happy-dom の <img> は寸法が 0 なので、commitCrop の 0 除算を避けるため自然/表示寸法を与える。 */
  function sizeImg(img: HTMLImageElement) {
    Object.defineProperty(img, "naturalWidth", { configurable: true, value: 100 });
    Object.defineProperty(img, "naturalHeight", { configurable: true, value: 100 });
    Object.defineProperty(img, "width", { configurable: true, value: 100 });
    Object.defineProperty(img, "height", { configurable: true, value: 100 });
  }

  it("画像ロード（onImageLoad）の初期 commit は fromUser=false で呼ぶ（自動クロップはアンドゥ対象外）", () => {
    const onCropComplete = vi.fn();
    render(<Harness onCropComplete={onCropComplete} />);
    const img = screen.getByAltText("クロップ対象の写真") as HTMLImageElement;
    sizeImg(img);
    fireEvent.load(img);
    expect(onCropComplete).toHaveBeenCalledTimes(1);
    expect(onCropComplete.mock.calls[0]![1]).toBe(false);
  });

  it("ユーザーのドラッグ/リサイズ終了（ReactCrop onComplete）は fromUser=true で呼ぶ（本命のアンドゥ対象）", () => {
    const onCropComplete = vi.fn();
    render(<Harness onCropComplete={onCropComplete} />);
    const img = screen.getByAltText("クロップ対象の写真") as HTMLImageElement;
    sizeImg(img);
    // 初期 commit（fromUser=false）を一度通してから、ユーザー操作の確定（ReactCrop onComplete）を起こす。
    fireEvent.load(img);
    onCropComplete.mockClear();
    fireEvent.click(screen.getByTestId("reactcrop-complete"));
    expect(onCropComplete).toHaveBeenCalledTimes(1);
    // 確定はユーザー由来＝fromUser=true。
    expect(onCropComplete.mock.calls.at(-1)![1]).toBe(true);
  });

  it("90度成分（quarter）変更の clamp 再 commit は fromUser=false で呼ぶ（回転の副作用はアンドゥ対象外）", () => {
    const onCropComplete = vi.fn();
    const { rerender } = render(<Harness rotation={0} onRotate={() => {}} onCropComplete={onCropComplete} />);
    const img = screen.getByAltText("クロップ対象の写真") as HTMLImageElement;
    sizeImg(img);
    fireEvent.load(img); // 初期 commit（false）で crop を確定させる。
    onCropComplete.mockClear();
    // quarter が 0→1 に変わる回転で clamp 再 commit が走る。
    rerender(<Harness rotation={90} onRotate={() => {}} onCropComplete={onCropComplete} />);
    expect(onCropComplete).toHaveBeenCalled();
    // quarter 由来の再 commit はすべてプログラム由来＝fromUser=false。
    for (const call of onCropComplete.mock.calls) expect(call[1]).toBe(false);
  });
});
