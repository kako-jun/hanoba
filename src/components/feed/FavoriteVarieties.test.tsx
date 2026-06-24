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
  it("カタログ品種はロード後に学名のみの植物札で出る（#459＝和名は出さない）", async () => {
    const { container } = renderFav(["デラウェア"]);
    // catalog 未ロード中は何も出さない（和名フォールバックは出さない＝二重表示しない）。
    expect(screen.queryByText("デラウェア")).toBeNull();
    // catalog 動的 import 後に学名（Vitis 'Delaware'）の札が出る。
    await waitFor(() => expect(container.textContent).toContain("Vitis"));
    expect(container.textContent).toContain("'Delaware'");
    // 和名「デラウェア」は札に出さない（#459＝札は学名そのもの）。
    expect(container.textContent).not.toContain("デラウェア");
  });

  it("カタログ外の自由入力（学名が引けない）品種は札にしない（#459＝和名へ倒さない）", async () => {
    const { container } = renderFav(["我が家の謎の木"]);
    // catalog ロード後も、学名が引けない名前は札にならない＝何も描画しない（null）。
    // ロードを待つため、ロード後でも何も出ないことを少し待ってから確かめる。
    await waitFor(() => {
      // 何も描画しないので container は空（リンクも和名も出ない）。
      expect(container.querySelector("a")).toBeNull();
    });
    expect(container.textContent).not.toContain("我が家の謎の木");
  });

  it("空配列は何も描画しない", () => {
    const { container } = renderFav([]);
    expect(container.querySelector("a")).toBeNull();
  });
});
