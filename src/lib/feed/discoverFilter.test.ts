import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  addTag,
  applyClientFilter,
  applyFilterToParams,
  filterSummary,
  hasQueryConstraint,
  isDefaultFilter,
  parseFilter,
  parseFilterFromString,
  parseTagList,
  removeTag,
  serializeFilter,
  sortPosts,
  tagAliasValues,
  unixToDate,
  type DiscoverFilter,
} from "./discoverFilter.ts";
import type { FeedPost } from "./parse.ts";

/** テスト用の最小 FeedPost。 */
function post(over: Partial<FeedPost> = {}): FeedPost {
  return {
    id: over.id ?? "id1",
    pubkey: over.pubkey ?? "pk1",
    createdAt: over.createdAt ?? 1000,
    caption: over.caption ?? "",
    imageUrls: over.imageUrls ?? ["https://x/i.jpg"],
    imageUrl: over.imageUrl !== undefined ? over.imageUrl : "https://x/i.jpg",
    hashtags: over.hashtags ?? [],
  };
}

// 2026-01-01T00:00:00Z / 2026-03-31T23:59:59Z の unix 秒（UTC）。
const SINCE = Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000);
const UNTIL = Math.floor(Date.parse("2026-03-31T23:59:59Z") / 1000);

describe("parseTagList", () => {
  it("カンマ区切りを正規化（trim・# 除去）して配列にする", () => {
    expect(parseTagList(" #トマト , 実生 ,, ")).toEqual(["トマト", "実生"]);
  });
  it("大小無視で重複排除（最初を残す）", () => {
    expect(parseTagList("Agave,agave,AGAVE")).toEqual(["Agave"]);
  });
  it("null/空は空配列", () => {
    expect(parseTagList(null)).toEqual([]);
    expect(parseTagList("")).toEqual([]);
  });
});

describe("parseFilter", () => {
  it("構造化パラメータを各軸へ読む", () => {
    const f = parseFilter(
      new URLSearchParams("tags=トマト,実生&author=npub1abc&q=葉焼け&since=2026-01-01&until=2026-03-31&sort=old"),
    );
    expect(f.tags).toEqual(["トマト", "実生"]);
    expect(f.author).toBe("npub1abc");
    expect(f.keyword).toBe("葉焼け");
    expect(f.since).toBe(SINCE);
    expect(f.until).toBe(UNTIL);
    expect(f.sort).toBe("old");
  });

  it("旧 ?tag= を tags に合流する（後方互換）", () => {
    expect(parseFilter(new URLSearchParams("tag=アガベ")).tags).toEqual(["アガベ"]);
  });

  it("?q=#タグ は tags へ振り分ける（classify 吸収）", () => {
    const f = parseFilter(new URLSearchParams("q=" + encodeURIComponent("#トマト")));
    expect(f.tags).toEqual(["トマト"]);
    expect(f.keyword).toBe("");
  });

  it("?q=npub… は author へ、@名前 も author へ", () => {
    expect(parseFilter(new URLSearchParams("q=npub1xyz")).author).toBe("npub1xyz");
    expect(parseFilter(new URLSearchParams("q=" + encodeURIComponent("@kako"))).author).toBe("@kako");
  });

  it("不正な sort は new に倒す", () => {
    expect(parseFilter(new URLSearchParams("sort=bogus")).sort).toBe("new");
  });

  it("不正な日付は null", () => {
    const f = parseFilter(new URLSearchParams("since=not-a-date"));
    expect(f.since).toBeNull();
  });
});

describe("parseFilterFromString", () => {
  it("空文字は EMPTY_FILTER", () => {
    expect(parseFilterFromString("")).toEqual(EMPTY_FILTER);
  });
  it("既知キーを含む構造化クエリは parse", () => {
    expect(parseFilterFromString("tags=トマト&sort=old").tags).toEqual(["トマト"]);
  });
  it("旧・単一クエリ（保存ビュー多軸化前）の #タグ を classify する", () => {
    expect(parseFilterFromString("#トマト").tags).toEqual(["トマト"]);
  });
  it("旧・単一クエリの素のキーワードを keyword にする", () => {
    expect(parseFilterFromString("葉焼け").keyword).toBe("葉焼け");
  });
  it("先頭 ? を許容する", () => {
    expect(parseFilterFromString("?tags=実生").tags).toEqual(["実生"]);
  });
});

