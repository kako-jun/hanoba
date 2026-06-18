import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { EMPTY_FILTER, serializeFilter, type DiscoverFilter } from "../../lib/feed/discoverFilter.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。多軸フィルタ（#131/#139 段階2）化で
// 取得は単一の fetchDiscoverFiltered(filter) に集約された（旧 fetchDiscover/fetchHanobaFeed の
// 既定マージは engine 内部へ移動）。応答は filter の canonical 文字列をキーに引く。
const fetchDiscoverFiltered = vi.fn();
// PostDetail がマウント時に呼ぶいいね数取得もモックで止める（#12）。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscoverFiltered: (...args: unknown[]) => fetchDiscoverFiltered(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
  // コメント欄（#142）は検証対象外なので空（コメント0件）で固定。
  fetchReplies: () => Promise.resolve([]),
  // 著者プロフィール一括取得（#35）。テストでは空 Map（npub フォールバック表示）。
  fetchProfiles: () => Promise.resolve(new Map()),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

// 検索ボックスの aria-label（タグ/キーワード両対応・#24）。
const SEARCH_BOX = "植物のタグ・本文キーワード・@ユーザー名 または npub";

// filter → canonical 文字列をキーに応答を引く。既定（空）は "default"。
const responses = new Map<string, FeedPost[]>();
function keyOf(f: DiscoverFilter): string {
  return serializeFilter(f) || "default";
}
/** 部分指定の filter（EMPTY からの差分）に応答を登録する。 */
function setResponse(partial: Partial<DiscoverFilter>, posts: FeedPost[]) {
  responses.set(keyOf({ ...EMPTY_FILTER, ...partial }), posts);
}

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    caption: overrides.caption ?? "",
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
  };
}

describe("DiscoverGrid", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) => Promise.resolve(responses.get(keyOf(f)) ?? []));
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    // 各テストで URL のクエリを空に戻す（既定検索の経路を通す）。
    window.history.replaceState(null, "", "/discover");
  });

  afterEach(() => {
    cleanup();
  });

  it("初回（パラメータ無し）は既定フィルタで自動取得して写真を並べる（#22）", async () => {
    setResponse({}, [makePost({ id: "x", caption: "観葉1" }), makePost({ id: "y", caption: "観葉2" })]);
    render(<DiscoverGrid />);

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER);
  });

  it("既定取得が 0 件なら idle（案内文・カードを出さない）に戻す", async () => {
    render(<DiscoverGrid />); // 既定は未登録＝[]

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));
    await waitFor(() => expect(screen.queryByText(/探しています/)).not.toBeInTheDocument());
    expect(screen.queryByText(/「探す」を押すと/)).not.toBeInTheDocument();
    expect(document.querySelector("article")).toBeNull();
    expect(screen.getByRole("button", { name: "探す" })).toBeInTheDocument();
  });

  it("× ボタンで検索文字を全消しできる（#60）", async () => {
    const user = userEvent.setup();
    render(<DiscoverGrid />);

    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    expect(screen.queryByRole("button", { name: "検索文字を消す" })).not.toBeInTheDocument();
    await user.type(box, "アガベ");
    expect(box.value).toBe("アガベ");
    const clearBtn = screen.getByRole("button", { name: "検索文字を消す" });
    expect(clearBtn).toHaveAttribute("type", "button");
    await user.click(clearBtn);
    expect(box.value).toBe("");
    expect(screen.queryByRole("button", { name: "検索文字を消す" })).not.toBeInTheDocument();
  });

  it("キーワード（# 無し）で検索すると keyword 軸に乗せて取得する（本文検索・#24）", async () => {
    const user = userEvent.setup();
    setResponse({ keyword: "葉焼け" }, [
      makePost({ id: "a", caption: "葉焼けした" }),
      makePost({ id: "b", caption: "また葉焼け" }),
    ]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "葉焼け");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "葉焼け", tags: [] }));
  });

  it("先頭 # 付きは tags 軸に足し、検索ボックスは空にする（チップへ移った）", async () => {
    const user = userEvent.setup();
    setResponse({ tags: ["パキポ"] }, [makePost({ id: "p", caption: "パキポ" })]);
    render(<DiscoverGrid />);

    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await user.type(box, "#パキポ");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["パキポ"] })));
    expect(box.value).toBe("");
  });

  it("0 件なら見つからない文言を出す（フィルタ要約つき）", async () => {
    const user = userEvent.setup();
    render(<DiscoverGrid />); // サボテンは未登録＝[]

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "サボテン");
    await user.click(screen.getByRole("button", { name: "探す" }));

    expect(await screen.findByText(/「サボテン」の投稿は見つかりませんでした/)).toBeInTheDocument();
  });

  it("セルクリックで PostDetail（dialog）を開く", async () => {
    const user = userEvent.setup();
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "開花した" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花した" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("詳細内のタグクリックでそのタグに絞り込む（他軸リセット・tags 軸）", async () => {
    const user = userEvent.setup();
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "開花 #パキポ", hashtags: ["パキポ"] })]);
    setResponse({ tags: ["パキポ"] }, [makePost({ id: "z", caption: "別のパキポ" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花 #パキポ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["パキポ"], keyword: "" }));
  });

  it("URL の ?q= があればマウント時に keyword 軸へ復元する（既定は流さない）", async () => {
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));
    expect(await screen.findAllByRole("img")).toHaveLength(1);
    expect(fetchDiscoverFiltered).not.toHaveBeenCalledWith(EMPTY_FILTER);
  });

  it("旧 ?tag= リンクも後方互換で tags 軸へ復元する", async () => {
    setResponse({ tags: ["アガベ"] }, [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?tag=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["アガベ"] })));
  });

  it("構造化 URL（?tags=&author=&sort=）を多軸で復元する（#131/#139 段階2）", async () => {
    const post = makePost({ id: "m", caption: "複合", hashtags: ["トマト", "実生"] });
    setResponse({ tags: ["トマト", "実生"], sort: "old" }, [post]);
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト,実生") + "&sort=old");
    render(<DiscoverGrid />);

    await waitFor(() =>
      expect(fetchDiscoverFiltered).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ["トマト", "実生"], sort: "old" }),
      ),
    );
  });
});

