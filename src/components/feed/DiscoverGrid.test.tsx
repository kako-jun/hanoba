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
  // コメント欄（#142）は検証対象外なので空（コメント0件）で固定。
  fetchReplies: () => Promise.resolve([]),
  // 著者プロフィール一括取得（#35）。テストでは空 Map（npub フォールバック表示）。
  fetchProfiles: () => Promise.resolve(new Map()),
}));

import DiscoverGrid from "./DiscoverGrid.tsx";

// 検索ボックスの aria-label（タグ/キーワード両対応・#24）。
const SEARCH_BOX = "植物のタグ・本文キーワード・@ユーザー名 または npub";

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
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
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

  it("既定検索が 0 件なら idle（案内文・カードを出さない）に戻す", async () => {
    render(<DiscoverGrid />); // #plantstr は未登録＝[]

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));
    // idle は何も出さない（auto-search 前提なので「探すを押すと」案内は撤去・#102）。
    // 探索中表示やカード・エラーが残らず、検索フォームだけが残ることを確認する。
    await waitFor(() => expect(screen.queryByText(/探しています/)).not.toBeInTheDocument());
    expect(screen.queryByText(/「探す」を押すと/)).not.toBeInTheDocument();
    expect(document.querySelector("article")).toBeNull();
    expect(screen.getByRole("button", { name: "探す" })).toBeInTheDocument();
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

