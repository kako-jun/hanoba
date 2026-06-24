import { describe, expect, it, vi } from "vitest";

// fetchDiscoverFiltered のリレー問い合わせを検証するため SimplePool をモックする（#258）。
// pool は client.ts の遅延シングルトンなので、querySync を hoisted な vi.fn に差し替える。
const { querySyncMock } = vi.hoisted(() => ({ querySyncMock: vi.fn() }));
vi.mock("nostr-tools/pool", () => ({
  SimplePool: vi.fn(() => ({ querySync: querySyncMock })),
}));

import {
  deletePostImages,
  fetchDiscoverFiltered,
  fetchEngagementCountsBatch,
  fetchMyProfileResilient,
  fetchPostById,
} from "./client.ts";
import type { Profile } from "../feed/parse.ts";
import type { NostrEvent } from "./types.ts";

// #93: nsec 取り込み・編集欄初期化での websites 取りこぼし（単発取得）を bounded retry で塞ぐ。
// 取得1回（fetchOnce）と待ち（wait）はテスト注入できるので、relay を立てずに決定的に検証する。

const PUBKEY = "40612161ffc0f3072230f0c3d58f54a299eeed47011fc2513351f7facf46e6d2";
const withSites: Profile = {
  name: "みどり園",
  picture: null,
  about: null,
  websites: ["https://midori-en.example.com", "https://x.com/midori_test"],
  favoriteVarieties: [],
};
const noSites: Profile = { name: "みどり園", picture: null, about: null, websites: [], favoriteVarieties: [] };
const noWait = () => Promise.resolve();

