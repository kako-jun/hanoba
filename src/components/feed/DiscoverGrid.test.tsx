import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
// クエリ語をキーに応答を引く mockImplementation で、初回の既定検索（#plantstr・#22）と
// ユーザー検索の両方を順序非依存に扱う。
const fetchDiscover = vi.fn();
// 既定表示は #plantstr ∪ t:hanoba のマージ（#52）。t:hanoba 取得もモックで止める。
const fetchHanobaFeed = vi.fn();
// PostDetail がマウント時に呼ぶいいね数取得もモックで止める（#12）。
const fetchReactionCount = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchDiscover: (...args: unknown[]) => fetchDiscover(...args),
  fetchHanobaFeed: (...args: unknown[]) => fetchHanobaFeed(...args),
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

// 検索ボックスの aria-label（タグ/キーワード両対応・#24）。
const SEARCH_BOX = "植物のタグ または 本文キーワード";

// クエリ語 → 応答投稿。未登録は空配列（既定検索 #plantstr も既定で空＝idle に戻る）。
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
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
  };
}

describe("DiscoverGrid", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscover.mockReset();
    fetchDiscover.mockImplementation((q: string) => Promise.resolve(responses.get(q) ?? []));
    fetchHanobaFeed.mockReset();
    fetchHanobaFeed.mockResolvedValue([]); // 既定表示のマージ相手（t:hanoba）。既定は空。
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    // 各テストで URL のクエリを空に戻す（既定検索の経路を通す）。
    window.history.replaceState(null, "", "/discover");
  });

  afterEach(() => {
    cleanup();
  });

  it("初回（?q= 無し）は既定検索を自動で流して写真を並べる（#22）", async () => {
    setResponse("#plantstr", [
      makePost({ id: "x", caption: "観葉1" }),
      makePost({ id: "y", caption: "観葉2" }),
    ]);
    render(<DiscoverGrid />);

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    expect(fetchDiscover).toHaveBeenCalledWith("#plantstr");
  });

  it("既定表示は #plantstr と t:hanoba をマージして並べる（#52・重複は除去）", async () => {
    setResponse("#plantstr", [
      makePost({ id: "shared", caption: "共有", createdAt: 1000 }),
      makePost({ id: "community", caption: "世界の植物", createdAt: 1500 }),
    ]);
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "shared", caption: "共有", createdAt: 1000 }), // #plantstr と重複（id 一致）→ 1 つに畳む
      makePost({ id: "local", caption: "葉の場の植物", createdAt: 2000 }),
    ]);
    render(<DiscoverGrid />);

    // shared(重複) + community + local = 3 枚（重複除去後）。
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));
    expect(fetchDiscover).toHaveBeenCalledWith("#plantstr");
    expect(fetchHanobaFeed).toHaveBeenCalled();
  });

  it("既定検索が 0 件なら案内（idle プロンプト）に戻す", async () => {
    render(<DiscoverGrid />); // #plantstr は未登録＝[]

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));
    expect(await screen.findByText(/「探す」を押すと/)).toBeInTheDocument();
    expect(screen.getByText(/hanoba 以外のクライアントの投稿も含みます/)).toBeInTheDocument();
  });

  it("× ボタンで検索文字を全消しできる（#60）", async () => {
    const user = userEvent.setup();
    render(<DiscoverGrid />);

    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    // 入力前は × は出ない。
    expect(screen.queryByRole("button", { name: "検索文字を消す" })).not.toBeInTheDocument();
    await user.type(box, "アガベ");
    expect(box.value).toBe("アガベ");
    const clearBtn = screen.getByRole("button", { name: "検索文字を消す" });
    // submit を暴発させない（再検索でなく text を消すだけ）。
    expect(clearBtn).toHaveAttribute("type", "button");
    await user.click(clearBtn);
    expect(box.value).toBe("");
    // 消えたら × も消える。
    expect(screen.queryByRole("button", { name: "検索文字を消す" })).not.toBeInTheDocument();
  });

  it("キーワード（# 無し）で検索すると fetchDiscover に素の語を渡す（本文検索・#24）", async () => {
    const user = userEvent.setup();
    setResponse("葉焼け", [
      makePost({ id: "a", caption: "葉焼けした" }),
      makePost({ id: "b", caption: "また葉焼け" }),
    ]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "葉焼け");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    // 正規化せず raw を渡す（モード分岐は fetchDiscover 側）。fromDefault は付かない。
    expect(fetchDiscover).toHaveBeenCalledWith("葉焼け");
  });

  it("先頭 # 付きはそのまま fetchDiscover に渡す（タグモードは内部で分岐）", async () => {
    const user = userEvent.setup();
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "#パキポ");
    await user.click(screen.getByRole("button", { name: "探す" }));

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#パキポ"));
  });

  it("0 件なら見つからない文言を出す", async () => {
    const user = userEvent.setup();
    render(<DiscoverGrid />); // サボテンは未登録＝[]

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "サボテン");
    await user.click(screen.getByRole("button", { name: "探す" }));

    expect(await screen.findByText(/「サボテン」の投稿は見つかりませんでした/)).toBeInTheDocument();
  });

  it("セルクリックで PostDetail（dialog）を開く", async () => {
    const user = userEvent.setup();
    setResponse("アガベ", [makePost({ id: "a", caption: "開花した" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花した" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("詳細内のタグクリックでそのタグを # 付き（タグモード）で再検索する", async () => {
    const user = userEvent.setup();
    setResponse("アガベ", [makePost({ id: "a", caption: "開花 #パキポ", hashtags: ["パキポ"] })]);
    setResponse("#パキポ", [makePost({ id: "z", caption: "別のパキポ" })]);
    render(<DiscoverGrid />);

    await user.type(screen.getByRole("textbox", { name: SEARCH_BOX }), "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "開花 #パキポ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));

    // モーダルは閉じ、#パキポ（タグモード）で再検索される。
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchDiscover).toHaveBeenLastCalledWith("#パキポ");
  });

  it("URL の ?q= があればマウント時に初期検索する（既定検索は流さない）", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
    expect(await screen.findAllByRole("img")).toHaveLength(1);
    expect(fetchDiscover).not.toHaveBeenCalledWith("#plantstr");
  });

  it("旧 ?tag= リンクも後方互換で初期検索する", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?tag=アガベ");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
  });
});
