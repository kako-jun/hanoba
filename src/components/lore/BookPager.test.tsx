import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookPager, { type BookPagerPage } from "./BookPager.tsx";
import { APP_STORAGE_KEY, type BookPageField } from "../../lib/storage/appStorage.ts";

// 本ページャー（#164）。CityHallBook/GazetteBook から抽出した共通 UI をデータ非依存の
// 最小 fixture で駆動する。ページ内容の言語・意味は問わず、ページャーの機構
// （先頭/前/次/末尾・URL/集約 blob 同期・キーボード矢印・スワイプ・空配列防御）だけを守る。
// 永続化は集約 blob（appStorage）の gazettePage / handbookPage フィールド（#558）。

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

/** 集約 blob に本のページ位置を種撒きする（既存フィールドを保つマージ）。 */
function seedPage(field: BookPageField, id: string): void {
  const cur = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? "{}");
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ ...cur, [field]: id }));
}

/** 集約 blob から本のページ位置を読む。 */
function readPage(field: BookPageField): string | null {
  return JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? "{}")[field] ?? null;
}

/** field → 対応する「前回訪問時点の総ページ数」フィールド名（appStorage.ts の内部命名と同じ）。 */
function seenCountField(field: BookPageField): string {
  return field === "gazettePage" ? "gazettePageCount" : "handbookPageCount";
}

/** 集約 blob に本の前回訪問時点の総ページ数を種撒きする（新着検知用・#562・既存フィールドを保つマージ）。 */
function seedSeenCount(field: BookPageField, count: number): void {
  const cur = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? "{}");
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ ...cur, [seenCountField(field)]: count }));
}

/** 集約 blob から本の前回訪問時点の総ページ数を読む。未設定は null。 */
function readSeenCount(field: BookPageField): number | null {
  return JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? "{}")[seenCountField(field)] ?? null;
}

