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

  // #429 退行ロック: 緑楕円（`::before`）は1行目に上下中央で固定する。flex-wrap は max-content 基準で
  // 折り返すため、長い学名が単独で次の flex 行へ落ちて点だけ1行目より上に残るのが真因（self-start/mt-1 では
  // 解けなかった）。点を flex フローから外し**絶対配置**（before:absolute + left-2 + top-2）にして1行目中央へ
  // 固定する。jsdom/happy-dom はレイアウトを計算しないのでピクセル整列は検証できない（実機 blink で確認済・
  // 学名1行目中央=15px に対し点中央=14px）。ここでは絶対配置クラスが付き、旧 flex 揃え（self-center/self-start/
  // mt-1）へ戻っていないことを固定する。
  it("緑楕円は絶対配置で1行目固定（before:absolute + top-2・flex 揃えへ戻さない・#429）", () => {
    render(<FudaList fuda={[fuda()]} />);
    const link = screen.getByRole("link");
    expect(link).toHaveClass("relative");
    expect(link).toHaveClass("before:absolute");
    expect(link).toHaveClass("before:top-2");
    expect(link).toHaveClass("before:left-2");
    // 点(left-2=8px〜14px)〜文字の溝（#437 kako-jun「近すぎる」→ pl-4 から広げた）。詰め直しの退行を固定。
    expect(link).toHaveClass("pl-[1.375rem]");
    expect(link).not.toHaveClass("before:self-center");
    expect(link).not.toHaveClass("before:self-start");
    expect(link).not.toHaveClass("before:mt-1");
  });
});
