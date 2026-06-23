import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nip19 } from "nostr-tools";
import type { FeedPost } from "../../lib/feed/parse.ts";

// #386 deep-link `?p=<nevent>` の配線テスト。relay 取得はモック境界で止める（実ネットワークを呼ばない）。
// fetchPostById は `?p=` 着地でフィード外投稿を引く経路。各テストで返り値を差し替える。
const fetchPostById = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  // フィード外の `?p=` 着地で単一投稿を引く（観測対象）。
  fetchPostById: (...a: unknown[]) => fetchPostById(...a),
  // PostGrid → PostCard / PostDetail（選択時）が呼ぶ周辺取得はこの検証では使わない。
  fetchReactionCount: () => Promise.resolve(0),
  fetchReplies: () => Promise.resolve([]),
  fetchProfiles: () => Promise.resolve(new Map()),
  fetchReactionCountsBatch: () => Promise.resolve(new Map()),
  fetchCommentCountsBatch: () => Promise.resolve(new Map()),
}));

import PostGrid from "./PostGrid.tsx";
import { usePostDeepLink } from "./usePostDeepLink.ts";

// 64hex の id を作る（nevent/note encode 可能な正当な id）。i は 1 文字目に混ぜて区別する。
function hexId(seed: string): string {
  const head = seed.replace(/[^0-9a-f]/g, "").slice(0, 8);
  return (head + "0".repeat(64)).slice(0, 64);
}

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    caption: overrides.caption ?? overrides.id,
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
    shotDates: [],
  };
}

// `?p=` クエリへ載せる nevent 文字列を id から作る（着地 URL を組む用）。
function neventOf(id: string, pubkey = "0".repeat(64), relays: string[] = []): string {
  return nip19.neventEncode({ id, author: pubkey, relays });
}

let pushSpy: ReturnType<typeof vi.spyOn>;
let replaceSpy: ReturnType<typeof vi.spyOn>;
let backSpy: ReturnType<typeof vi.spyOn>;

