import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PostFAB from "./PostFAB.tsx";

// /compose での非表示はサーバ側（MainLayout の isCompose 条件）なので、
// コンポーネント単体テストの対象外（実機/手動で確認）。ここは常駐リンクの体裁だけ検証する。
describe("PostFAB（#283）", () => {
  afterEach(() => {
    cleanup();
  });

  it("/compose へのリンクで aria-label を持つ", () => {
    render(<PostFAB />);
    const link = screen.getByRole("link", { name: "投稿する" });
    expect(link).toHaveAttribute("href", "/compose");
  });

  it("右下隅（ScrollToTop の左隣）に塗り緑の円形 FAB として固定配置される", () => {
    render(<PostFAB />);
    const link = screen.getByRole("link", { name: "投稿する" });
    // 主要クラス（固定配置・円形・塗り緑・ScrollToTop の左スロット）を持つ。
    for (const cls of ["fixed", "bottom-5", "right-[4.75rem]", "rounded-full", "bg-ha-green", "text-ha-white"]) {
      expect(link).toHaveClass(cls);
    }
  });
});
