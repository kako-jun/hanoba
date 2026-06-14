import { describe, expect, it } from "vitest";
import { deleteImage, extractNostrBuildHash } from "./upload.ts";

const HASH = "a".repeat(64);

describe("extractNostrBuildHash", () => {
  it("image.nostr.build の URL から SHA を取り出す", () => {
    expect(extractNostrBuildHash(`https://image.nostr.build/${HASH}.jpg`)).toBe(HASH);
  });

  it("nostr.build/i/<hash>.png 形式も取り出す", () => {
    expect(extractNostrBuildHash(`https://nostr.build/i/${HASH}.png`)).toBe(HASH);
  });

  it("64桁 hex でないファイル名は null", () => {
    expect(extractNostrBuildHash("https://image.nostr.build/photo.jpg")).toBeNull();
  });

  it("URL でなければ null", () => {
    expect(extractNostrBuildHash("not a url")).toBeNull();
  });
});

describe("deleteImage", () => {
  it("nostr.build でない（SHA を取り出せない）URL は false（fetch しない）", async () => {
    await expect(deleteImage("https://example.com/x.jpg")).resolves.toBe(false);
  });
});
