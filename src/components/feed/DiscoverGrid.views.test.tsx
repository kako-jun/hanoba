import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { addSavedView } from "../../lib/feed/views.ts";
import { EMPTY_FILTER, serializeFilter, type DiscoverFilter } from "../../lib/feed/discoverFilter.ts";

// #139 段階3 × #131 段階2 統合: 名前付きビューのチップ tap が DiscoverGrid の多軸フィルタ反映経路
// （applyView → applyFilter → pushState）に正しく乗ることを確認する。多軸化後、ビューの query は
// serializeFilter の canonical 文字列（例 "tags=実生"）。旧・単一クエリ（"#実生"）も後方互換で適用できる。
//
// happy-dom 申し送り（DiscoverGrid.test.tsx に準拠）:
// - URL 値比較は new URLSearchParams(window.location.search).get(key) で行う（エンコード差回避）。
// - push/replace 判別は pushState/replaceState の spy 呼び出し回数で行う。
// - spy は render ＋初回取得 await 後に mockClear() してから操作する。afterEach で restore。

const fetchDiscoverFiltered = vi.fn();
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscoverFiltered: (...args: unknown[]) => fetchDiscoverFiltered(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

const responses = new Map<string, FeedPost[]>();
function keyOf(f: DiscoverFilter): string {
  return serializeFilter(f) || "default";
}
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

function param(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

describe("DiscoverGrid × 名前付きビュー切替（applyView 経由・#139 段階3 / #131 段階2）", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) => Promise.resolve(responses.get(keyOf(f)) ?? []));
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    window.history.replaceState(null, "", "/discover");
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("保存ビューのチップ tap でそのビューの多軸フィルタが適用され、pushState で履歴に積まれる", async () => {
    addSavedView("実生", serializeFilter({ ...EMPTY_FILTER, tags: ["実生"] }));
    setResponse({ tags: ["実生"] }, [makePost({ id: "m", caption: "実生っ子" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /絞り込み/ })); // パネルを開く（保存した絞り込みは中）

    const pushSpy = vi.spyOn(window.history, "pushState");
    pushSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "実生" }));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["実生"] })));
    await waitFor(() => expect(param("tags")).toBe("実生"));
    expect(pushSpy).toHaveBeenCalled();
  });

  it("旧形式（#タグ）の保存ビューも後方互換で適用され、active 表示になる（normalizeQuery）", async () => {
    addSavedView("旧実生", "#実生"); // 多軸化前の単一クエリ形式
    setResponse({ tags: ["実生"] }, [makePost({ id: "m", caption: "実生っ子" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /絞り込み/ })); // パネルを開く（保存した絞り込みは中）
    const chip = screen.getByRole("button", { name: "旧実生" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["実生"] })));
    await waitFor(() => expect(param("tags")).toBe("実生"));
    // 旧形式 "#実生" と現在 filter の canonical "tags=実生" を normalizeQuery で同一視 → チップが active。
    await waitFor(() => expect(screen.getByRole("button", { name: "旧実生" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("「すべて」チップ tap でフィルタが空に戻り、既定表示へ（pushState で積む）", async () => {
    addSavedView("実生", serializeFilter({ ...EMPTY_FILTER, tags: ["実生"] }));
    setResponse({ tags: ["実生"] }, [makePost({ id: "m", caption: "実生っ子" })]);
    // ?tags=実生 の状態（あるビューが選ばれている）から開始。
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("実生"));
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["実生"] })));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /絞り込み/ })); // パネルを開く（保存した絞り込みは中）

    fetchDiscoverFiltered.mockClear();
    const pushSpy = vi.spyOn(window.history, "pushState");
    pushSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "絞り込みなし" }));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));
    await waitFor(() => expect(param("tags")).toBeNull());
    expect(pushSpy).toHaveBeenCalled();
  });
});
