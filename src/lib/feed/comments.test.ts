import { describe, expect, it } from "vitest";
import { parseComment, sortComments, toComments, type Comment } from "./comments.ts";
import type { NostrEvent } from "../nostr/types.ts";

function makeEvent(overrides: Partial<NostrEvent> & { id: string }): NostrEvent {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    created_at: overrides.created_at ?? 1700000000,
    kind: overrides.kind ?? 1,
    tags: overrides.tags ?? [],
    content: overrides.content ?? "いいですね",
    sig: overrides.sig ?? "",
  };
}

describe("parseComment", () => {
  it("イベントを Comment（id/pubkey/content/createdAt）に変換する", () => {
    const c = parseComment(
      makeEvent({ id: "c1", pubkey: "ab".repeat(32), content: "  改行も残す\n二行目", created_at: 1700001234 }),
    );
    expect(c).toEqual({
      id: "c1",
      pubkey: "ab".repeat(32),
      content: "  改行も残す\n二行目",
      createdAt: 1700001234,
    });
  });
});

describe("toComments", () => {
  it("各イベントを Comment に変換する", () => {
    const result = toComments([
      makeEvent({ id: "c1", content: "一つ目" }),
      makeEvent({ id: "c2", content: "二つ目" }),
    ]);
    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(result.map((c) => c.content)).toEqual(["一つ目", "二つ目"]);
  });

  it("複数リレーから来た同一 id を重複除去する（最初の1件を残す）", () => {
    const result = toComments([
      makeEvent({ id: "dup", content: "relay A 版" }),
      makeEvent({ id: "other", content: "別コメント" }),
      makeEvent({ id: "dup", content: "relay B 版" }),
    ]);
    expect(result.map((c) => c.id)).toEqual(["dup", "other"]);
    // 最初に出会ったものを採用する。
    expect(result[0]!.content).toBe("relay A 版");
  });

  it("空入力は空配列", () => {
    expect(toComments([])).toEqual([]);
  });
});

describe("sortComments", () => {
  const a: Comment = { id: "a", pubkey: "p", content: "古い", createdAt: 100 };
  const b: Comment = { id: "b", pubkey: "p", content: "中", createdAt: 200 };
  const c: Comment = { id: "c", pubkey: "p", content: "新しい", createdAt: 300 };

  it("古い順は createdAt 昇順", () => {
    expect(sortComments([c, a, b], "old").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("新しい順は createdAt 降順", () => {
    expect(sortComments([a, c, b], "new").map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("入力を破壊しない（新しい配列を返す）", () => {
    const input = [c, a, b];
    const before = input.map((x) => x.id);
    sortComments(input, "old");
    expect(input.map((x) => x.id)).toEqual(before);
  });

  it("createdAt 同値は入力順を保つ（安定ソート）", () => {
    const t1: Comment = { id: "t1", pubkey: "p", content: "先", createdAt: 500 };
    const t2: Comment = { id: "t2", pubkey: "p", content: "後", createdAt: 500 };
    expect(sortComments([t1, t2], "old").map((x) => x.id)).toEqual(["t1", "t2"]);
    expect(sortComments([t1, t2], "new").map((x) => x.id)).toEqual(["t1", "t2"]);
  });

  it("空入力は空配列", () => {
    expect(sortComments([], "old")).toEqual([]);
    expect(sortComments([], "new")).toEqual([]);
  });
});
