import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { EMPTY_FILTER, type DiscoverFilter } from "../../lib/feed/discoverFilter.ts";

// relay 取得はモック境界で止める。discover は #239 で「品種で絞るだけ」になり、取得は
// fetchDiscoverFiltered(tags のみの filter) に集約。応答は filter の canonical 文字列をキーに引く。
const fetchDiscoverFiltered = vi.fn();
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscoverFiltered: (...args: unknown[]) => fetchDiscoverFiltered(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
  // カードのいいね/コメント数（#276 / #462・統合バッチ）はグリッド単位取得。この検証では空 Map（カードに数を出さない）。
  fetchEngagementCountsBatch: () => Promise.resolve({ reactions: new Map(), comments: new Map() }),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

const responses = new Map<string, FeedPost[]>();
function keyOf(f: DiscoverFilter): string {
  return f.tags.join(",") || "default";
}
function setResponse(partial: Partial<DiscoverFilter>, posts: FeedPost[]) {
  responses.set(keyOf({ ...EMPTY_FILTER, ...partial }), posts);
}

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    // 画像の alt はキャプション。空だと <img alt=""> ＝ role="presentation" になり getAllByRole("img")
    // で拾えないので、テストの既定は非空にする（実投稿はキャプション必須＝#155）。
    caption: overrides.caption ?? "植物",
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
    shotDates: [],  };
}