describe("fetchMyProfileResilient (#93 bounded retry)", () => {
  it("初回で websites を掴めば 1 回で確定し、待たない", async () => {
    const fetchOnce = vi.fn<(p: string) => Promise<Profile | null>>().mockResolvedValue(withSites);
    const wait = vi.fn(noWait);
    const got = await fetchMyProfileResilient(PUBKEY, 3, 0, fetchOnce, wait);
    expect(got).toEqual(withSites);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("初回が websites 空（lagging relay）でも retry で websites 版を採用する", async () => {
    const fetchOnce = vi
      .fn<(p: string) => Promise<Profile | null>>()
      .mockResolvedValueOnce(noSites)
      .mockResolvedValueOnce(withSites);
    const got = await fetchMyProfileResilient(PUBKEY, 3, 0, fetchOnce, vi.fn(noWait));
    expect(got).toEqual(withSites);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });

  it("初回 null（総取りこぼし）でも retry で取れれば返す", async () => {
    const fetchOnce = vi
      .fn<(p: string) => Promise<Profile | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(withSites);
    const got = await fetchMyProfileResilient(PUBKEY, 3, 0, fetchOnce, vi.fn(noWait));
    expect(got).toEqual(withSites);
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });

  it("全 attempts 空振りなら null を返す（無理に空 Profile を作らない）", async () => {
    const fetchOnce = vi.fn<(p: string) => Promise<Profile | null>>().mockResolvedValue(null);
    const wait = vi.fn(noWait);
    const got = await fetchMyProfileResilient(PUBKEY, 3, 0, fetchOnce, wait);
    expect(got).toBeNull();
    expect(fetchOnce).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("どの版も websites を持たない（本当に無い人）は attempts 回引いて richest を返す", async () => {
    const fetchOnce = vi.fn<(p: string) => Promise<Profile | null>>().mockResolvedValue(noSites);
    const got = await fetchMyProfileResilient(PUBKEY, 3, 0, fetchOnce, vi.fn(noWait));
    expect(got).toEqual(noSites);
    expect(fetchOnce).toHaveBeenCalledTimes(3);
  });

  it("websites を1件でも掴めたら早期確定し、より豊富な版を待たない", async () => {
    const one: Profile = { name: "x", picture: null, about: null, websites: ["https://a.example.com"], favoriteVarieties: [] };
    const fetchOnce = vi
      .fn<(p: string) => Promise<Profile | null>>()
      .mockResolvedValueOnce(one) // websites 1 件 → 即確定するので…
      .mockResolvedValueOnce(withSites);
    const got = await fetchMyProfileResilient(PUBKEY, 3, 0, fetchOnce, vi.fn(noWait));
    // websites を 1 件でも掴めたら早期確定する仕様（取りこぼしの主因を解消したら止める）。
    expect(got).toEqual(one);
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });
});

describe("deletePostImages", () => {
  it("画像 URL が無ければ成功扱い", async () => {
    const deleteFn = vi.fn<(url: string) => Promise<boolean>>();
    await expect(deletePostImages([], deleteFn)).resolves.toBe(true);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it("複数画像をすべて削除できれば true", async () => {
    const deleteFn = vi.fn<(url: string) => Promise<boolean>>().mockResolvedValue(true);
    await expect(deletePostImages(["https://image.nostr.build/a.jpg", "https://image.nostr.build/b.jpg"], deleteFn)).resolves.toBe(true);
    expect(deleteFn).toHaveBeenCalledTimes(2);
  });

  it("部分失敗があれば false", async () => {
    const deleteFn = vi
      .fn<(url: string) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(deletePostImages(["https://image.nostr.build/a.jpg", "https://other.example/b.jpg"], deleteFn)).resolves.toBe(false);
  });

  it("削除中の例外は false に畳む", async () => {
    const deleteFn = vi
      .fn<(url: string) => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error("network"));
    await expect(deletePostImages(["https://image.nostr.build/a.jpg", "https://image.nostr.build/b.jpg"], deleteFn)).resolves.toBe(false);
  });
});

describe("fetchDiscoverFiltered (#258 母集団の単一化)", () => {
  it("絞り込み時も母集団（#t:hanoba ∪ #t:plantstr）を必ず引き、品種を #t クエリにしない", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockResolvedValue([]);

    await fetchDiscoverFiltered({ tags: ["イネ"] });

    const tFilters = querySyncMock.mock.calls.map((c) => c[1]?.["#t"]).filter(Boolean) as string[][];
    expect(tFilters).toContainEqual(["hanoba"]);
    expect(tFilters).toContainEqual(["plantstr"]);
    // 品種は t タグでない＝ #t:[品種] の死んだクエリは投げない（#258 退行の原因）。
    expect(tFilters.some((t) => t.includes("イネ"))).toBe(false);
  });

  it("本文 #イネ だけを持つ hanoba 投稿（t:イネ 不在）が絞り込みに残る", async () => {
    querySyncMock.mockReset();
    const ineEvent = {
      id: "a".repeat(64),
      pubkey: "b".repeat(64),
      created_at: 1700000000,
      kind: 1,
      tags: [["t", "hanoba"], ["client", "hanoba"]],
      content: "開花した #イネ\nhttps://image.nostr.build/x.jpg",
      sig: "",
    };
    // hanoba の母集団クエリ（#t:hanoba）でだけ返す。#t:plantstr / NIP-50 search は空。
    querySyncMock.mockImplementation((_relays: unknown, filter: { "#t"?: string[] }) =>
      Promise.resolve(filter?.["#t"]?.includes("hanoba") ? [ineEvent] : []),
    );

    const got = await fetchDiscoverFiltered({ tags: ["イネ"] });
    expect(got).toHaveLength(1);
    expect(got[0]!.hashtags).toContain("イネ");
  });
});

describe("fetchPostById (#386 deep-link `?p=` 着地)", () => {
  const POST_ID = "a".repeat(64);

  it("画像を持たない投稿（imageUrl === null）は null を返す（写真 SNS の規律）", async () => {
    querySyncMock.mockReset();
    // 画像 URL を含まない content ＝parsePost で imageUrl が null になる。
    querySyncMock.mockResolvedValue([
      {
        id: POST_ID,
        pubkey: "b".repeat(64),
        created_at: 1700000000,
        kind: 1,
        tags: [],
        content: "画像のないただのテキスト投稿",
        sig: "",
      },
    ]);

    await expect(fetchPostById(POST_ID)).resolves.toBeNull();
  });

  it("該当 id が無ければ null（モーダルを開かず通常フィードへ）", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockResolvedValue([]);

    await expect(fetchPostById(POST_ID)).resolves.toBeNull();
  });

  it("querySync が throw しても null に畳む（graceful＝クラッシュしない）", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockRejectedValue(new Error("relay offline"));

    await expect(fetchPostById(POST_ID)).resolves.toBeNull();
  });
});

describe("fetchEngagementCountsBatch (#462 統合クエリの kind 分離)", () => {
  const ID_A = "a".repeat(64);
  const ID_B = "b".repeat(64);

  // kind:7 リアクション（いいね）を作る。countLikes は pubkey で 1 票に畳むので、
  // 別々に数えたい like は pubkey を別にする。content は "-"（dislike）以外なら like。
  const like = (target: string, pubkey: string, content = "+"): NostrEvent =>
    ({
      id: `like-${target}-${pubkey}`,
      pubkey,
      created_at: 1700000000,
      kind: 7,
      tags: [["e", target]],
      content,
      sig: "",
    }) as NostrEvent;

  // kind:1 コメント（リプライ）を作る。toComments は id で重複除去するので、
  // 別々に数えたいコメントは id を別にする。e タグの marker は "mention" 以外
  // （= 本物のリプライ）。ここでは marker 無し（buildReplyTemplate 同等の root 相当扱い）。
  const reply = (target: string, idSuffix: string): NostrEvent =>
    ({
      id: `reply-${target}-${idSuffix}`,
      pubkey: `pk-${idSuffix}`,
      created_at: 1700000000,
      kind: 1,
      tags: [["e", target]],
      content: `コメント ${idSuffix}`,
      sig: "",
    }) as NostrEvent;

  it("kind:7 と kind:1 が混在した1配列を like/comment に正しく振り分ける（kind が交差しない）", async () => {
    querySyncMock.mockReset();
    // 統合クエリ {kinds:[7,1]} が返す混在配列。kind:7 と kind:1 を交互に並べ、
    // 振り分けが配列順や kind 隣接に依存しないことを示す。
    //   ID_A: いいね 2（別 pubkey）＋ コメント 3（別 id）
    //   ID_B: いいね 1 ＋ コメント 0
    querySyncMock.mockResolvedValueOnce([
      like(ID_A, "pk-a1"), // ID_A like #1
      reply(ID_A, "a-c1"), // ID_A comment #1
      like(ID_B, "pk-b1"), // ID_B like #1
      reply(ID_A, "a-c2"), // ID_A comment #2
      like(ID_A, "pk-a2"), // ID_A like #2
      reply(ID_A, "a-c3"), // ID_A comment #3
    ]);

    const { reactions, comments } = await fetchEngagementCountsBatch([ID_A, ID_B]);

    // いいね（kind:7）だけが reactions に乗る。コメント（kind:1）は like に数えない。
    expect(reactions.get(ID_A)).toBe(2);
    expect(reactions.get(ID_B)).toBe(1);
    // コメント（kind:1）だけが comments に乗る。いいね（kind:7）は comment に数えない。
    expect(comments.get(ID_A)).toBe(3);
    expect(comments.get(ID_B)).toBe(0);
  });

  it("kind:1 のリプライは like に数えず、kind:7 のリアクションは comment に数えない（混入の排除）", async () => {
    querySyncMock.mockReset();
    // ID_A 宛に like 0・comment 1、ID_B 宛に like 1・comment 0。
    // もし kind 分離が壊れて全イベントを両集計へ流すと、reactions/comments に
    // 異種が混入して数が膨らむ。それが起きないことを 0 で射抜く。
    querySyncMock.mockResolvedValueOnce([
      reply(ID_A, "only-comment"), // ID_A は comment だけ
      like(ID_B, "pk-b1"), // ID_B は like だけ
    ]);

    const { reactions, comments } = await fetchEngagementCountsBatch([ID_A, ID_B]);

    // ID_A は like 0（コメントが like に漏れていない）。
    expect(reactions.get(ID_A)).toBe(0);
    // ID_B は comment 0（いいねが comment に漏れていない）。
    expect(comments.get(ID_B)).toBe(0);
    // 各々の本来の数。
    expect(comments.get(ID_A)).toBe(1);
    expect(reactions.get(ID_B)).toBe(1);
  });

  it("dislike（content '-'）は like に数えない（countLikes を素通りで通す）", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockResolvedValueOnce([
      like(ID_A, "pk-a1", "+"), // like
      like(ID_A, "pk-a2", "-"), // dislike ＝ 除外
      like(ID_A, "pk-a3", "🤍"), // 絵文字 ＝ like
    ]);

    const { reactions } = await fetchEngagementCountsBatch([ID_A]);
    expect(reactions.get(ID_A)).toBe(2);
  });

  it("空入力は querySync を呼ばず空 Map ペアを返す", async () => {
    querySyncMock.mockReset();

    const { reactions, comments } = await fetchEngagementCountsBatch([]);

    expect(querySyncMock).not.toHaveBeenCalled();
    expect(reactions.size).toBe(0);
    expect(comments.size).toBe(0);
  });

  it("非空入力では filter が kinds:[7,1]・#e:eventIds・limit=n*120（上限5000）になる", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockResolvedValueOnce([]);

    const ids = [ID_A, ID_B];
    await fetchEngagementCountsBatch(ids);

    expect(querySyncMock).toHaveBeenCalledTimes(1);
    const filter = querySyncMock.mock.calls[0]![1] as {
      kinds?: number[];
      "#e"?: string[];
      limit?: number;
    };
    expect(filter.kinds).toEqual([7, 1]);
    expect(filter["#e"]).toEqual(ids);
    // engagementBatchLimit(n) = min(n * 60 * 2, 5000) = n*120（小規模では天井に当たらない）。
    expect(filter.limit).toBe(ids.length * 120);
  });

  it("limit は BATCH_COUNT_MAX(5000) で頭打ちになる", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockResolvedValueOnce([]);

    // n*120 > 5000 になる件数（42*120 = 5040）で天井を踏む。
    const manyIds = Array.from({ length: 42 }, (_, i) => i.toString(16).padStart(64, "0"));
    await fetchEngagementCountsBatch(manyIds);

    const filter = querySyncMock.mock.calls[0]![1] as { limit?: number };
    expect(filter.limit).toBe(5000);
  });

  it("querySync が reject しても throw せず空 Map ペアを返す（graceful）", async () => {
    querySyncMock.mockReset();
    querySyncMock.mockRejectedValueOnce(new Error("relay offline"));

    const { reactions, comments } = await fetchEngagementCountsBatch([ID_A, ID_B]);
    expect(reactions.size).toBe(0);
    expect(comments.size).toBe(0);
  });
});