describe("serializeFilter ⇄ parseFilter round-trip", () => {
  it("全軸 round-trip", () => {
    const f: DiscoverFilter = {
      tags: ["トマト", "実生"],
      author: "npub1abc",
      keyword: "葉焼け",
      since: SINCE,
      until: UNTIL,
      sort: "old",
    };
    const round = parseFilterFromString(serializeFilter(f));
    expect(round).toEqual(f);
  });
  it("既定は空文字にシリアライズ", () => {
    expect(serializeFilter(EMPTY_FILTER)).toBe("");
  });
  it("sort=new は省略する（URL を汚さない）", () => {
    expect(serializeFilter({ ...EMPTY_FILTER, tags: ["x"], sort: "new" })).toBe("tags=x");
  });
});

describe("applyFilterToParams", () => {
  it("空の軸は削除し、旧 tag も消す", () => {
    const params = new URLSearchParams("tag=old&author=npub1&sort=old&other=keep");
    applyFilterToParams(params, { ...EMPTY_FILTER, tags: ["トマト"] });
    expect(params.get("tags")).toBe("トマト");
    expect(params.has("tag")).toBe(false);
    expect(params.has("author")).toBe(false); // 空なので削除
    expect(params.has("sort")).toBe(false); // new は削除
    expect(params.get("other")).toBe("keep"); // filter 外は触らない
  });
});

describe("isDefaultFilter / hasQueryConstraint", () => {
  it("EMPTY は既定・無制約", () => {
    expect(isDefaultFilter(EMPTY_FILTER)).toBe(true);
    expect(hasQueryConstraint(EMPTY_FILTER)).toBe(false);
  });
  it("sort だけ変えても hasQueryConstraint は false（既定母集団に並べ替えだけ）", () => {
    const f = { ...EMPTY_FILTER, sort: "old" as const };
    expect(hasQueryConstraint(f)).toBe(false);
    expect(isDefaultFilter(f)).toBe(false); // 既定表示ではない（sort 指定あり）
  });
  it("tags/author/keyword いずれかで制約あり", () => {
    expect(hasQueryConstraint({ ...EMPTY_FILTER, tags: ["x"] })).toBe(true);
    expect(hasQueryConstraint({ ...EMPTY_FILTER, author: "npub1" })).toBe(true);
    expect(hasQueryConstraint({ ...EMPTY_FILTER, keyword: "葉" })).toBe(true);
  });
  it("since/until だけは制約に数えない（母集団は既定）", () => {
    expect(hasQueryConstraint({ ...EMPTY_FILTER, since: SINCE })).toBe(false);
  });
});

describe("addTag / removeTag", () => {
  it("正規化して足す・重複は無変化", () => {
    expect(addTag(["トマト"], " #実生 ")).toEqual(["トマト", "実生"]);
    expect(addTag(["トマト"], "トマト")).toEqual(["トマト"]);
  });
  it("空は無変化", () => {
    const tags = ["トマト"];
    expect(addTag(tags, "  ")).toBe(tags);
  });
  it("大小無視で除く", () => {
    expect(removeTag(["Agave", "実生"], "agave")).toEqual(["実生"]);
  });
});

describe("unixToDate", () => {
  it("unix 秒を YYYY-MM-DD（UTC）に", () => {
    expect(unixToDate(SINCE)).toBe("2026-01-01");
    expect(unixToDate(UNTIL)).toBe("2026-03-31");
  });
  it("null は空文字", () => {
    expect(unixToDate(null)).toBe("");
  });
});

describe("tagAliasValues", () => {
  it("辞書に無いタグは自身（小文字）のみ", () => {
    expect(tagAliasValues("トマト")).toEqual(["トマト"]);
  });
  // 辞書ヒットの別名展開は plants/search の責務でそちらでテスト済み。ここでは委譲の形だけ確認。
});

