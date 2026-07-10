import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookPager, { type BookPagerPage } from "./BookPager.tsx";

// 本ページャー（#164）。CityHallBook/GazetteBook から抽出した共通 UI をデータ非依存の
// 最小 fixture で駆動する。ページ内容の言語・意味は問わず、ページャーの機構
// （先頭/前/次/末尾・URL/localStorage 同期・キーボード矢印・スワイプ・空配列防御）だけを守る。

interface Fixture extends BookPagerPage {
  label: string;
}

/** n件のページ（id="p1".."pN"・page=1..n）を持つ最小fixture。 */
function pages(n: number): Fixture[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    page: i + 1,
    label: `Page ${i + 1}`,
  }));
}

function renderPager(items: Fixture[], storageKey: string, defaultPage?: "first" | "last") {
  return render(
    <BookPager
      title="テスト本"
      pages={items}
      storageKey={storageKey}
      defaultPage={defaultPage}
      renderPage={(page) => <p>{page.label}</p>}
    />,
  );
}

describe("BookPager（#164）", () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, "", "/test");
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("pages1件のとき先頭/末尾/前/次ボタンが全てdisabled", () => {
    renderPager(pages(1), "k8");
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeDisabled();
  });

  it("pages2件以上・先頭ページで前系のみdisabled、次系はenabled", () => {
    renderPager(pages(2), "k9");
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeEnabled();
  });

  it("中間ページ（3件以上のfixture）は前後ともenabled", async () => {
    const user = userEvent.setup();
    renderPager(pages(3), "k10");
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeEnabled();
  });

  it("末尾ページで次系のみdisabled", async () => {
    const user = userEvent.setup();
    renderPager(pages(3), "k11");
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeDisabled();
  });

  it("末尾を超えて次へ・先頭を超えて前へを連打してもページ番号は1〜totalPagesにクランプされ続ける（goToの範囲外ガードの回帰確認）", async () => {
    const user = userEvent.setup();
    renderPager(pages(3), "k12");
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "最初のページ" }));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("pages配列を昇順id・降順idそれぞれで与えても「次へ」クリックはpage+1にしか作用しない（idの並びに依存しない設計の直接検証）", async () => {
    const ascIdFixture: Fixture[] = [
      { id: "a1", page: 1, label: "One" },
      { id: "a2", page: 2, label: "Two" },
      { id: "a3", page: 3, label: "Three" },
    ];
    const descIdFixture: Fixture[] = [
      { id: "c1", page: 1, label: "One" },
      { id: "b2", page: 2, label: "Two" },
      { id: "a3", page: 3, label: "Three" },
    ];
    for (const fixture of [ascIdFixture, descIdFixture]) {
      const user = userEvent.setup();
      const { unmount } = renderPager(fixture, `k13-${fixture[0]!.id}`);
      await user.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(screen.getByText("Two")).toBeInTheDocument();
      unmount();
    }
  });

  it("URLの?page=<id>と一致する要素があれば初期表示をそのページにする", async () => {
    history.replaceState(null, "", "/test?page=p3");
    renderPager(pages(3), "k14");
    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
  });

  it("URLに存在しないidを渡すと1ページ目にフォールバックする", () => {
    history.replaceState(null, "", "/test?page=does-not-exist");
    renderPager(pages(3), "k15");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("URLにも保存位置にも有効なidがない場合、defaultPage=\"last\"なら最終ページにフォールバックする", async () => {
    localStorage.setItem("k15-last", "deleted-page");
    history.replaceState(null, "", "/test?page=does-not-exist");
    renderPager(pages(3), "k15-last", "last");
    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
  });

  it("localStorageの保存idのみで再訪した場合、そのページから再開する", async () => {
    localStorage.setItem("k16", "p2");
    renderPager(pages(3), "k16");
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
  });

  it("defaultPage=\"last\"でも有効なlocalStorage保存位置が優先される", async () => {
    localStorage.setItem("k16-last", "p2");
    renderPager(pages(3), "k16-last", "last");
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
  });

  it("URL指定とlocalStorage指定が両方あるとき、URLが優先される", async () => {
    localStorage.setItem("k17", "p2");
    history.replaceState(null, "", "/test?page=p3");
    renderPager(pages(3), "k17");
    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
  });

  it("ページ送り後storageKeyに現在ページのidが保存される。異なるstorageKey同士は互いに書き込みを汚染しない（2インスタンス同時マウント）", async () => {
    const user = userEvent.setup();
    const a = renderPager(pages(3), "k18-a");
    const b = renderPager(pages(3), "k18-b");
    expect(localStorage.getItem("k18-a")).toBe("p1");
    expect(localStorage.getItem("k18-b")).toBe("p1");

    await user.click(within(a.container).getByRole("button", { name: "次のページ" }));
    expect(localStorage.getItem("k18-a")).toBe("p2");
    expect(localStorage.getItem("k18-b")).toBe("p1");
    // 汚染されていない側の表示も1ページ目のまま。
    expect(within(b.container).getByText("1 / 3")).toBeInTheDocument();
  });

  it("ArrowLeft/ArrowRightでページが変わるが、フォーカスがinput上のときは矢印を奪わない", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <input aria-label="よそのフォーム欄" />
        <BookPager
          title="テスト本"
          pages={pages(3)}
          storageKey="k19"
          renderPage={(page) => <p>{page.label}</p>}
        />
      </div>,
    );
    screen.getByLabelText("よそのフォーム欄").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("タッチスワイプ: 左スワイプ→次へ、右スワイプ→前へ、縦優位または閾値未満は無反応", () => {
    renderPager(pages(3), "k20");
    const panel = document.querySelector('[aria-live="polite"]')!.parentElement!;

    // 左スワイプ（dx=-100・閾値40超・水平優位）→ 次へ。
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // 右スワイプ（dx=+100）→ 前へ。
    fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 200, clientY: 100 }] });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // 縦優位（|dy|>=|dx|）→ 無反応。
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 100, clientY: 250 }] });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    // 閾値未満（|dx|=20<=40）→ 無反応。
    fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 120, clientY: 100 }] });
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("pages=[]のとき、クラッシュせず安全に空描画される（防御的ガードの検証）", () => {
    const renderPage = vi.fn();
    expect(() =>
      render(<BookPager title="テスト本" pages={[]} storageKey="k21" renderPage={renderPage} />),
    ).not.toThrow();
    expect(renderPage).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
