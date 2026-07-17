import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
const fetchHanobaFeed = vi.fn();
// PostDetail がマウント時に呼ぶいいね数取得もモックで止める（#12）。
const fetchReactionState = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchHanobaFeed: (...args: unknown[]) => fetchHanobaFeed(...args),
  fetchReactionState: (...args: unknown[]) => fetchReactionState(...args),
  // コメント欄（#142）は検証対象外なので空（コメント0件）で固定。
  fetchReplies: () => Promise.resolve([]),
  // 著者プロフィール一括取得（#35）。テストでは空 Map（可視名は author.unnamed）。
  fetchProfiles: () => Promise.resolve(new Map()),
  // カードのいいね/コメント数（#276 / #462・統合バッチ）はグリッド単位取得。この検証では空 Map（カードに数を出さない）。
  fetchEngagementCountsBatch: () => Promise.resolve({ reactions: new Map(), comments: new Map() }),
}));

import FeedGrid from "./FeedGrid.tsx";

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1000,
    caption: overrides.caption ?? "",
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
    shotDates: [],  };
}

describe("FeedGrid", () => {
  beforeEach(() => {
    fetchHanobaFeed.mockReset();
    fetchReactionState.mockReset();
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
  });

  afterEach(() => {
    cleanup();
  });

  it("投稿が無ければ空状態の文言と投稿リンクを出す", async () => {
    fetchHanobaFeed.mockResolvedValue([]);
    render(<FeedGrid />);
    expect(await screen.findByText(/まだ投稿がありません/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "投稿する" })).toHaveAttribute("href", "/compose");
  });

  it("投稿 2 件で img が 2 つ並び、src は parsePost の imageUrl になる", async () => {
    // 一言必須（DESIGN §1）＝ alt は非空。空 alt の img は presentational になり role=img で拾えない。
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "a", caption: "一枚目", imageUrl: "https://image.nostr.build/a.jpg" }),
      makePost({ id: "b", caption: "二枚目", imageUrl: "https://image.nostr.build/b.png" }),
    ]);
    render(<FeedGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    const imgs = screen.getAllByRole("img");
    expect(imgs.map((el) => el.getAttribute("src"))).toEqual([
      "https://image.nostr.build/a.jpg",
      "https://image.nostr.build/b.png",
    ]);
  });

  it("タグチップのクリックで絞り込まれ件数が減る", async () => {
    const user = userEvent.setup();
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "a", caption: "開花 #アガベ", hashtags: ["アガベ"] }),
      makePost({ id: "b", caption: "水やり #パキポ", hashtags: ["パキポ"] }),
      makePost({ id: "c", caption: "発根 #アガベ", hashtags: ["アガベ"] }),
    ]);
    render(<FeedGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(3));

    // セルを開いて詳細モーダルを出し、その中の #アガベ チップで絞り込む。
    await user.click(screen.getByRole("button", { name: "開花 #アガベ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#アガベ" }));

    // モーダルは閉じ、アガベの 2 件だけ残る。
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getAllByRole("img")).toHaveLength(2);
    // 絞り込みチップと解除ボタンが出る。
    expect(screen.getByRole("button", { name: "絞り込みを解除" })).toBeInTheDocument();
  });

  it("絞り込み解除で全件に戻る", async () => {
    const user = userEvent.setup();
    fetchHanobaFeed.mockResolvedValue([
      makePost({ id: "a", caption: "開花 #アガベ", hashtags: ["アガベ"] }),
      makePost({ id: "b", caption: "水やり #パキポ", hashtags: ["パキポ"] }),
    ]);
    render(<FeedGrid />);
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "開花 #アガベ" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "#アガベ" }));
    await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

    await user.click(screen.getByRole("button", { name: "絞り込みを解除" }));
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  // #554: もっと見る（過去へ遡って追記）。母集団の最古 createdAt を until に次バッチを取り、
  // mergeAppendById で id 重複を畳んで連結。新規増分0 で打ち止め（ボタンごと消す）。
  describe("もっと見る（#554）", () => {
    // 手動制御の遅延 Promise（loading 中／アンマウント中の挙動を決定的に検証する）。
    function deferred<T>() {
      let resolve!: (v: T) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it("loaded 後・posts>0 で「もっと見る」ボタンが出る", async () => {
      fetchHanobaFeed.mockResolvedValue([makePost({ id: "a", caption: "花", createdAt: 2000 })]);
      render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));
      expect(screen.getByRole("button", { name: "もっと見る" })).toBeInTheDocument();
    });

    it("クリックで fetchHanobaFeed が until=末尾(最古)createdAt で呼ばれる", async () => {
      const user = userEvent.setup();
      // posts は createdAt 降順で来る（末尾=最古=1000）。
      fetchHanobaFeed
        .mockResolvedValueOnce([
          makePost({ id: "a", caption: "新", createdAt: 2000 }),
          makePost({ id: "b", caption: "古", createdAt: 1000 }),
        ])
        .mockResolvedValueOnce([]);
      render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(fetchHanobaFeed).toHaveBeenLastCalledWith(100, 1000));
    });

    it("新規1件返す → 件数増・ボタン残る（hasMore 継続）", async () => {
      const user = userEvent.setup();
      fetchHanobaFeed
        .mockResolvedValueOnce([makePost({ id: "a", caption: "新", createdAt: 2000 })])
        .mockResolvedValueOnce([makePost({ id: "b", caption: "古", createdAt: 1000 })]);
      render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
      expect(screen.getByRole("button", { name: "もっと見る" })).toBeInTheDocument();
    });

    it("増分0（全重複/空）→ ボタン消える（hasMore=false）", async () => {
      const user = userEvent.setup();
      fetchHanobaFeed
        .mockResolvedValueOnce([makePost({ id: "a", caption: "新", createdAt: 2000 })])
        .mockResolvedValueOnce([]); // 空＝増分0。
      render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "もっと見る" })).toBeNull());
    });

    it("loading 中は disabled＋ラベル差替、連打しても fetch は1回だけ", async () => {
      const user = userEvent.setup();
      fetchHanobaFeed.mockResolvedValueOnce([makePost({ id: "a", caption: "新", createdAt: 2000 })]);
      render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

      // loadMore の応答を pending に固定し、loading 状態を保持する。
      const d = deferred<FeedPost[]>();
      fetchHanobaFeed.mockClear();
      fetchHanobaFeed.mockReturnValue(d.promise);

      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      // ラベルが差し替わり無効化される。
      const btn = await screen.findByRole("button", { name: "読み込み中…" });
      expect(btn).toBeDisabled();
      // 連打しても多重 fetch しない。
      await user.click(btn);
      await user.click(btn);
      expect(fetchHanobaFeed).toHaveBeenCalledTimes(1);

      d.resolve([]); // pending を解消して act 警告を残さない。
      await waitFor(() => expect(screen.queryByRole("button", { name: "読み込み中…" })).toBeNull());
    });

    it("activeTag 絞り込み表示が減っても母集団 posts>0 でボタンが出て母集団が伸びる", async () => {
      const user = userEvent.setup();
      // 母集団2件（別タグ）。#パキポ で絞ると表示1件だが、ボタンは母集団基準で出る。
      fetchHanobaFeed
        .mockResolvedValueOnce([
          makePost({ id: "a", caption: "花 #アガベ", hashtags: ["アガベ"], createdAt: 2000 }),
          makePost({ id: "b", caption: "水 #パキポ", hashtags: ["パキポ"], createdAt: 1500 }),
        ])
        .mockResolvedValueOnce([makePost({ id: "c", caption: "実 #パキポ", hashtags: ["パキポ"], createdAt: 1000 })]);
      render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));

      // #パキポ で絞る（詳細モーダル経由）。表示は1件に減る。
      await user.click(screen.getByRole("button", { name: "水 #パキポ" }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "#パキポ" }));
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));
      // 絞り込み中でも母集団>0 なのでボタンは出る。
      expect(screen.getByRole("button", { name: "もっと見る" })).toBeInTheDocument();

      // もっと見る＝母集団を伸ばす（#パキポ の新規1件が追記され表示2件に）。
      await user.click(screen.getByRole("button", { name: "もっと見る" }));
      await waitFor(() => expect(fetchHanobaFeed).toHaveBeenLastCalledWith(100, 1500));
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(2));
    });

    it("loadMore 中にアンマウント → 応答到着で setState されない（act 警告・エラー無し）", async () => {
      const user = userEvent.setup();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      fetchHanobaFeed.mockResolvedValueOnce([makePost({ id: "a", caption: "新", createdAt: 2000 })]);
      const { unmount } = render(<FeedGrid />);
      await waitFor(() => expect(screen.getAllByRole("img")).toHaveLength(1));

      const d = deferred<FeedPost[]>();
      fetchHanobaFeed.mockReturnValue(d.promise);
      await user.click(screen.getByRole("button", { name: "もっと見る" }));

      unmount(); // 応答前にアンマウント。
      d.resolve([makePost({ id: "b", caption: "古", createdAt: 1000 })]); // 到着しても setState しない。
      await Promise.resolve();
      await Promise.resolve();

      // act(...) 警告や unmounted 更新のエラーが出ていないこと。
      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
