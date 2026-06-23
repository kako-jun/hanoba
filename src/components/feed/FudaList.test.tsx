import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Fuda } from "../../lib/plants/fuda.ts";
import FudaList from "./FudaList.tsx";

afterEach(cleanup);

function fuda(over: Partial<Fuda> = {}): Fuda {
  return {
    key: over.key ?? "ブレビカウレ",
    name: over.name ?? "ブレビカウレ",
    sci: over.sci !== undefined ? over.sci : "Pachypodium brevicaule",
    filterTags: over.filterTags ?? ["パキポディウム", "ブレビカウレ"],
  };
}

describe("FudaList", () => {
  it("学名（イタリック併記）＋和名を出し、札の discover 絞り込みリンクになる", () => {
    render(<FudaList fuda={[fuda()]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Pachypodium brevicaule");
    expect(link).toHaveTextContent("ブレビカウレ");
    // 札クリックは属＋品種の AND 絞り込み（discoverTagsHref・空白→_ 正規化）。
    expect(link.getAttribute("href")).toBe(
      `/discover?tags=${encodeURIComponent("パキポディウム")},${encodeURIComponent("ブレビカウレ")}`,
    );
  });

  it("空なら何も描画しない", () => {
    const { container } = render(<FudaList fuda={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // #429 退行ロック: 緑楕円（`::before`）は1行目に上下中央で固定する。学名が2行に折り返したとき
  // `before:self-center` だと札全体（2行分）の中央へズレるため、`before:self-start`＋`before:mt-1` に
  // する。jsdom/happy-dom はレイアウトを計算しないのでピクセル整列は検証できない（最終確認は実機 blink）。
  // ここでは「楕円を1行目揃えにするクラス」が付き、誤って中央揃えへ戻っていないことだけを固定する。
  it("緑楕円は1行目揃え（before:self-start + before:mt-1・self-center へ戻さない・#429）", () => {
    render(<FudaList fuda={[fuda()]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("before:self-start");
    expect(link).toHaveClass("before:mt-1");
    expect(link).not.toHaveClass("before:self-center");
  });
});
