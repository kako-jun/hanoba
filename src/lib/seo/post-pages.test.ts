import { describe, expect, it } from "vitest";
import { postPageDescription, postPageTitle, postReadableCaption } from "./post-pages.ts";
import type { FeedPost } from "../feed/parse.ts";

const basePost: FeedPost = {
  id: "e".repeat(64),
  pubkey: "a".repeat(64),
  createdAt: 1_700_000_000,
  caption: "開花した #アガベ\n\n今年もよく伸びた。",
  imageUrls: ["https://example.com/a.jpg"],
  imageUrl: "https://example.com/a.jpg",
  hashtags: ["アガベ", "多肉植物"],
  shotDates: [],
  photoShotDates: [null],
};

describe("post page SEO helpers", () => {
  it("title は本文から #タグを除いた短い Hanoba タイトルにする", () => {
    expect(postPageTitle(basePost)).toBe("開花した 今年もよく伸びた。 — Hanōba");
  });

  it("description は読み本文とタグを含める", () => {
    expect(postPageDescription(basePost)).toBe("開花した 今年もよく伸びた。 #アガベ #多肉植物");
  });

  it("タグだけの投稿でも空にならない", () => {
    const post = { ...basePost, caption: "#アガベ #多肉植物" };
    expect(postReadableCaption(post)).toBe("");
    expect(postPageTitle(post)).toBe("Hanōba の植物 — Hanōba");
    expect(postPageDescription(post)).toBe("Hanōba に置かれた植物写真。 #アガベ #多肉植物");
  });
});