function param(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}
function popTo(url: string) {
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

describe("DiscoverGrid（品種で絞るだけ・#239）", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) => Promise.resolve(responses.get(keyOf(f)) ?? []));
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    window.history.replaceState(null, "", "/discover");
    window.localStorage.clear();
    localStorage.setItem("hanoba:lang", "ja"); // #147: clear 後も locale は ja 固定（テストは原典で検証）
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("未選択は みんなの植物（既定）を新着順で出す", async () => {
    setResponse({}, [makePost({ id: "x" }), makePost({ id: "y" })]);
    render(<DiscoverGrid />);

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER);
  });

  it("既定スコープの読込サマリは loc(選択言語)で組む＝SSR種 lang=en でも ja 表示なら『みんなの植物』(#399)", async () => {
    // hanoba:lang=ja（beforeEach）・lang prop は既定 en（DEFAULT_LOCALE）。取得を pending のままにして
    // loading 文言「「{summary}」を探しています…」を観測する。summary が lang(en) で組まれていた頃は
    // 「Everyone's Plants」と英語が漏れていた（#399）。loc(ja) で組めば既定スコープ名は「みんなの植物」。
    let resolveFetch: (v: FeedPost[]) => void = () => {};
    fetchDiscoverFiltered.mockImplementation(() => new Promise<FeedPost[]>((r) => (resolveFetch = r)));
    render(<DiscoverGrid />);
    // loc は mount 後 effect で ja に解決＝読込サマリが ja の既定スコープ名で出る。
    expect(await screen.findByText(/「みんなの植物」を探して/)).toBeInTheDocument();
    expect(screen.queryByText(/Everyone's Plants/)).not.toBeInTheDocument();
    resolveFetch([]); // pending を解消し、state 更新を flush（act 警告を残さない）。
    await waitFor(() => expect(screen.queryByText(/探して/)).not.toBeInTheDocument());
  });

  it("既定が 0 件なら idle（案内・カードを出さない）。品種で絞る UI は出す", async () => {
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));
    expect(screen.queryByText(/探しています/)).not.toBeInTheDocument();
    expect(document.querySelector("article")).toBeNull();
    // 旧・検索ボックス/探すボタンは廃止。品種で絞る（TagPicker filter モード）だけが出る。
    expect(screen.queryByRole("button", { name: "探す" })).not.toBeInTheDocument();
    expect(screen.getByText("品種で絞る")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "植物から選ぶ" })).toBeInTheDocument();
  });

  it("?tags= で品種を復元して取得し、選択チップを出す", async () => {
    setResponse({ tags: ["トマト"] }, [makePost({ id: "a" })]);
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト"));
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["トマト"] })));
    expect(await screen.findAllByRole("img")).toHaveLength(1);
    expect(fetchDiscoverFiltered).not.toHaveBeenCalledWith(EMPTY_FILTER);
    expect(screen.getByRole("button", { name: "「トマト」を外す" })).toBeInTheDocument();
  });

  it("選択チップの × で品種を外すと既定に戻る", async () => {
    const user = userEvent.setup();
    setResponse({ tags: ["トマト"] }, [makePost({ id: "a" })]);
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト"));
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["トマト"] })));

    await user.click(screen.getByRole("button", { name: "「トマト」を外す" }));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(EMPTY_FILTER));
    await waitFor(() => expect(param("tags")).toBeNull());
  });

  it("検索で自由タグを足せる（カタログに無い語＝そのまま使う）→ その品種で取得", async () => {
    const user = userEvent.setup();
    setResponse({ tags: ["葉焼け"] }, [makePost({ id: "h" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));

    await user.click(screen.getByRole("button", { name: "植物から選ぶ" }));
    await user.type(screen.getByRole("textbox", { name: "タグを検索" }), "葉焼け");
    await user.click(await screen.findByRole("button", { name: "そのまま #葉焼け を使う" }));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["葉焼け"] })));
    await waitFor(() => expect(param("tags")).toBe("葉焼け"));
    expect(screen.getByRole("button", { name: "「葉焼け」を外す" })).toBeInTheDocument();
  });

  it("複数語のタグは本文と同じく空白を _ に正規化して絞り込む（#239 レビュー）", async () => {
    const user = userEvent.setup();
    setResponse({ tags: ["テスト_タグ"] }, [makePost({ id: "m" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(EMPTY_FILTER));

    await user.click(screen.getByRole("button", { name: "植物から選ぶ" }));
    await user.type(screen.getByRole("textbox", { name: "タグを検索" }), "テスト タグ");
    await user.click(await screen.findByRole("button", { name: "そのまま #テスト タグ を使う" }));

    // 空白→_ に正規化されて relay へ渡る（投稿本文 #テスト_タグ と一致する）。
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["テスト_タグ"] })));
    await waitFor(() => expect(param("tags")).toBe("テスト_タグ"));
    expect(screen.getByRole("button", { name: "「テスト_タグ」を外す" })).toBeInTheDocument();
  });

  it("popstate で URL の品種に復元する", async () => {
    setResponse({ tags: ["トマト"] }, [makePost({ id: "a" })]);
    setResponse({ tags: ["実生"] }, [makePost({ id: "b" })]);
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト"));
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["トマト"] })));

    popTo("/discover?tags=" + encodeURIComponent("実生"));

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenLastCalledWith(expect.objectContaining({ tags: ["実生"] })));
  });

  it("`?p=`（投稿モーダル deep-link）の開閉だけの popstate では再取得しない＝スクロールを保つ（#427）", async () => {
    setResponse({}, [makePost({ id: "x" }), makePost({ id: "y" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(fetchDiscoverFiltered).toHaveBeenCalledTimes(1);

    // 投稿モーダルを開く＝`?p=` を pushState（#386・openPost 相当）。取得はしない。
    window.history.pushState(null, "", "/discover?p=nevent1example");
    // × で閉じる＝history.back → popstate（`?tags=` は不変のまま `?p=` だけ剥がれる）。
    popTo("/discover");

    // 絞り込み（?tags=）は変わっていないので再取得しない＝グリッドは作り直されずスクロール位置が保たれる。
    // バグ時は applyTags が status を loading にしてグリッドが一旦アンマウントされ、img が消えて再取得される。
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(fetchDiscoverFiltered).toHaveBeenCalledTimes(1);
  });

  it("絞り込み中でも投稿の開閉（?tags=A&p=X → ?tags=A）では再取得しない（#427）", async () => {
    setResponse({ tags: ["トマト"] }, [makePost({ id: "a" })]);
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト"));
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["トマト"] })));
    expect(fetchDiscoverFiltered).toHaveBeenCalledTimes(1);

    // 絞り込み中に投稿を開く（?p= を足す）→ 閉じる（?p= が剥がれて ?tags=トマト に戻る）。
    window.history.pushState(null, "", "/discover?tags=" + encodeURIComponent("トマト") + "&p=nevent1example");
    popTo("/discover?tags=" + encodeURIComponent("トマト"));

    // タグ（トマト）は不変なので再取得しない。
    expect(fetchDiscoverFiltered).toHaveBeenCalledTimes(1);
  });

  it("error 再試行は履歴を積まない（navigate:none）", async () => {
    const user = userEvent.setup();
    fetchDiscoverFiltered.mockReset();
    fetchDiscoverFiltered.mockImplementation((f: DiscoverFilter) =>
      f.tags.length === 0 ? Promise.resolve([]) : Promise.reject(new Error("relay down")),
    );
    window.history.replaceState(null, "", "/discover?tags=" + encodeURIComponent("トマト"));
    render(<DiscoverGrid />);

    const retry = await screen.findByRole("button", { name: "再試行" });
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    pushSpy.mockClear();
    replaceSpy.mockClear();
    fetchDiscoverFiltered.mockClear();

    await user.click(retry);

    await waitFor(() => expect(fetchDiscoverFiltered).toHaveBeenCalledWith(expect.objectContaining({ tags: ["トマト"] })));
    expect(pushSpy).toHaveBeenCalledTimes(0);
    expect(replaceSpy).toHaveBeenCalledTimes(0);
  });
});
