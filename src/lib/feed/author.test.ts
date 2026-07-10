import { describe, expect, it } from "vitest";
import { authorDisplayName, normalizeAuthorName } from "./author.ts";

describe("normalizeAuthorName（#531）", () => {
  it.each([null, undefined, "", "   ", "\t\n"])("%j は未名乗りとして null にする", (name) => {
    expect(normalizeAuthorName(name)).toBeNull();
  });

  it("名前の前後空白を除去する", () => {
    expect(normalizeAuthorName("  葉子 \n")).toBe("葉子");
  });
});

describe("authorDisplayName（#531）", () => {
  it.each([null, undefined, "", "  "])("%j は locale 済みの未名乗り名へフォールバックする", (name) => {
    expect(authorDisplayName(name, "Traveler")).toBe("Traveler");
  });

  it("名乗り済みなら前後空白を除去した名前を返す", () => {
    expect(authorDisplayName("  Yoko  ", "Traveler")).toBe("Yoko");
  });
});
