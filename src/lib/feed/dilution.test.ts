import { beforeEach, describe, expect, it } from "vitest";
import {
  diluteFeed,
  getAllDilutions,
  getDilution,
  setDilution,
  type DilutionMap,
} from "./dilution.ts";
import type { FeedPost } from "./parse.ts";

// テスト用の最小 FeedPost を作る（間引きは id / pubkey しか見ない）。
function post(id: string, pubkey: string): FeedPost {
  return { id, pubkey, createdAt: 0, caption: "", imageUrls: [], imageUrl: null, hashtags: [] };
}

describe("dilution の状態（get/set/getAll）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("初期状態は空・未設定は null", () => {
    expect(getAllDilutions()).toEqual({});
    expect(getDilution("alice")).toBeNull();
  });

  it("set した level を get で読み戻せる", () => {
    setDilution("alice", 5);
    expect(getDilution("alice")).toBe(5);
    expect(getAllDilutions()).toEqual({ alice: 5 });
  });

  it("level=null で解除する（キー削除）", () => {
    setDilution("alice", 2);
    setDilution("alice", null);
    expect(getDilution("alice")).toBeNull();
    expect(getAllDilutions()).toEqual({});
  });

  it("複数人を独立に持てる", () => {
    setDilution("alice", 2);
    setDilution("bob", 10);
    expect(getAllDilutions()).toEqual({ alice: 2, bob: 10 });
  });

  it("空 pubkey は無視する", () => {
    setDilution("", 5);
    expect(getAllDilutions()).toEqual({});
  });

  it("壊れた保存値は空に倒す", () => {
    window.localStorage.setItem("hanoba:dilution", "{not json");
    expect(getAllDilutions()).toEqual({});
  });

  it("未知の level・配列・非オブジェクトは握り潰す", () => {
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ alice: 3, bob: 5, carol: "x" }));
    // 3 と "x" は捨て、有効な 5 だけ残す。
    expect(getAllDilutions()).toEqual({ bob: 5 });
    window.localStorage.setItem("hanoba:dilution", JSON.stringify([1, 2, 3]));
    expect(getAllDilutions()).toEqual({});
  });
});

describe("diluteFeed（決定的間引きの純関数）", () => {
  it("設定の無い人の投稿は全部残す", () => {
    const posts = [post("a", "alice"), post("b", "alice"), post("c", "alice")];
    expect(diluteFeed(posts, {})).toEqual(posts);
  });

  it("level=2 はおおよそ半分に減らし、相対順序を保つ", () => {
    const posts = Array.from({ length: 200 }, (_, i) => post(`id-${i}`, "alice"));
    const map: DilutionMap = { alice: 2 };
    const out = diluteFeed(posts, map);
    // 厳密に半分とは限らないが、明確に減って 0 でも全件でもない。
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(posts.length);
    // 残った投稿は元の並び順を保つ（filter なので部分列）。
    const idx = out.map((p) => posts.indexOf(p));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
  });

  it("level が大きいほど残る数は少ない（1/2 ≥ 1/5 ≥ 1/10）", () => {
    const posts = Array.from({ length: 500 }, (_, i) => post(`id-${i}`, "alice"));
    const n2 = diluteFeed(posts, { alice: 2 }).length;
    const n5 = diluteFeed(posts, { alice: 5 }).length;
    const n10 = diluteFeed(posts, { alice: 10 }).length;
    expect(n2).toBeGreaterThanOrEqual(n5);
    expect(n5).toBeGreaterThanOrEqual(n10);
  });

  it("deterministic: 同じ入力で何度呼んでも同じ集合が残る", () => {
    const posts = Array.from({ length: 100 }, (_, i) => post(`id-${i}`, "alice"));
    const map: DilutionMap = { alice: 5 };
    const a = diluteFeed(posts, map).map((p) => p.id);
    const b = diluteFeed([...posts], map).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it("設定のある人だけ間引き、他の人は無傷", () => {
    const posts = [
      post("a1", "alice"),
      post("b1", "bob"),
      post("a2", "alice"),
      post("b2", "bob"),
    ];
    const out = diluteFeed(posts, { alice: 10 });
    // bob は設定が無いので必ず全部残る。
    expect(out.filter((p) => p.pubkey === "bob").map((p) => p.id)).toEqual(["b1", "b2"]);
  });
});
