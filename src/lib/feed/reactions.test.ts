import { describe, expect, it } from "vitest";
import { countLikes, countLikesByEvent, isLike } from "./reactions.ts";
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

describe("countLikesByEvent", () => {
  // 対象投稿を e タグで指す kind:7 を作る（複数 id の振り分けを試す）。
  function reactionFor(eventId: string, pubkey: string, content = "+"): NostrEvent {
    return makeReaction({ id: `r-${eventId}-${pubkey}-${content}`, pubkey, content, tags: [["e", eventId]] });
  }

  it("eventIds の全 id をキーに持つ（該当0件の id は 0）", () => {
    const result = countLikesByEvent([], ["p1", "p2"]);
    expect([...result.entries()].sort()).toEqual([
      ["p1", 0],
      ["p2", 0],
    ]);
  });

  it("リアクションを e タグで投稿 id ごとに振り分けて数える", () => {
    const reactions = [
      reactionFor("p1", "a"),
      reactionFor("p1", "b"),
      reactionFor("p2", "c"),
    ];
    const result = countLikesByEvent(reactions, ["p1", "p2"]);
    expect(result.get("p1")).toBe(2);
    expect(result.get("p2")).toBe(1);
  });

  it("eventIds に無い投稿宛のリアクションは無視する", () => {
    const reactions = [reactionFor("p1", "a"), reactionFor("other", "b")];
    const result = countLikesByEvent(reactions, ["p1"]);
    expect(result.get("p1")).toBe(1);
    expect(result.has("other")).toBe(false);
  });

  it("dislike 除外がバッチでも効く（投稿ごとに countLikes を通す）", () => {
    const reactions = [
      reactionFor("p1", "a", "+"),
      reactionFor("p1", "b", "-"),
      reactionFor("p2", "c", "-"),
    ];
    const result = countLikesByEvent(reactions, ["p1", "p2"]);
    expect(result.get("p1")).toBe(1); // a は like、b の dislike は除外
    expect(result.get("p2")).toBe(0); // c は dislike のみ
  });

  it("同一 pubkey の重複は投稿ごとに 1 票に畳む", () => {
    const reactions = [reactionFor("p1", "a"), reactionFor("p1", "a", "🌸")];
    const result = countLikesByEvent(reactions, ["p1"]);
    expect(result.get("p1")).toBe(1);
  });

  it("複数 e タグのリアクションは eventIds に一致する値へ割り当てる", () => {
    const reaction = makeReaction({
      id: "multi",
      pubkey: "a",
      content: "+",
      tags: [
        ["e", "unrelated"],
        ["e", "p2"],
      ],
    });
    const result = countLikesByEvent([reaction], ["p1", "p2"]);
    expect(result.get("p1")).toBe(0);
    expect(result.get("p2")).toBe(1);
  });

  it("eventIds が空なら空 Map", () => {
    expect(countLikesByEvent([reactionFor("p1", "a")], [])).toEqual(new Map());
  });
});