// #139 段階2/1: 多軸フィルタを pushState/popstate で戻る・進む復元できる deep-link 化。
//
// happy-dom 固有の申し送り（必ず守る）:
// - history.back()/forward() は happy-dom で popstate を発火しない。popstate テストは必ず2手:
//   (1) replaceState で URL を遷移先にセット → (2) dispatchEvent(new PopStateEvent("popstate"))。順序厳守。
// - push/replace の判別は history.length でなく pushState/replaceState の spy 呼び出し回数で行う。
// - spy は render ＋初回取得 await 後に mockClear() してから操作する（mount の正規化分を除外）。afterEach で restore。
// - URL 値比較は new URLSearchParams(window.location.search).get(key) 経由で行う（エンコード表記差を避ける）。
describe("DiscoverGrid deep-link (多軸 pushState/popstate)", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) => Promise.resolve(responses.get(keyOf(f)) ?? []));
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    window.history.replaceState(null, "", "/discover");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function popTo(url: string) {
    window.history.replaceState(null, "", url); // (1) URL を遷移先にセット
    window.dispatchEvent(new PopStateEvent("popstate")); // (2) popstate を発火
  }

  function param(key: string): string | null {
    return new URLSearchParams(window.location.search).get(key);
  }

  it("popstate「戻る」で前の keyword に復元し、検索ボックスも同期する", async () => {
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "アガベ" })]);
    setResponse({ keyword: "パキポ" }, [makePost({ id: "p", caption: "パキポ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));

    popTo("/discover?q=パキポ");

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "パキポ" })));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("パキポ"));
  });

  it("popstate「進む」で進み先の keyword に復元し、検索ボックスも同期する", async () => {
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "アガベ" })]);
    setResponse({ keyword: "新語" }, [makePost({ id: "n", caption: "新語" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));

    popTo("/discover?q=新語");

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "新語" })));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("新語"));
  });

  it("パラメータ無しの popstate は既定フィルタへ戻し、検索ボックスは空のまま", async () => {
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("アガベ"));

    fetchDiscoverFiltered.mockClear();
    popTo("/discover"); // q 削除 → 既定へ戻す

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));
    expect(box.value).toBe("");
  });

  it("popstate 復元では URL を再書き込みしない（pushState・replaceState ともに 0 回・ループ防止）", async () => {
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "アガベ" })]);
    setResponse({ keyword: "X" }, [makePost({ id: "x", caption: "X" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));

    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    fetchDiscoverFiltered.mockClear();

    window.history.replaceState(null, "", "/discover?q=X"); // テスト操作（spy 除外のため後でクリア）
    pushSpy.mockClear();
    replaceSpy.mockClear();
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "X" })));
    expect(pushSpy).toHaveBeenCalledTimes(0);
    expect(replaceSpy).toHaveBeenCalledTimes(0);
  });

  it("旧 ?tag= マウントは ?tags= へ replaceState で正規化する（pushState は呼ばない）", async () => {
    setResponse({ tags: ["アガベ"] }, [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?tag=アガベ");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["アガベ"] })));
    await waitFor(() => expect(param("tags")).toBe("アガベ"));
    expect(param("tag")).toBeNull();
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(0);
  });

  it("空クリア submit は ?q= を replace で消す（pushState は呼ばない・idle に戻る）", async () => {
    const user = userEvent.setup();
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "アガベ" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));

    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await user.type(box, "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(param("q")).toBe("アガベ"));

    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    pushSpy.mockClear();
    replaceSpy.mockClear();

    await user.clear(box);
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(param("q")).toBeNull());
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(0);
    await waitFor(() => expect(screen.queryByRole("img")).not.toBeInTheDocument());
    expect(box.value).toBe("");
  });

  it("詳細のタグ絞り込みは push し、popstate で前の検索語へ戻れる", async () => {
    const user = userEvent.setup();
    setResponse({ keyword: "アガベ" }, [makePost({ id: "a", caption: "開花 #パキポ", hashtags: ["パキポ"] })]);
    setResponse({ tags: ["パキポ"] }, [makePost({ id: "z", caption: "別のパキポ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花 #パキポ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["パキポ"] })));
    await waitFor(() => expect(param("tags")).toBe("パキポ"));
    expect(param("q")).toBeNull(); // 他軸リセットで keyword は消える

    // push が戻る対象＝popstate で前の語（アガベ）へ復元できる。
    popTo("/discover?q=アガベ");
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: "アガベ" })));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("アガベ"));
  });

  it("連続 popstate は最後の語の結果だけ描画する（先行の遅延応答は破棄・latestRef）", async () => {
    const slowPost = makePost({ id: "slow", caption: "遅い語の結果" });
    const fastPost = makePost({ id: "fast", caption: "速い語の結果" });
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) => {
      if (f.keyword === "遅い語") {
        return new Promise<FeedPost[]>((resolve) => setTimeout(() => resolve([slowPost]), 80));
      }
      if (f.keyword === "速い語") return Promise.resolve([fastPost]);
      return Promise.resolve([]); // 既定など
    });
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));

    popTo("/discover?q=遅い語");
    popTo("/discover?q=速い語");

    expect(await screen.findByRole("img")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "速い語の結果" })).toBeInTheDocument());
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByRole("button", { name: "速い語の結果" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "遅い語の結果" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("error 再試行は履歴を積まない（pushState・replaceState ともに 0 回・navigate:none）", async () => {
    const user = userEvent.setup();
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) => {
      if (f.keyword === "" && f.tags.length === 0 && f.author === "") return Promise.resolve([]); // 既定は空（idle）
      return Promise.reject(new Error("relay down"));
    });
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);

    const retry = await screen.findByRole("button", { name: "再試行" });
    expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument();

    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    pushSpy.mockClear();
    replaceSpy.mockClear();
    fetchDiscoverFiltered.mockClear();

    await user.click(retry);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ keyword: "アガベ" })));
    expect(pushSpy).toHaveBeenCalledTimes(0);
    expect(replaceSpy).toHaveBeenCalledTimes(0);
  });
});