function renderPager(
  items: Fixture[],
  field: BookPageField = "gazettePage",
  defaultPage?: "first" | "last",
) {
  return render(
    <BookPager
      title="テスト本"
      pages={items}
      storageField={field}
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
    renderPager(pages(1));
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeDisabled();
  });

  it("pages2件以上・先頭ページで前系のみdisabled、次系はenabled", () => {
    renderPager(pages(2));
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeEnabled();
  });

  it("中間ページ（3件以上のfixture）は前後ともenabled", async () => {
    const user = userEvent.setup();
    renderPager(pages(3));
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeEnabled();
  });

  it("末尾ページで次系のみdisabled", async () => {
    const user = userEvent.setup();
    renderPager(pages(3));
    await user.click(screen.getByRole("button", { name: "最後のページ" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "最初のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "最後のページ" })).toBeDisabled();
  });

  it("末尾を超えて次へ・先頭を超えて前へを連打してもページ番号は1〜totalPagesにクランプされ続ける（goToの範囲外ガードの回帰確認）", async () => {
    const user = userEvent.setup();
    renderPager(pages(3));
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
      const { unmount } = renderPager(fixture);
      await user.click(screen.getByRole("button", { name: "次のページ" }));
      expect(screen.getByText("2 / 3")).toBeInTheDocument();
      expect(screen.getByText("Two")).toBeInTheDocument();
      unmount();
    }
  });

  it("URLの?page=<id>と一致する要素があれば初期表示をそのページにする", async () => {
    history.replaceState(null, "", "/test?page=p3");
    renderPager(pages(3));
    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
  });

  it("URLに存在しないidを渡すと1ページ目にフォールバックする", () => {
    history.replaceState(null, "", "/test?page=does-not-exist");
    renderPager(pages(3));
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("URLにも保存位置にも有効なidがない場合、defaultPage=\"last\"なら最終ページにフォールバックする", async () => {
    seedPage("gazettePage", "deleted-page");
    history.replaceState(null, "", "/test?page=does-not-exist");
    renderPager(pages(3), "gazettePage", "last");
    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
  });

  it("集約 blob の保存idのみで再訪した場合、そのページから再開する", async () => {
    seedPage("gazettePage", "p2");
    renderPager(pages(3));
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
  });

  it("defaultPage=\"last\"でも有効な保存位置が優先される", async () => {
    seedPage("gazettePage", "p2");
    renderPager(pages(3), "gazettePage", "last");
    expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Page 2")).toBeInTheDocument();
  });

  it("URL指定と保存位置指定が両方あるとき、URLが優先される", async () => {
    seedPage("gazettePage", "p2");
    history.replaceState(null, "", "/test?page=p3");
    renderPager(pages(3));
    expect(await screen.findByText("3 / 3")).toBeInTheDocument();
  });

  // 新着検知（#562）。hasNewContent = seenCount !== null && totalPages > seenCount。
  // 「前回訪問時より本のページ数が増えた」ときだけ保存位置を無視して defaultPage へ飛ばす。
  describe("新着検知（seenCount・#562）", () => {
    it("seenCount未設定（#562導入前の既存ユーザー）で保存位置があれば、新着扱いされず保存位置を尊重する（移行安全性）", async () => {
      // seenCountを種撒きしない＝#562導入前からの既存ユーザーを模す。
      seedPage("gazettePage", "p2");
      renderPager(pages(3), "gazettePage", "last");
      expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    });

    it("seenCount・保存位置とも無い純粋初回訪問はdefaultPageへ（従来挙動の維持）", () => {
      renderPager(pages(3));
      expect(screen.getByText("1 / 3")).toBeInTheDocument();
    });

    it("seenCount===totalPages（同値）のときは新着扱いされず保存位置を尊重する（`>`の境界）", async () => {
      seedSeenCount("gazettePage", 3);
      seedPage("gazettePage", "p2");
      renderPager(pages(3), "gazettePage", "last");
      expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    });

    it("seenCount===totalPages-1のときは新着扱いとなり保存位置を無視してdefaultPageへ飛ぶ（境界のすぐ内側）", async () => {
      seedSeenCount("gazettePage", 2);
      seedPage("gazettePage", "p2");
      renderPager(pages(3), "gazettePage", "last");
      // 保存位置(p2=2/3)ではなくdefaultPage="last"（3/3）へ。
      expect(await screen.findByText("3 / 3")).toBeInTheDocument();
    });

    it("seenCount===totalPages+1（記事が減った）でもクラッシュせず保存位置を尊重する", async () => {
      seedSeenCount("gazettePage", 4);
      seedPage("gazettePage", "p2");
      expect(() => renderPager(pages(3), "gazettePage", "last")).not.toThrow();
      expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    });

    it("新着ありでも保存位置が既に無効(削除済みID)ならdefaultPageへ安全にフォールバックする", async () => {
      seedSeenCount("gazettePage", 1);
      seedPage("gazettePage", "deleted-page");
      renderPager(pages(3), "gazettePage", "last");
      expect(await screen.findByText("3 / 3")).toBeInTheDocument();
    });

    it("URL指定が有効なときは、新着ありでもURL指定が最優先される", async () => {
      seedSeenCount("gazettePage", 1);
      history.replaceState(null, "", "/test?page=p2");
      renderPager(pages(3), "gazettePage", "last");
      // 新着ジャンプ先(defaultPage="last"=3/3)ではなくURL指定(2/3)になる。
      expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    });

    it("初期解決後、必ず現在の総ページ数がseenCountとして保存される（次回訪問の新着判定の副作用）", async () => {
      renderPager(pages(3));
      expect(await screen.findByText("1 / 3")).toBeInTheDocument();
      expect(readSeenCount("gazettePage")).toBe(3);
    });

    it("市民手帳（handbookPage・固定10ページ）は本変更で挙動が変わらない（過去に壊れやすい事故パターンの回帰）", async () => {
      // 手帳はページ数が変わらないので、一度訪問済み（seenCount===totalPages）なら
      // 常に「新着なし」＝保存位置がそのまま尊重され続ける（defaultPage既定=first の従来挙動）。
      seedSeenCount("handbookPage", 10);
      seedPage("handbookPage", "p5");
      renderPager(pages(10), "handbookPage");
      expect(await screen.findByText("5 / 10")).toBeInTheDocument();
    });

    it("壊れたgazettePageCount（文字列・配列等）が保存されていても新着判定は「未設定」扱いとなり例外を投げない", async () => {
      localStorage.setItem(
        APP_STORAGE_KEY,
        JSON.stringify({ gazettePage: "p2", gazettePageCount: "not-a-number" }),
      );
      expect(() => renderPager(pages(3), "gazettePage", "last")).not.toThrow();
      // seenCount=null扱い→hasNewContent=false→保存位置(p2=2/3)を尊重。
      expect(await screen.findByText("2 / 3")).toBeInTheDocument();
    });

    it("状態遷移: 初回訪問(保存)→記事が増える→新着ジャンプ(seenCount更新)→件数据え置きの再訪では保存位置に復帰する", async () => {
      const user = userEvent.setup();

      // 1回目訪問（記事3件・seenCount未設定の純粋初回）。defaultPage="last"でp3へ。
      const visit1 = renderPager(pages(3), "gazettePage", "last");
      expect(await screen.findByText("3 / 3")).toBeInTheDocument();
      expect(readSeenCount("gazettePage")).toBe(3);
      // p3から1つ戻ってp2で読むのをやめた、という状況を作る。
      await user.click(within(visit1.container).getByRole("button", { name: "前のページ" }));
      expect(readPage("gazettePage")).toBe("p2");
      visit1.unmount();

      // 記事が1件増えて4件になった状態で2回目訪問。トップ導線からの再訪を模して?page=は
      // 付かない状態に戻す（goToがURLへ?page=を書き込む＝前回操作の?page=p2が残ったままだと
      // URL指定が優先されてしまい新着ジャンプを検証できないため）。
      // seenCount(3) < totalPages(4)＝新着あり。保存位置(p2)は無視され、defaultPage="last"の
      // 最新記事(p4)へジャンプする。
      history.replaceState(null, "", "/test");
      const visit2 = renderPager(pages(4), "gazettePage", "last");
      expect(await screen.findByText("4 / 4")).toBeInTheDocument();
      expect(readSeenCount("gazettePage")).toBe(4);
      // 読んだ後p3まで戻った、という状況を作る。
      await user.click(within(visit2.container).getByRole("button", { name: "前のページ" }));
      expect(readPage("gazettePage")).toBe("p3");
      visit2.unmount();

      // 記事数据え置き（4件のまま）で3回目訪問。ここも?page=を持たない再訪を模す。
      // seenCount(4) === totalPages(4)＝新着なし。defaultPage="last"（p4）ではなく、
      // 保存位置(p3)に復帰する。
      history.replaceState(null, "", "/test");
      renderPager(pages(4), "gazettePage", "last");
      expect(await screen.findByText("3 / 4")).toBeInTheDocument();
    });
  });

  it("ページ送り後storageFieldに現在ページのidが保存される。異なるstorageField同士は互いに書き込みを汚染しない（2インスタンス同時マウント）", async () => {
    const user = userEvent.setup();
    const a = renderPager(pages(3), "gazettePage");
    const b = renderPager(pages(3), "handbookPage");
    expect(readPage("gazettePage")).toBe("p1");
    expect(readPage("handbookPage")).toBe("p1");

    await user.click(within(a.container).getByRole("button", { name: "次のページ" }));
    expect(readPage("gazettePage")).toBe("p2");
    expect(readPage("handbookPage")).toBe("p1");
    // 汚染されていない側の表示も1ページ目のまま。
    expect(within(b.container).getByText("1 / 3")).toBeInTheDocument();
  });

  it("ページ送りしても本文パネルへ自動スクロールしない", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
    renderPager(pages(3));

    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();

    const panel = document.querySelector('[aria-live="polite"]')!.parentElement!;
    fireEvent.touchStart(panel, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 200, clientY: 100 }] });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("ArrowLeft/ArrowRightでページが変わるが、フォーカスがinput上のときは矢印を奪わない", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <input aria-label="よそのフォーム欄" />
        <BookPager
          title="テスト本"
          pages={pages(3)}
          storageField="gazettePage"
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
    renderPager(pages(3));
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
      render(<BookPager title="テスト本" pages={[]} storageField="gazettePage" renderPage={renderPage} />),
    ).not.toThrow();
    expect(renderPage).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
  });
});
