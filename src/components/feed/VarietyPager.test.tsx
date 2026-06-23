import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import VarietyPager from "./VarietyPager.tsx";
import type { RankedVariety } from "../../lib/feed/ranking.ts";
import { t as translate } from "../../lib/i18n/index.ts";

afterEach(() => cleanup());

const t = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) =>
  translate("ja", key, params);

function makeVarieties(n: number): RankedVariety[] {
  return Array.from({ length: n }, (_, i) => ({
    key: `k${i}`,
    name: `品種${i}`,
    sci: null,
    count: 1,
    filterTags: [`品種${i}`],
  }));
}

describe("VarietyPager（育てた品種の横ページング・#388）", () => {
  it("10 件以下はページャ UI を出さず全件並べる（退行なし）", () => {
    render(<VarietyPager varieties={makeVarieties(10)} t={t} />);
    // 10 件すべてのチップが出る。
    expect(screen.getAllByRole("link")).toHaveLength(10);
    // ←→ボタン（aria-label）もインジケータも出ない。
    expect(screen.queryByLabelText("次のページ")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("前のページ")).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("11 件は 2 ページ・現在ページの 10 件だけ描画しページャを出す", () => {
    render(<VarietyPager varieties={makeVarieties(11)} t={t} />);
    // 現在ページ（先頭）は 10 件だけ＝DOM 有界。
    expect(screen.getAllByRole("link")).toHaveLength(10);
    expect(screen.getByLabelText("次のページ")).toBeInTheDocument();
    expect(screen.getByLabelText("前のページ")).toBeInTheDocument();
    // インジケータ 1 / 2（SR 告知の live region＝role="status" で位置を確認。視覚側は aria-hidden の二重表示）。
    expect(screen.getByRole("status")).toHaveTextContent("1 / 2");
  });

  it("先頭では「前へ」は disabled（端クランプ・非 wrap）", () => {
    render(<VarietyPager varieties={makeVarieties(11)} t={t} />);
    expect(screen.getByLabelText("前のページ")).toBeDisabled();
    expect(screen.getByLabelText("次のページ")).not.toBeDisabled();
  });

  it("「次へ」で 2 ページ目へ＝残り 1 件を描画し、末尾で「次へ」disabled", () => {
    render(<VarietyPager varieties={makeVarieties(11)} t={t} />);
    fireEvent.click(screen.getByLabelText("次のページ"));
    // 最終ページは端数 1 件。
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("2 / 2");
    expect(screen.getByLabelText("次のページ")).toBeDisabled();
    expect(screen.getByLabelText("前のページ")).not.toBeDisabled();
  });

  it("1000 件でも現在ページは 10 件だけ描画（縦に積まない＝節が有界）", () => {
    render(<VarietyPager varieties={makeVarieties(1000)} t={t} />);
    expect(screen.getAllByRole("link")).toHaveLength(10);
    expect(screen.getByRole("status")).toHaveTextContent("1 / 100");
  });
});
