import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { addSavedView } from "../../lib/feed/views.ts";

// #139 段階3 統合: 名前付きビューのチップ tap が DiscoverGrid の既存 ?q= 反映経路（applyView →
// search → writeQueryToUrl → pushState）に正しく乗ることを、DiscoverGrid.test.tsx の流儀
// （client.ts モック・responses マップ・history は replaceState で初期化）に揃えて確認する。
//
// happy-dom 申し送り（DiscoverGrid.test.tsx に準拠）:
// - URL 値比較は new URLSearchParams(window.location.search).get("q") で行う（%23・日本語エンコード差回避）。
// - push/replace 判別は history.length でなく pushState/replaceState の spy 呼び出し回数で行う。
// - spy は render ＋初回検索 await 後に mockClear() してから操作する（mount の正規化分を除外）。afterEach で restore。

const fetchDiscover = vi.fn();
const fetchHanobaFeed = vi.fn();
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscover: (...args: unknown[]) => fetchDiscover(...args),
  fetchHanobaFeed: (...args: unknown[]) => fetchHanobaFeed(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

const responses = new Map<string, FeedPost[]>();
function setResponse(query: string, posts: FeedPost[]) {
  responses.set(query, posts);
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

function currentQ(): string | null {
  return new URLSearchParams(window.location.search).get("q");
}

describe("DiscoverGrid × 名前付きビュー切替（applyView 経由・#139 段階3）", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscover.mockReset();
    fetchDiscover.mockImplementation((q: string) => Promise.resolve(responses.get(q) ?? []));
    fetchHanobaFeed.mockReset();
    fetchHanobaFeed.mockResolvedValue([]);
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    window.history.replaceState(null, "", "/discover");
    // 名前付きビューは localStorage が真実。チップを出すため毎回クリアして仕込む。
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("保存ビューのチップ tap で ?q= がそのビューの query になり、pushState で履歴に積まれる", async () => {
    addSavedView("実生", "#実生");
    setResponse("#実生", [makePost({ id: "m", caption: "実生っ子" })]);
    render(<DiscoverGrid />);
    // 初回の既定検索（#plantstr）が走り終えるのを待ってから操作する。
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));

    // mount の正規化分を除外してから spy を設置。
    const pushSpy = vi.spyOn(window.history, "pushState");
    pushSpy.mockClear();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "実生" }));

    // そのビューの query で検索が走る（applyView → search の非 fromDefault 経路）。
    await waitFor(() => expect(fetchDiscover).toHaveBeenLastCalledWith("#実生"));
    // ?q= が #実生 になる（%23 エンコード差は get("q") で吸収）。
    await waitFor(() => expect(currentQ()).toBe("#実生"));
    // ビュー切替は意図的ナビ＝pushState で積む（戻るで前へ戻れる）。
    expect(pushSpy).toHaveBeenCalled();
  });

  it("「すべて」チップ tap で ?q= が消え、既定検索（#plantstr ∪ t:hanoba）へ戻る", async () => {
    addSavedView("実生", "#実生");
    setResponse("#実生", [makePost({ id: "m", caption: "実生っ子" })]);
    // ?q=#実生 の状態から開始（あるビューが選ばれている）。
    window.history.replaceState(null, "", "/discover?q=" + encodeURIComponent("#実生"));
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#実生"));

    fetchDiscover.mockClear();
    fetchHanobaFeed.mockClear();
    const pushSpy = vi.spyOn(window.history, "pushState");
    pushSpy.mockClear();

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "すべて" }));

    // 既定検索（fromDefault）＝ #plantstr と t:hanoba の両方を呼ぶ。
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));
    expect(fetchHanobaFeed).toHaveBeenCalled();
    // ?q= は消える。
    await waitFor(() => expect(currentQ()).toBeNull());
    // 「すべて」も意図的ナビ＝pushState で積む（既存空クリアの replace と違い戻る対象にする）。
    expect(pushSpy).toHaveBeenCalled();
  });
});