describe("applyClientFilter", () => {
  it("画像なしは除外", () => {
    const posts = [post({ id: "a" }), post({ id: "b", imageUrl: null, imageUrls: [] })];
    expect(applyClientFilter(posts, { tags: [], keyword: "", authorPubkeys: null, since: null, until: null }).map((p) => p.id)).toEqual(["a"]);
  });

  it("tags は軸間 AND（両方持つ投稿だけ）", () => {
    const posts = [
      post({ id: "both", hashtags: ["トマト", "実生"] }),
      post({ id: "one", hashtags: ["トマト"] }),
    ];
    const out = applyClientFilter(posts, {
      tags: ["トマト", "実生"],
      keyword: "",
      authorPubkeys: null,
      since: null,
      until: null,
    });
    expect(out.map((p) => p.id)).toEqual(["both"]);
  });

  it("tags は軸内で別名 OR（resolveTagAliases 経由）", () => {
    const posts = [post({ id: "alias", hashtags: ["グラキリス"] })];
    const out = applyClientFilter(posts, {
      tags: ["パキポ"],
      keyword: "",
      authorPubkeys: null,
      since: null,
      until: null,
      resolveTagAliases: (t) => (t === "パキポ" ? ["パキポ", "グラキリス"] : [t.toLowerCase()]),
    });
    expect(out.map((p) => p.id)).toEqual(["alias"]);
  });

  it("author pubkey で絞る", () => {
    const posts = [post({ id: "mine", pubkey: "pkA" }), post({ id: "other", pubkey: "pkB" })];
    const out = applyClientFilter(posts, { tags: [], keyword: "", authorPubkeys: ["pkA"], since: null, until: null });
    expect(out.map((p) => p.id)).toEqual(["mine"]);
  });

  it("keyword は caption / hashtags に部分一致", () => {
    const posts = [
      post({ id: "cap", caption: "葉焼けした" }),
      post({ id: "tag", hashtags: ["葉焼け"] }),
      post({ id: "no", caption: "元気" }),
    ];
    const out = applyClientFilter(posts, { tags: [], keyword: "葉焼け", authorPubkeys: null, since: null, until: null });
    expect(out.map((p) => p.id).sort()).toEqual(["cap", "tag"]);
  });

  it("since/until で期間を両端含めて絞る", () => {
    const posts = [
      post({ id: "before", createdAt: SINCE - 1 }),
      post({ id: "in", createdAt: SINCE + 100 }),
      post({ id: "after", createdAt: UNTIL + 1 }),
    ];
    const out = applyClientFilter(posts, { tags: [], keyword: "", authorPubkeys: null, since: SINCE, until: UNTIL });
    expect(out.map((p) => p.id)).toEqual(["in"]);
  });

  it("複数軸を同時に AND する", () => {
    const posts = [
      post({ id: "hit", pubkey: "pkA", hashtags: ["トマト"], caption: "葉焼け", createdAt: SINCE + 1 }),
      post({ id: "wrongAuthor", pubkey: "pkB", hashtags: ["トマト"], caption: "葉焼け", createdAt: SINCE + 1 }),
      post({ id: "noTag", pubkey: "pkA", hashtags: [], caption: "葉焼け", createdAt: SINCE + 1 }),
    ];
    const out = applyClientFilter(posts, {
      tags: ["トマト"],
      keyword: "葉焼け",
      authorPubkeys: ["pkA"],
      since: SINCE,
      until: UNTIL,
    });
    expect(out.map((p) => p.id)).toEqual(["hit"]);
  });
});

describe("sortPosts", () => {
  const a = post({ id: "a", createdAt: 300 });
  const b = post({ id: "b", createdAt: 100 });
  const c = post({ id: "c", createdAt: 200 });

  it("new は createdAt 降順", () => {
    expect(sortPosts([b, a, c], "new").map((p) => p.id)).toEqual(["a", "c", "b"]);
  });
  it("old は createdAt 昇順", () => {
    expect(sortPosts([a, b, c], "old").map((p) => p.id)).toEqual(["b", "c", "a"]);
  });
  it("popular はいいね数降順・同数は新着優先", () => {
    const counts = new Map([
      ["a", 1],
      ["b", 5],
      ["c", 5],
    ]);
    // b と c は同数 5 → 新着（createdAt 大）の c が先、次に b、最後に a。
    expect(sortPosts([a, b, c], "popular", counts).map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
  it("元配列を破壊しない", () => {
    const input = [a, b, c];
    sortPosts(input, "old");
    expect(input.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });
});

describe("filterSummary", () => {
  it("空は『みんなの植物』", () => {
    expect(filterSummary(EMPTY_FILTER)).toBe("みんなの植物");
  });
  it("軸を / で連結", () => {
    expect(filterSummary({ ...EMPTY_FILTER, tags: ["トマト", "実生"], author: "@kako", keyword: "葉焼け" })).toBe(
      "トマト・実生 / @kako / 葉焼け",
    );
  });
  it("期間と既定でない並びも含める（sort/期間だけでも退化しない）", () => {
    expect(filterSummary({ ...EMPTY_FILTER, sort: "old" })).toBe("古い順");
    expect(filterSummary({ ...EMPTY_FILTER, since: SINCE, until: UNTIL })).toBe("2026-01-01〜2026-03-31");
    expect(filterSummary({ ...EMPTY_FILTER, since: SINCE })).toBe("2026-01-01〜");
    expect(filterSummary({ ...EMPTY_FILTER, tags: ["トマト"], since: SINCE, until: UNTIL, sort: "popular" })).toBe(
      "トマト / 2026-01-01〜2026-03-31 / 人気順",
    );
  });
});
