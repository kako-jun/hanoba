import { describe, expect, it } from "vitest";
import { computeCitizenStats } from "./stats.ts";
import { VARIETY_CATALOG } from "../plants/variety-catalog.ts";
import type { FeedPost } from "./parse.ts";

const DAY = 86400;
const NOW = 1_700_000_000; // 固定 now（決定的）。

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    pubkey: "a".repeat(64),
    createdAt: NOW,
    caption: "",
    imageUrls: [],
    imageUrl: null,
    hashtags: [],
    ...overrides,
  };
}

describe("computeCitizenStats（活動スタッツ・#272）", () => {
  it("投稿0件は全0・居住0日・最古null（旅人/市民はレベルで決まる）", () => {
    const s = computeCitizenStats({ posts: [], catalog: VARIETY_CATALOG, hasName: false, now: NOW });
    expect(s).toMatchObject({ postCount: 0, photoCount: 0, varietyCount: 0, tenureDays: 0, earliestCreatedAt: null, level: 0 });
    expect(s.varieties).toEqual([]);
  });

  it("投稿数・写真枚数を数える（写真は imageUrls 合計）", () => {
    const posts = [
      makePost({ id: "1", imageUrls: ["a.jpg", "b.jpg"] }),
      makePost({ id: "2", imageUrls: ["c.jpg"] }),
      makePost({ id: "3", imageUrls: [] }),
    ];
    const s = computeCitizenStats({ posts, catalog: VARIETY_CATALOG, hasName: true, now: NOW });
    expect(s.postCount).toBe(3);
    expect(s.photoCount).toBe(3);
  });

  it("育てた品種を tallyVarieties で同定し票数つき降順（属＋品種で1種）", () => {
    const posts = [
      makePost({ id: "1", hashtags: ["パキポディウム", "グラキリス"] }),
      makePost({ id: "2", hashtags: ["パキポディウム", "グラキリス"] }),
      makePost({ id: "3", hashtags: ["アガベ", "チタノタ"] }),
    ];
    const s = computeCitizenStats({ posts, catalog: VARIETY_CATALOG, hasName: true, now: NOW });
    expect(s.varietyCount).toBe(2);
    expect(s.varieties.map((v) => [v.name, v.count])).toEqual([
      ["グラキリス", 2],
      ["チタノタ", 1],
    ]);
  });

  it("居住日数は最古投稿から（floor・最古=earliestCreatedAt）", () => {
    const posts = [
      makePost({ id: "old", createdAt: NOW - 20 * DAY }),
      makePost({ id: "mid", createdAt: NOW - 5 * DAY }),
      makePost({ id: "new", createdAt: NOW - 1 * DAY }),
    ];
    const s = computeCitizenStats({ posts, catalog: VARIETY_CATALOG, hasName: true, now: NOW });
    expect(s.earliestCreatedAt).toBe(NOW - 20 * DAY);
    expect(s.tenureDays).toBe(20);
  });

  it("市民レベル: 名乗り無し=旅人(0) / 名乗り有り=市民(1) / 5投稿+14日以上=市民L2(2)", () => {
    const old = (n: number) => makePost({ id: `p${n}`, createdAt: NOW - 15 * DAY });
    const five = [old(1), old(2), old(3), old(4), old(5)];
    expect(computeCitizenStats({ posts: five, catalog: VARIETY_CATALOG, hasName: false, now: NOW }).level).toBe(0);
    expect(computeCitizenStats({ posts: [old(1)], catalog: VARIETY_CATALOG, hasName: true, now: NOW }).level).toBe(1);
    expect(computeCitizenStats({ posts: five, catalog: VARIETY_CATALOG, hasName: true, now: NOW }).level).toBe(2);
  });
});
