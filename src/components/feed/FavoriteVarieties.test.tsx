import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import FavoriteVarieties from "./FavoriteVarieties.tsx";
import { LocaleProvider } from "../../lib/i18n/index.ts";

afterEach(() => cleanup());

function renderFav(varieties: string[]) {
  return render(
    <LocaleProvider value="ja">
      <FavoriteVarieties varieties={varieties} />
    </LocaleProvider>,
  );
}

describe("FavoriteVarieties（#343・好きな品種を投稿の札と同じ FudaList で）", () => {
  it("カタログ品種はロード後に学名＋和名の植物札で出る", async () => {
    const { container } = renderFav(["デラウェア"]);
    // 和名は即出る（catalog 未ロード中も和名のみのフォールバック札を出す＝flash 防止）。
    expect(screen.getByText("デラウェア")).toBeInTheDocument();
    // catalog 動的 import 後に学名（Vitis 'Delaware'）が補われる。
    await waitFor(() => expect(container.textContent).toContain("Vitis"));
    expect(container.textContent).toContain("'Delaware'");
  });

  it("カタログ外の自由入力品種も消さず和名のみの札で出す", async () => {
    const { container } = renderFav(["我が家の謎の木"]);
    await waitFor(() => expect(container.textContent).toContain("我が家の謎の木"));
    // 札（リンク）として出る。学名は付かない。
    expect(container.querySelector("a")).toBeTruthy();
  });

  it("空配列は何も描画しない", () => {
    const { container } = renderFav([]);
    expect(container.querySelector("a")).toBeNull();
  });
});