// #139 段階1: 検索状態を pushState/popstate で戻る・進む復元できる deep-link 化。
//
// happy-dom 固有の申し送り（必ず守る）:
// - history.back()/forward() は happy-dom で popstate を発火しない。popstate テストは必ず2手:
//   (1) replaceState で URL を遷移先にセット → (2) dispatchEvent(new PopStateEvent("popstate"))。
//   順序厳守（URL セット → dispatch）。
// - push/replace の判別は history.length を使わず、pushState/replaceState の spy 呼び出し回数で行う
//   （length はテストファイル内で累積し当てにならない）。
// - spy は render ＋初回検索 await 後に mockClear() してから操作する（mount の restoreFromUrl("replace")
//   が replaceState を1回呼ぶため除外）。afterEach で mockRestore()。
// - URL 値比較は new URLSearchParams(window.location.search).get("q") 経由で行う
//   （%23・日本語のエンコード表記差を避ける）。
describe("DiscoverGrid deep-link (?q= pushState/popstate)", () => {
  beforeEach(() => {
    responses.clear();
    fetchDiscover.mockReset();
    fetchDiscover.mockImplementation((q: string) => Promise.resolve(responses.get(q) ?? []));
    fetchHanobaFeed.mockReset();
    fetchHanobaFeed.mockResolvedValue([]);
    fetchReactionCount.mockReset();
    fetchReactionCount.mockResolvedValue(0);
    window.history.replaceState(null, "", "/discover");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // popstate 復元は2手必須（happy-dom は back/forward で popstate を発火しない）。
  function popTo(url: string) {
    window.history.replaceState(null, "", url); // (1) URL を遷移先にセット
    window.dispatchEvent(new PopStateEvent("popstate")); // (2) popstate を発火
  }

  function currentQ(): string | null {
    return new URLSearchParams(window.location.search).get("q");
  }

  it("popstate「戻る」で前の検索語に復元し、検索ボックスも同期する", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    setResponse("パキポ", [makePost({ id: "p", caption: "パキポ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));

    popTo("/discover?q=パキポ");

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("パキポ"));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("パキポ"));
  });

  it("popstate「進む」で進み先の検索語に復元し、検索ボックスも同期する", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    setResponse("新語", [makePost({ id: "n", caption: "新語" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));

    // 進む先（新しい履歴エントリ側）の URL へ。観点は「戻る」と対称。
    popTo("/discover?q=新語");

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("新語"));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("新語"));
  });

  it("q 無しの popstate は既定検索（#plantstr ∪ t:hanoba）に戻し、検索ボックスは空のまま", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("アガベ"));

    fetchDiscover.mockClear();
    fetchHanobaFeed.mockClear();
    popTo("/discover"); // q 削除 → 既定検索へ戻す

    // 既定マージ（fromDefault）＝ #plantstr と t:hanoba の両方を呼ぶ。
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));
    expect(fetchHanobaFeed).toHaveBeenCalled();
    // 既定検索は入力欄を汚さない。
    expect(box.value).toBe("");
  });

  it("popstate 復元では URL を再書き込みしない（pushState・replaceState ともに 0 回・ループ防止）", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    setResponse("X", [makePost({ id: "x", caption: "X" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));

    // mount の restoreFromUrl("replace") 分を除外してから spy を設置する。
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    fetchDiscover.mockClear();

    // (1) 遷移先 URL を replaceState でセット（これはテスト側の操作なので spy を再クリアして除外する）。
    window.history.replaceState(null, "", "/discover?q=X");
    pushSpy.mockClear();
    replaceSpy.mockClear();
    // (2) popstate を発火。ここから先の history 書き込みだけを数える。
    window.dispatchEvent(new PopStateEvent("popstate"));

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("X"));
    // popstate 経路は navigate:"none"＝URL を一切書かない。
    expect(pushSpy).toHaveBeenCalledTimes(0);
    expect(replaceSpy).toHaveBeenCalledTimes(0);
  });

  it("旧 ?tag= マウントは ?q= へ replaceState で正規化する（pushState は呼ばない）", async () => {
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    window.history.replaceState(null, "", "/discover?tag=アガベ");
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    render(<DiscoverGrid />);

    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
    // ?tag= → ?q= に正規化（生文字列でなく get("q") で比較）。
    await waitFor(() => expect(currentQ()).toBe("アガベ"));
    expect(new URLSearchParams(window.location.search).get("tag")).toBeNull();
    // 正規化は replace（履歴を増やさない）。push は使わない。
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(0);
  });

  it("空クリア submit は ?q= を replace で消す（pushState は呼ばない・idle に戻る）", async () => {
    const user = userEvent.setup();
    setResponse("アガベ", [makePost({ id: "a", caption: "アガベ" })]);
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));

    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await user.type(box, "アガベ");
    await user.click(screen.getByRole("button", { name: "探す" }));
    await waitFor(() => expect(currentQ()).toBe("アガベ"));

    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    pushSpy.mockClear();
    replaceSpy.mockClear();

    // 検索ボックスを空にして submit（空クリア）。
    await user.clear(box);
    await user.click(screen.getByRole("button", { name: "探す" }));

    // 空クリアは replace 強制で ?q= を消す（戻る対象にしない）。push は積まない。
    await waitFor(() => expect(currentQ()).toBeNull());
    expect(replaceSpy).toHaveBeenCalled();
    expect(pushSpy).toHaveBeenCalledTimes(0);
    // idle に戻り、グリッドは空。
    await waitFor(() => expect(screen.queryByRole("img")).not.toBeInTheDocument());
    expect(box.value).toBe("");
  });

  it("詳細のタグ再検索は push し、popstate で前の検索語へ戻れる", async () => {
    const user = userEvent.setup();
    setResponse("アガベ", [makePost({ id: "a", caption: "開花 #パキポ", hashtags: ["パキポ"] })]);
    setResponse("#パキポ", [makePost({ id: "z", caption: "別のパキポ" })]);
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    // 詳細を開いてタグ #パキポ をクリック（onSelectHashtag 経由・`#${tag}` を push）。
    await user.click(screen.getByRole("button", { name: "開花 #パキポ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));

    await waitFor(() => expect(fetchDiscover).toHaveBeenLastCalledWith("#パキポ"));
    // %23 エンコード表記差に依存せず get("q") で比較。
    await waitFor(() => expect(currentQ()).toBe("#パキポ"));

    // push が戻る対象になっている＝popstate で前の語（アガベ）へ復元できる。
    popTo("/discover?q=アガベ");
    await waitFor(() => expect(fetchDiscover).toHaveBeenLastCalledWith("アガベ"));
    const box = screen.getByRole("textbox", { name: SEARCH_BOX }) as HTMLInputElement;
    await waitFor(() => expect(box.value).toBe("アガベ"));
  });

  it("連続 popstate は最後の語の結果だけ描画する（先行の遅延応答は破棄・latestRef）", async () => {
    const slowPost = makePost({ id: "slow", caption: "遅い語の結果" });
    const fastPost = makePost({ id: "fast", caption: "速い語の結果" });
    // 語ごとに遅延を変える: 遅い語は長め、速い語は即時。
    fetchDiscover.mockReset();
    fetchDiscover.mockImplementation((q: string) => {
      if (q === "遅い語") {
        return new Promise<FeedPost[]>((resolve) => setTimeout(() => resolve([slowPost]), 80));
      }
      if (q === "速い語") {
        return Promise.resolve([fastPost]);
      }
      return Promise.resolve([]); // 既定検索 #plantstr 等
    });
    render(<DiscoverGrid />);
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("#plantstr"));

    // 遅い語 → 直後に速い語（連続戻る/進む）。
    popTo("/discover?q=遅い語");
    popTo("/discover?q=速い語");

    // 速い語の結果が描画される。
    expect(await screen.findByRole("img")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "速い語の結果" })).toBeInTheDocument());
    // 遅延していた遅い語の応答が後から来ても、上書きされない（stale 破棄）。
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.getByRole("button", { name: "速い語の結果" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "遅い語の結果" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("error 再試行は履歴を積まない（pushState・replaceState ともに 0 回・navigate:none）", async () => {
    const user = userEvent.setup();
    // 検索を1回 reject させて error 状態にする。
    fetchDiscover.mockReset();
    fetchDiscover.mockImplementation((q: string) => {
      if (q === "#plantstr") return Promise.resolve([]); // 既定検索は空（idle）
      return Promise.reject(new Error("relay down"));
    });
    window.history.replaceState(null, "", "/discover?q=アガベ");
    render(<DiscoverGrid />);

    // error 表示と再試行ボタンが出るまで待つ。
    const retry = await screen.findByRole("button", { name: "再試行" });
    expect(await screen.findByText(/読み込めませんでした/)).toBeInTheDocument();

    // error 化後に spy を設置（mount の正規化 replace 分を除外）。
    const pushSpy = vi.spyOn(window.history, "pushState");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    pushSpy.mockClear();
    replaceSpy.mockClear();
    fetchDiscover.mockClear();

    await user.click(retry);

    // 再試行は同語の再取得＝新規ナビゲーションでない。URL を一切書かない（navigate:none）。
    await waitFor(() => expect(fetchDiscover).toHaveBeenCalledWith("アガベ"));
    expect(pushSpy).toHaveBeenCalledTimes(0);
    expect(replaceSpy).toHaveBeenCalledTimes(0);
  });
});
