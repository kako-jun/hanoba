import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSavedView, getSavedViews } from "../../lib/feed/views.ts";
import SavedViews from "./SavedViews.tsx";

// SavedViews は内部で useSavedViews（＝localStorage が真実）を購読する。
// happy-dom には localStorage 実体があるので、毎回クリアして独立させる。
// props は currentQuery（?q= の鏡）と onApply（チップ tap の切替コールバック）。
describe("SavedViews（名前付きビューのチップ列・#139 段階3）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("保存ビューが無くても「すべて」チップは常に出る（aria-pressed 付きボタン）", () => {
    render(<SavedViews currentQuery="" onApply={() => {}} />);

    const all = screen.getByRole("button", { name: "すべて" });
    expect(all).toBeInTheDocument();
    expect(all).toHaveAttribute("aria-pressed");
  });

  it("保存ビューがチップ（ボタン）として「すべて」に続けて並ぶ", () => {
    addSavedView("実生", "#実生");
    addSavedView("胴切り", "#胴切り");
    render(<SavedViews currentQuery="" onApply={() => {}} />);

    // それぞれ aria-pressed 付きのチップとして出ている（FilterChips と同じ group+pressed）。
    expect(screen.getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "実生" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "胴切り" })).toBeInTheDocument();
  });

  it("currentQuery が空のとき「すべて」が aria-pressed になる", () => {
    addSavedView("実生", "#実生");
    render(<SavedViews currentQuery="" onApply={() => {}} />);

    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "実生" })).toHaveAttribute("aria-pressed", "false");
  });

  it("currentQuery が保存ビューの query と一致すると、そのチップが aria-pressed になる", () => {
    addSavedView("実生", "#実生");
    addSavedView("胴切り", "#胴切り");
    render(<SavedViews currentQuery="#胴切り" onApply={() => {}} />);

    // 一致したビューだけが押下状態になり、「すべて」は外れる。
    expect(screen.getByRole("button", { name: "すべて" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "実生" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "胴切り" })).toHaveAttribute("aria-pressed", "true");
  });

  it("query 非空かつ未保存のときだけ「このビューを保存」導線が出る", () => {
    // 未保存の検索中（currentQuery 非空・views に該当無し）→ 保存導線あり。
    render(<SavedViews currentQuery="#アガベ" onApply={() => {}} />);
    expect(screen.getByRole("button", { name: "このビューを保存" })).toBeInTheDocument();
  });

  it("query が空（既定検索）のときは保存導線を出さない", () => {
    render(<SavedViews currentQuery="" onApply={() => {}} />);
    expect(screen.queryByRole("button", { name: "このビューを保存" })).not.toBeInTheDocument();
  });

  it("既に保存済みの query のときは保存導線を出さない（二重保存を防ぐ）", () => {
    addSavedView("アガベ", "#アガベ");
    render(<SavedViews currentQuery="#アガベ" onApply={() => {}} />);
    expect(screen.queryByRole("button", { name: "このビューを保存" })).not.toBeInTheDocument();
  });

  it("ラベルを入力して保存すると現在 query のビューが追加される（getSavedViews に増える）", async () => {
    const user = userEvent.setup();
    render(<SavedViews currentQuery="#アガベ" onApply={() => {}} />);

    await user.click(screen.getByRole("button", { name: "このビューを保存" }));
    await user.type(screen.getByRole("textbox", { name: "保存するビューの名前" }), "うちのアガベ");
    await user.click(screen.getByRole("button", { name: "この名前で保存する" }));

    // localStorage（真実）に現在 query で増えている。
    const views = getSavedViews();
    expect(views).toHaveLength(1);
    expect(views[0]!).toMatchObject({ label: "うちのアガベ", query: "#アガベ" });
    // 保存後はチップとして出る。
    expect(screen.getByRole("button", { name: "うちのアガベ" })).toBeInTheDocument();
  });

  it("ラベルが空のあいだ保存ボタンは disabled（空ラベルでは保存できない）", async () => {
    const user = userEvent.setup();
    render(<SavedViews currentQuery="#アガベ" onApply={() => {}} />);

    await user.click(screen.getByRole("button", { name: "このビューを保存" }));
    const save = screen.getByRole("button", { name: "この名前で保存する" });
    // 入力前は空＝disabled。
    expect(save).toBeDisabled();
    // 何か入れると有効化される。
    await user.type(screen.getByRole("textbox", { name: "保存するビューの名前" }), "名");
    expect(save).toBeEnabled();
  });

  it("編集トグルで各チップに × が出て、× クリックでそのビューが削除される", async () => {
    const user = userEvent.setup();
    addSavedView("実生", "#実生");
    render(<SavedViews currentQuery="" onApply={() => {}} />);

    // 編集前は × は出ない。
    expect(screen.queryByRole("button", { name: /を削除する/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "編集" }));

    const del = screen.getByRole("button", { name: "ビュー「実生」を削除する" });
    await user.click(del);

    // localStorage から消え、チップも消える。
    expect(getSavedViews()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "実生" })).not.toBeInTheDocument();
  });

  it("× クリックは親タブの切替（onApply）を発火しない（stopPropagation）", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    addSavedView("実生", "#実生");
    render(<SavedViews currentQuery="" onApply={onApply} />);

    await user.click(screen.getByRole("button", { name: "編集" }));
    await user.click(screen.getByRole("button", { name: "ビュー「実生」を削除する" }));

    // 削除は切替ではない＝onApply は呼ばれない。
    expect(onApply).not.toHaveBeenCalled();
  });

  it("保存ビューのチップ tap で onApply がそのビューの query で呼ばれる", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    addSavedView("実生", "#実生");
    render(<SavedViews currentQuery="" onApply={onApply} />);

    await user.click(screen.getByRole("button", { name: "実生" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith("#実生");
  });

  it("「すべて」チップ tap で onApply が空 query（既定検索）で呼ばれる", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    addSavedView("実生", "#実生");
    render(<SavedViews currentQuery="#実生" onApply={onApply} />);

    await user.click(screen.getByRole("button", { name: "すべて" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith("");
  });
});