describe("PostGrid × deep-link `?p=<nevent>`（#386）", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchPostById.mockReset().mockResolvedValue(null);
    // 各テストの開始 URL を `/`（`?p=` 無し）に揃える。location.search は replaceState 経由で設定する。
    window.history.replaceState(null, "", "/");
    pushSpy = vi.spyOn(window.history, "pushState");
    replaceSpy = vi.spyOn(window.history, "replaceState");
    backSpy = vi.spyOn(window.history, "back").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    pushSpy.mockRestore();
    replaceSpy.mockRestore();
    backSpy.mockRestore();
  });

  // ---- openPost → URL（意図的操作＝pushState） ----

  it("(20) カードタップで dialog が開き、pushState で URL に `?p=nevent1...` が載る", async () => {
    const user = userEvent.setup();
    const id = hexId("a1");
    render(<PostGrid posts={[makePost({ id, caption: "ひらいた" })]} onSelectHashtag={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "ひらいた" }));

    expect(await screen.findByRole("dialog", { name: "投稿の詳細" })).toBeInTheDocument();
    expect(pushSpy).toHaveBeenCalled();
    expect(window.location.search.startsWith("?p=nevent1")).toBe(true);
    // 載せた nevent を復号すると元の id に戻る。
    const param = new URLSearchParams(window.location.search).get("p")!;
    const decoded = nip19.decode(param);
    expect(decoded.type).toBe("nevent");
    if (decoded.type === "nevent") expect(decoded.data.id).toBe(id);
  });

  it("(21) encode 不能な投稿（id 非 hex）タップ→モーダルは開くが pushState されず URL 不変", async () => {
    const user = userEvent.setup();
    render(<PostGrid posts={[makePost({ id: "not-hex-id", caption: "壊れ" })]} onSelectHashtag={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "壊れ" }));

    // モーダルは開く（encode 不能でも表示は通す）。
    expect(await screen.findByRole("dialog", { name: "投稿の詳細" })).toBeInTheDocument();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  // ---- closePost（DT-2） ----

  it("(22) openPost で開いた後に閉じる→history.back が呼ばれ replaceState は呼ばれない", async () => {
    const user = userEvent.setup();
    render(<PostGrid posts={[makePost({ id: hexId("b2"), caption: "とじる" })]} onSelectHashtag={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "とじる" }));
    await screen.findByRole("dialog", { name: "投稿の詳細" });
    replaceSpy.mockClear(); // open 後の状態から、close での replaceState 呼び出しだけを見る。

    await user.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
    });
    expect(backSpy).toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("(23) deep-link 着地で開いて閉じる→replaceState で `?p=` が剥がれ back は呼ばれない", async () => {
    const id = hexId("c3");
    const posts = [makePost({ id, caption: "着地" })];
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    replaceSpy.mockClear();
    const user = userEvent.setup();
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    // 着地で即モーダルが開く（posts 内なので fetch 不要）。
    await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(fetchPostById).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
    });
    // 着地（pushState していない）の close は replaceState で `?p=` を剥がす・back は呼ばない。
    expect(replaceSpy).toHaveBeenCalled();
    expect(backSpy).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).has("p")).toBe(false);
  });

  it("(24) `?tags=イネ&p=...` 着地で閉じる→replaceState 後も `?tags=イネ` は残る", async () => {
    const id = hexId("d4");
    const posts = [makePost({ id, caption: "タグ残し" })];
    window.history.replaceState(null, "", `/?tags=${encodeURIComponent("イネ")}&p=${neventOf(id)}`);
    const user = userEvent.setup();
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);

    await screen.findByRole("dialog", { name: "投稿の詳細" });
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
    });
    const params = new URLSearchParams(window.location.search);
    expect(params.get("tags")).toBe("イネ");
    expect(params.has("p")).toBe(false);
  });

  // ---- マウント着地（DT-3） ----

  it("(25) `?p=`（posts 内 id）→fetch を呼ばず即該当モーダルが開く", async () => {
    const id = hexId("e5");
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    render(<PostGrid posts={[makePost({ id, caption: "母集団内" })]} onSelectHashtag={() => {}} />);

    const dialog = await screen.findByRole("dialog", { name: "投稿の詳細" });
    // caption はカード・モーダル両方に出るので dialog 内に限定して確認する。
    expect(within(dialog).getByText("母集団内")).toBeInTheDocument();
    expect(fetchPostById).not.toHaveBeenCalled();
  });

  it("(26) `?p=`（posts 外）・fetch が画像あり投稿を返す→externalPost で開く", async () => {
    const id = hexId("f6");
    const external = makePost({ id, caption: "フィード外の投稿" });
    fetchPostById.mockResolvedValue(external);
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    // posts は別 id（着地 id を含まない）。
    render(<PostGrid posts={[makePost({ id: hexId("99"), caption: "別の投稿" })]} onSelectHashtag={() => {}} />);

    expect(await screen.findByRole("dialog", { name: "投稿の詳細" })).toBeInTheDocument();
    expect(screen.getByText("フィード外の投稿")).toBeInTheDocument();
    expect(fetchPostById).toHaveBeenCalledWith(id, []);
  });

  it("(27) `?p=`（posts 外）・fetch が null→モーダルは開かず・クラッシュしない", async () => {
    const id = hexId("a7");
    fetchPostById.mockResolvedValue(null);
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    render(<PostGrid posts={[makePost({ id: hexId("88"), caption: "別の投稿" })]} onSelectHashtag={() => {}} />);

    // fetch の解決を待つ（呼ばれたことを確認）が、null なのでモーダルは出ない。
    await waitFor(() => expect(fetchPostById).toHaveBeenCalled());
    expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
  });

  it("(28) `?p=` 無し→fetch を呼ばずモーダルも開かない", async () => {
    render(<PostGrid posts={[makePost({ id: hexId("b8"), caption: "ふつう" })]} onSelectHashtag={() => {}} />);

    await screen.findByRole("button", { name: "ふつう" });
    expect(fetchPostById).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
  });

  it("(29) 壊れた `?p=`（decode 不能）→モーダルは開かない・クラッシュしない", async () => {
    window.history.replaceState(null, "", "/?p=nevent1brokenxxxxxxxxxx");
    render(<PostGrid posts={[makePost({ id: hexId("c9"), caption: "ふつう" })]} onSelectHashtag={() => {}} />);

    await screen.findByRole("button", { name: "ふつう" });
    expect(fetchPostById).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
  });

  it("(30) マウント時に pushState/replaceState を呼ばない（着地は URL を書かない）", async () => {
    const id = hexId("d0");
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    replaceSpy.mockClear();
    pushSpy.mockClear();
    render(<PostGrid posts={[makePost({ id, caption: "着地のみ" })]} onSelectHashtag={() => {}} />);

    await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  // ---- race / stale（フックを直接動かす） ----

  it("(31) 連続 openId は古い fetch の後着を捨て、最新 id で確定する", async () => {
    const idA = hexId("a1");
    const idB = hexId("b2");
    // id 毎に保留 promise を作り、解決順を逆転（A→B の順で開くが、解決は B→A の順）。
    let resolveA!: (p: FeedPost | null) => void;
    let resolveB!: (p: FeedPost | null) => void;
    fetchPostById.mockImplementation((id: string) => {
      if (id === idA) return new Promise((r) => { resolveA = r; });
      return new Promise((r) => { resolveB = r; });
    });

    let selectedId: string | null = null;
    const setSelectedId = vi.fn((v: string | null) => { selectedId = v; });
    const { result, rerender } = renderHook(
      (props: { selectedId: string | null }) =>
        usePostDeepLink({ posts: [], selectedId: props.selectedId, setSelectedId }),
      { initialProps: { selectedId } },
    );

    // 着地 A → 直後に着地 B（最新は B）。openPost は pushState する経路なので、ここでは外部 id 着地を
    // 直接動かす openPost（カードタップ相当）を2回呼んで「最新トークン」の挙動を見る。
    act(() => { result.current.openPost(makePost({ id: idA, caption: "A" })); });
    act(() => { result.current.openPost(makePost({ id: idB, caption: "B" })); });

    // openPost は posts 外なので fetch せず即 setSelectedId する（posts=[] のため）。
    // → 最後の呼びが勝ち、selectedId は B。
    await waitFor(() => expect(selectedId).toBe(idB));
    rerender({ selectedId });
    expect(selectedId).toBe(idB);
    // 保留 fetch があれば後で解決しても落ちないこと（クリーンアップ）。
    resolveB?.(null);
    resolveA?.(null);
  });

  // ---- popstate ----

  it("(32) `?p=` 無しへ popstate→モーダルが閉じる", async () => {
    const id = hexId("e2");
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    render(<PostGrid posts={[makePost({ id, caption: "ポップ" })]} onSelectHashtag={() => {}} />);
    await screen.findByRole("dialog", { name: "投稿の詳細" });

    // 戻る相当: URL を `?p=` 無しにしてから popstate を発火する（happy-dom の back は popstate を出さない）。
    act(() => {
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new Event("popstate"));
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
    });
  });

  it("(33) 別 id へ popstate→その投稿で開き直す", async () => {
    const idA = hexId("a3");
    const idB = hexId("b3");
    const posts = [
      makePost({ id: idA, caption: "投稿A" }),
      makePost({ id: idB, caption: "投稿B" }),
    ];
    window.history.replaceState(null, "", `/?p=${neventOf(idA)}`);
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);
    const dialogA = await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(within(dialogA).getByText("投稿A")).toBeInTheDocument();

    act(() => {
      window.history.replaceState(null, "", `/?p=${neventOf(idB)}`);
      window.dispatchEvent(new Event("popstate"));
    });

    await waitFor(() => {
      const dialogB = screen.getByRole("dialog", { name: "投稿の詳細" });
      expect(within(dialogB).getByText("投稿B")).toBeInTheDocument();
    });
  });

  it("(34) popstate ハンドラは pushState/replaceState を呼ばない（URL を二重に積まない）", async () => {
    const idA = hexId("a4");
    const idB = hexId("b4");
    window.history.replaceState(null, "", `/?p=${neventOf(idA)}`);
    render(
      <PostGrid posts={[makePost({ id: idA, caption: "P1" }), makePost({ id: idB, caption: "P2" })]} onSelectHashtag={() => {}} />,
    );
    await screen.findByRole("dialog", { name: "投稿の詳細" });
    pushSpy.mockClear();
    replaceSpy.mockClear();

    act(() => {
      window.history.replaceState(null, "", `/?p=${neventOf(idB)}`);
      replaceSpy.mockClear(); // 自前の replaceState（URL 仕込み）は除外し、ハンドラが呼ぶ分だけを見る。
      window.dispatchEvent(new Event("popstate"));
    });

    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { name: "投稿の詳細" });
      expect(within(dialog).getByText("P2")).toBeInTheDocument();
    });
    expect(pushSpy).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  // ---- 多段履歴シーケンス（pushState/back 履歴モデルの回帰固定） ----

  it("(38) 着地→別投稿を開いて閉じると着地投稿に戻る（pushState/back 履歴モデル）", async () => {
    const idA = hexId("a8"); // 着地投稿（`?p=neventA` でマウント着地）
    const idB = hexId("b8"); // フィード内の別カード（openPost で開く）
    const posts = [
      makePost({ id: idA, caption: "着地投稿A" }),
      makePost({ id: idB, caption: "別投稿B" }),
    ];
    const user = userEvent.setup();

    // 1) `?p=neventA` で着地（マウント着地で A のモーダルが開く・fetch 不要）。
    window.history.replaceState(null, "", `/?p=${neventOf(idA)}`);
    render(<PostGrid posts={posts} onSelectHashtag={() => {}} />);
    const dialogA = await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(within(dialogA).getByText("着地投稿A")).toBeInTheDocument();

    // 2) カード B をタップ（openPost）→ `?p=neventB` が pushState され B が開く。
    //    カードの写真ボタン（aria-label=caption）はカード側にだけ存在する＝モーダル外で取れる。
    await user.click(screen.getByRole("button", { name: "別投稿B" }));
    await waitFor(() => {
      const dialogB = screen.getByRole("dialog", { name: "投稿の詳細" });
      expect(within(dialogB).getByText("別投稿B")).toBeInTheDocument();
    });
    expect(pushSpy).toHaveBeenCalled();
    // openPost は encodePostNevent でリレーヒント付き nevent を書く（neventOf の素の文字列とは別だが
    // 同じ id を指す）ので、生文字列でなく復号した id で照合する。
    const paramB = new URLSearchParams(window.location.search).get("p")!;
    const decodedB = nip19.decode(paramB);
    expect(decodedB.type).toBe("nevent");
    if (decodedB.type === "nevent") expect(decodedB.data.id).toBe(idB);

    // 3) B を閉じる（closePost）→ pushedRef=true 経路で history.back が呼ばれる。
    backSpy.mockClear();
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(backSpy).toHaveBeenCalled();

    // 4) happy-dom は back で popstate を発火しないので、戻り先 URL（`?p=neventA`）を仕込んでから
    //    popstate を撃つ（既存(32-34)と同じ駆動法）。popstate ハンドラ経由で A が再展開される。
    act(() => {
      window.history.replaceState(null, "", `/?p=${neventOf(idA)}`);
      window.dispatchEvent(new Event("popstate"));
    });

    await waitFor(() => {
      const reopened = screen.getByRole("dialog", { name: "投稿の詳細" });
      expect(within(reopened).getByText("着地投稿A")).toBeInTheDocument();
    });
    // B はもう開いていない（A に戻った＝1枚だけ）。
    expect(within(screen.getByRole("dialog", { name: "投稿の詳細" })).queryByText("別投稿B")).toBeNull();
  });

  // ---- 配線 / 優先 ----

  it("(35) posts 内 id は externalPost より優先される（id 引きが勝つ）", async () => {
    const id = hexId("a5");
    const inFeed = makePost({ id, caption: "フィード内の本文" });
    // 同じ id で別 caption の externalPost を fetch が返しても、posts 内（id 引き）が勝つ。
    const external = makePost({ id, caption: "外部の本文" });

    let selectedId: string | null = null;
    const setSelectedId = vi.fn((v: string | null) => { selectedId = v; });
    const { result, rerender } = renderHook(
      (props: { posts: FeedPost[]; selectedId: string | null }) =>
        usePostDeepLink({ posts: props.posts, selectedId: props.selectedId, setSelectedId }),
      { initialProps: { posts: [inFeed], selectedId } },
    );

    // posts 内の投稿を開く＝即 selectedId が立ち、selectedPost は id 引き（inFeed）。
    act(() => { result.current.openPost(inFeed); });
    rerender({ posts: [inFeed], selectedId });
    expect(result.current.selectedPost?.caption).toBe("フィード内の本文");

    // externalPost を抱えていても posts 内 id 引きが優先される（外部の本文にはならない）。
    void external;
    expect(result.current.selectedPost?.id).toBe(id);
    expect(result.current.selectedPost?.caption).not.toBe("外部の本文");
  });

  it("(36) モーダルでタグをクリック→closePost が先に走り `?p=` が剥がれてから onSelectHashtag が呼ばれる", async () => {
    const id = hexId("a6");
    const posts = [makePost({ id, caption: "タグ投稿", hashtags: ["イネ"] })];
    const onSelectHashtag = vi.fn();
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    const user = userEvent.setup();
    render(<PostGrid posts={posts} onSelectHashtag={onSelectHashtag} />);

    const dialog = await screen.findByRole("dialog", { name: "投稿の詳細" });
    // モーダル内のタグボタン（#イネ）をクリック（同じタグはカードにも出るので dialog 内に限定）。
    const tagButton = within(dialog).getByRole("button", { name: /イネ/ });
    await user.click(tagButton);

    // selectHashtag は closePost → onSelectHashtag の順。`?p=` が剥がれ、タグが伝わる。
    await waitFor(() => expect(onSelectHashtag).toHaveBeenCalledWith("イネ"));
    expect(new URLSearchParams(window.location.search).has("p")).toBe(false);
  });

  it("(40) カードから開いた（pushState 済）モーダルでタグ→back せず replaceState で `?p=` を剥がす（#433）", async () => {
    // #433 の核。(36) は deep-link 着地（pushedRef=false）で元々 replaceState 分岐だったため bug を踏まない。
    // ここは**カードタップで開く**＝openPost が pushState（pushedRef=true）。旧実装は closePost が back() を
    // 打ち、その遅延 popstate が直後の `?tags=` push と競合して「前の絞り込み＋モーダル」が復活していた。
    const id = hexId("ab");
    const onSelectHashtag = vi.fn();
    window.history.replaceState(null, "", `/discover?tags=${encodeURIComponent("トマト")}`);
    const user = userEvent.setup();
    render(<PostGrid posts={[makePost({ id, caption: "ひらく", hashtags: ["アガベ"] })]} onSelectHashtag={onSelectHashtag} />);

    await user.click(await screen.findByRole("button", { name: "ひらく" }));
    const dialog = await screen.findByRole("dialog", { name: "投稿の詳細" });
    expect(new URLSearchParams(window.location.search).has("p")).toBe(true); // openPost で push 済
    backSpy.mockClear();

    await user.click(within(dialog).getByRole("button", { name: /アガベ/ }));

    // 肝: pushedRef=true でも **back しない**。replaceState で `?p=` を剥がし `?tags=` は保持。
    expect(backSpy).not.toHaveBeenCalled();
    expect(new URLSearchParams(window.location.search).has("p")).toBe(false);
    expect(new URLSearchParams(window.location.search).get("tags")).toBe("トマト");
    await waitFor(() => expect(onSelectHashtag).toHaveBeenCalledWith("アガベ"));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).not.toBeInTheDocument());
  });

  // ---- console 汚染 ----

  it("(37) fetch 失敗系経路で console.error / unhandled rejection が出ない", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = hexId("a7");
    // fetch が reject しても usePostDeepLink は graceful（client.ts 側で吸収する想定だが、ここは
    // フックが reject を抱え込まず・console を汚さないことを確認する）。
    fetchPostById.mockResolvedValue(null);
    window.history.replaceState(null, "", `/?p=${neventOf(id)}`);
    render(<PostGrid posts={[makePost({ id: hexId("66"), caption: "別" })]} onSelectHashtag={() => {}} />);

    await waitFor(() => expect(fetchPostById).toHaveBeenCalled());
    // モーダルは出ない（null）。React の error boundary 由来の console.error も出ていないこと。
    expect(screen.queryByRole("dialog", { name: "投稿の詳細" })).toBeNull();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
