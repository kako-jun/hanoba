import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER,
  addTag,
  applyClientFilter,
  applyFilterToParams,
  discoverTagHref,
  filterSummary,
  isDefaultFilter,
  parseFilter,
  parseTagList,
  removeTag,
  tagAliasValues,
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
  it("tags パラメータを読む", () => {
    expect(parseFilter(new URLSearchParams("tags=トマト,実生")).tags).toEqual(["トマト", "実生"]);
  });

  it("旧 ?tag= を tags に合流する（後方互換）", () => {
    expect(parseFilter(new URLSearchParams("tag=アガベ")).tags).toEqual(["アガベ"]);
  });

  it("tags と旧 tag を合流し重複は畳む", () => {
    expect(parseFilter(new URLSearchParams("tags=トマト&tag=トマト,実生")).tags).toEqual(["トマト", "実生"]);
  });

  it("無ければ空配列", () => {
    expect(parseFilter(new URLSearchParams("")).tags).toEqual([]);
  });
});

describe("applyFilterToParams", () => {
  it("tags を書き、旧 tag・q を消し、filter 外は触らない", () => {
    const params = new URLSearchParams("tag=old&q=葉焼け&other=keep");
    applyFilterToParams(params, { tags: ["トマト"] });
    expect(params.get("tags")).toBe("トマト");
    expect(params.has("tag")).toBe(false);
    expect(params.has("q")).toBe(false);
    expect(params.get("other")).toBe("keep");
  });
  it("空の tags は削除する", () => {
    const params = new URLSearchParams("tags=トマト");
    applyFilterToParams(params, { tags: [] });
    expect(params.has("tags")).toBe(false);
  });
});

describe("isDefaultFilter", () => {
  it("EMPTY は既定", () => {
    expect(isDefaultFilter(EMPTY_FILTER)).toBe(true);
  });
  it("tags があれば既定ではない", () => {
    expect(isDefaultFilter({ tags: ["x"] })).toBe(false);
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

describe("tagAliasValues", () => {
  it("辞書に無いタグは自身（小文字）のみ", () => {
    expect(tagAliasValues("トマト")).toEqual(["トマト"]);
  });
  // 辞書ヒットの別名展開は plants/search の責務でそちらでテスト済み。ここでは委譲の形だけ確認。
});

describe("applyClientFilter", () => {
  it("画像なしは除外", () => {
    const posts = [post({ id: "a" }), post({ id: "b", imageUrl: null, imageUrls: [] })];
    expect(applyClientFilter(posts, { tags: [] }).map((p) => p.id)).toEqual(["a"]);
  });

  it("tags は軸間 AND（両方持つ投稿だけ）", () => {
    const posts = [
      post({ id: "both", hashtags: ["トマト", "実生"] }),
      post({ id: "one", hashtags: ["トマト"] }),
    ];
    const out = applyClientFilter(posts, { tags: ["トマト", "実生"] });
    expect(out.map((p) => p.id)).toEqual(["both"]);
  });

  it("tags は軸内で別名 OR（resolveTagAliases 経由）", () => {
    const posts = [post({ id: "alias", hashtags: ["グラキリス"] })];
    const out = applyClientFilter(posts, {
      tags: ["パキポ"],
      resolveTagAliases: (t) => (t === "パキポ" ? ["パキポ", "グラキリス"] : [t.toLowerCase()]),
    });
    expect(out.map((p) => p.id)).toEqual(["alias"]);
  });
});

describe("filterSummary", () => {
  it("空は『みんなの植物』", () => {
    expect(filterSummary(EMPTY_FILTER)).toBe("みんなの植物");
  });
  it("タグを ・ で連結", () => {
    expect(filterSummary({ tags: ["トマト", "実生"] })).toBe("トマト・実生");
  });
});

describe("discoverTagHref", () => {
  it("/discover?tags= に本文正規化（空白→_）してエンコードしたタグを載せる（#239 植物札リンク）", () => {
    expect(discoverTagHref("グラキリス")).toBe(`/discover?tags=${encodeURIComponent("グラキリス")}`);
    // 複数語の品種名は本文と同じく空白→_ にしてから載せる（投稿のタグと一致させる）。
    expect(discoverTagHref("フィカス ペティオラリス")).toBe(
      `/discover?tags=${encodeURIComponent("フィカス_ペティオラリス")}`,
    );
  });
});
