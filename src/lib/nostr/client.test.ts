import { describe, expect, it, vi } from "vitest";
import { deletePostImages, fetchMyProfileResilient } from "./client.ts";
import type { Profile } from "../feed/parse.ts";

// #93: nsec 取り込み・編集欄初期化での websites 取りこぼし（単発取得）を bounded retry で塞ぐ。
// 取得1回（fetchOnce）と待ち（wait）はテスト注入できるので、relay を立てずに決定的に検証する。

const PUBKEY = "40612161ffc0f3072230f0c3d58f54a299eeed47011fc2513351f7facf46e6d2";
const withSites: Profile = {
  name: "みどり園",
  picture: null,
  about: null,
  websites: ["https://midori-en.example.com", "https://x.com/midori_test"],
};
const noSites: Profile = { name: "みどり園", picture: null, about: null, websites: [] };
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
    const one: Profile = { name: "x", picture: null, about: null, websites: ["https://a.example.com"] };
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
