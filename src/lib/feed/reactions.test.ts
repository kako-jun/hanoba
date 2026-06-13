import { describe, expect, it } from "vitest";
import { countLikes, isLike } from "./reactions.ts";
import type { NostrEvent } from "../nostr/types.ts";

// テスト用の最小 kind:7 イベント。集計は pubkey と content しか参照しない。
function makeReaction(overrides: Partial<NostrEvent> & { pubkey: string; content: string }): NostrEvent {
  return {
    id: overrides.id ?? `react-${overrides.pubkey}-${overrides.content}`,
    pubkey: overrides.pubkey,
    created_at: overrides.created_at ?? 1000,
    kind: 7,
    tags: overrides.tags ?? [["e", "target-event-id"]],
    content: overrides.content,
    sig: "",
  };
}

describe("isLike", () => {
  it("\"+\" は like", () => {
    expect(isLike(makeReaction({ pubkey: "a", content: "+" }))).toBe(true);
  });

  it("空文字は like 扱い", () => {
    expect(isLike(makeReaction({ pubkey: "a", content: "" }))).toBe(true);
  });

  it("絵文字は like 扱い", () => {
    expect(isLike(makeReaction({ pubkey: "a", content: "🌱" }))).toBe(true);
  });

  it("\"-\"（dislike）だけ like ではない", () => {
    expect(isLike(makeReaction({ pubkey: "a", content: "-" }))).toBe(false);
  });
});

describe("countLikes", () => {
  it("空配列は 0", () => {
    expect(countLikes([])).toBe(0);
  });

  it("別 pubkey の \"+\" 複数は人数を数える", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "+" }),
      makeReaction({ pubkey: "b", content: "+" }),
      makeReaction({ pubkey: "c", content: "+" }),
    ];
    expect(countLikes(reactions)).toBe(3);
  });

  it("同一 pubkey の重複は 1 票に畳む（1 人 1 いいね）", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "+" }),
      makeReaction({ pubkey: "a", content: "+" }),
      makeReaction({ pubkey: "a", content: "🌸" }),
    ];
    expect(countLikes(reactions)).toBe(1);
  });

  it("dislike（\"-\"）は除外する", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "+" }),
      makeReaction({ pubkey: "b", content: "-" }),
    ];
    expect(countLikes(reactions)).toBe(1);
  });

  it("絵文字リアクションも like として計上する", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "🌱" }),
      makeReaction({ pubkey: "b", content: "❤️" }),
    ];
    expect(countLikes(reactions)).toBe(2);
  });

  it("\"+\" と \"-\" 混在では \"-\" を除外する", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "+" }),
      makeReaction({ pubkey: "b", content: "+" }),
      makeReaction({ pubkey: "c", content: "-" }),
      makeReaction({ pubkey: "d", content: "-" }),
    ];
    expect(countLikes(reactions)).toBe(2);
  });

  it("同一 pubkey が like→dislike を出したら最後（dislike）を採用して数えない", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "+" }),
      makeReaction({ pubkey: "a", content: "-" }),
    ];
    expect(countLikes(reactions)).toBe(0);
  });

  it("同一 pubkey が dislike→like を出したら最後（like）を採用して数える", () => {
    const reactions = [
      makeReaction({ pubkey: "a", content: "-" }),
      makeReaction({ pubkey: "a", content: "+" }),
    ];
    expect(countLikes(reactions)).toBe(1);
  });
});
