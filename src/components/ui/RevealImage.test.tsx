import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RevealImage from "./RevealImage.tsx";

// 状態遷移（未ロード → loaded）を blur-up のゲートクラスで検証する。
// 純表示コンポーネント＝relay 等の副作用なしなのでモック境界は不要。
function imgOf(): HTMLImageElement {
  return screen.getByRole("img") as HTMLImageElement;
}

describe("RevealImage（#145 blur-up リビール）", () => {
  afterEach(() => {
    cleanup();
  });

  it("初期は未ロード状態：opacity-0 blur-md で隠れている（opacity-100/blur-0 は付かない）", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="植物" />);
    const img = imgOf();
    expect(img).toHaveClass("opacity-0", "blur-md");
    expect(img).not.toHaveClass("opacity-100");
    expect(img).not.toHaveClass("blur-0");
  });

  it("onLoad でリビール：opacity-100 blur-0 になり opacity-0/blur-md が消える", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="植物" />);
    const img = imgOf();
    fireEvent.load(img);
    expect(img).toHaveClass("opacity-100", "blur-0");
    expect(img).not.toHaveClass("opacity-0");
    expect(img).not.toHaveClass("blur-md");
  });

  it("onError でも表示：壊れた画像が opacity-0 で永久に消えない", () => {
    render(<RevealImage src="https://example.com/broken.jpg" alt="壊れた画像" />);
    const img = imgOf();
    expect(img).toHaveClass("opacity-0"); // 発火前は隠れている
    fireEvent.error(img);
    expect(img).toHaveClass("opacity-100", "blur-0");
    expect(img).not.toHaveClass("opacity-0");
    expect(img).not.toHaveClass("blur-md");
  });

  it("キャッシュ済み（complete=true）はマウント時の実測で onLoad 無しでも loaded になる", () => {
    // 実装は useEffect 内で ref.current.complete を読む。happy-dom では complete は
    // プロトタイプ上の configurable な getter なので、マウント前に true 固定へ差し替える。
    // （instance の complete はマウント時点で生成された img を React が ref に挿すため、
    //  プロトタイプ getter を覆ってこの観点の経路＝effect の complete 分岐だけを検証する）
    const proto = window.HTMLImageElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "complete");
    Object.defineProperty(proto, "complete", { configurable: true, get: () => true });
    try {
      render(<RevealImage src="https://example.com/cached.jpg" alt="キャッシュ済み" />);
      // onLoad を一切発火させていないのに loaded＝effect の complete 経路が効いている。
      expect(imgOf()).toHaveClass("opacity-100", "blur-0");
    } finally {
      if (original) Object.defineProperty(proto, "complete", original);
    }
  });

  it("src 変更で再リビール：ロード済みの状態でも別 src に差し替えると opacity-0 blur-md に戻り、再 onLoad で復帰する", () => {
    // jsdom/happy-dom では img.complete が既定 false。よって src 差し替え後の effect は
    // loaded を false に戻し、2枚目以降も「隠して→onLoad でフェード」を踏むことを検証する。
    const { rerender } = render(<RevealImage src="https://example.com/first.jpg" alt="1枚目" />);
    const img = imgOf();
    fireEvent.load(img);
    expect(img).toHaveClass("opacity-100", "blur-0"); // 1枚目はリビール済み

    // 別の未ロード src に差し替え＝effect が complete(=false) を実測して隠す。
    rerender(<RevealImage src="https://example.com/second.jpg" alt="2枚目" />);
    expect(img).toHaveClass("opacity-0", "blur-md");
    expect(img).not.toHaveClass("opacity-100");
    expect(img).not.toHaveClass("blur-0");

    // 2枚目の onLoad で再びリビールする。
    fireEvent.load(img);
    expect(img).toHaveClass("opacity-100", "blur-0");
    expect(img).not.toHaveClass("opacity-0");
    expect(img).not.toHaveClass("blur-md");
  });

  it("src 変更でキャッシュ済み（complete=true）なら未 onLoad でも即表示に戻る", () => {
    // complete をプロトタイプ getter で立て、差し替え後の effect が即 loaded=true にすることを見る。
    // getter は finally で必ず復元する。
    const proto = window.HTMLImageElement.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "complete");
    try {
      const { rerender } = render(<RevealImage src="https://example.com/first.jpg" alt="1枚目" />);
      const img = imgOf();
      fireEvent.load(img);
      expect(img).toHaveClass("opacity-100", "blur-0");

      // ここでキャッシュ済みを模す。差し替え後の effect は complete=true を読み即表示にする。
      Object.defineProperty(proto, "complete", { configurable: true, get: () => true });
      rerender(<RevealImage src="https://example.com/cached-second.jpg" alt="2枚目" />);
      // onLoad を一切発火させていないのに、cached 即表示で opacity-100 を保つ。
      expect(img).toHaveClass("opacity-100", "blur-0");
      expect(img).not.toHaveClass("opacity-0");
    } finally {
      if (original) Object.defineProperty(proto, "complete", original);
      else delete (proto as { complete?: unknown }).complete;
    }
  });

  it("属性透過：decoding=async が付き、loading 既定は lazy", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="植物" />);
    const img = imgOf();
    expect(img).toHaveAttribute("decoding", "async");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("loading=eager 指定時は eager が透過する", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="植物" loading="eager" />);
    expect(imgOf()).toHaveAttribute("loading", "eager");
  });

  it("className 結合順：呼び出し側 className が前置され、transition と motion-reduce 緩和が常に付く", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="植物" className="size-40 object-cover" />);
    const img = imgOf();
    expect(img).toHaveClass("size-40", "object-cover");
    expect(img).toHaveClass("transition-[opacity,filter]");
    expect(img).toHaveClass("motion-reduce:transition-none", "motion-reduce:blur-0");
    // 呼び出し側 className は transition 系より前に置かれる（前置の契約）。
    const cls = img.getAttribute("class") ?? "";
    expect(cls.indexOf("size-40")).toBeLessThan(cls.indexOf("transition-[opacity,filter]"));
  });

  it("motion-reduce 緩和とリビール状態クラスはロード後も共存する", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="植物" />);
    const img = imgOf();
    fireEvent.load(img);
    // ロードで状態クラスが切り替わっても、常時クラスは残る。
    expect(img).toHaveClass("motion-reduce:transition-none", "motion-reduce:blur-0");
    expect(img).toHaveClass("transition-[opacity,filter]", "opacity-100", "blur-0");
  });

  it("alt 透過：渡した alt が反映される", () => {
    render(<RevealImage src="https://example.com/plant.jpg" alt="サボテンの新芽" />);
    expect(screen.getByAltText("サボテンの新芽")).toBeInTheDocument();
  });

  it("装飾画像の空 alt も透過する（presentational img＝role=img を持たない）", () => {
    // alt="" の装飾 img はアクセシブルネームを持たず role=img から外れるので、
    // getByRole ではなく querySelector で取り、alt が空文字で透過していることを見る。
    const { container } = render(<RevealImage src="https://example.com/deco.jpg" alt="" />);
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("alt", "");
  });
});
