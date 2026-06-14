import { describe, expect, it } from "vitest";
import { rankHashtags } from "./popular.ts";

describe("rankHashtags", () => {
  it("出現回数で降順に並べる", () => {
    const got = rankHashtags([
      ["アガベ", "パキポ"],
      ["アガベ"],
      ["アガベ", "パキポ"],
      ["モンステラ"],
    ]);
    expect(got).toEqual([
      { tag: "アガベ", count: 3 },
      { tag: "パキポ", count: 2 },
      { tag: "モンステラ", count: 1 },
    ]);
  });

  it("大小無視で畳み、最初の綴りを採用する", () => {
    const got = rankHashtags([["Agave"], ["agave"], ["AGAVE"]]);
    expect(got).toEqual([{ tag: "Agave", count: 3 }]);
  });

  it("同数は初出順を保つ（安定）", () => {
    const got = rankHashtags([["a", "b"]]);
    expect(got.map((t) => t.tag)).toEqual(["a", "b"]);
  });

  it("limit で件数を絞る", () => {
    const got = rankHashtags([["a", "b", "c", "d"]], 2);
    expect(got).toHaveLength(2);
  });

  it("空入力は空", () => {
    expect(rankHashtags([])).toEqual([]);
  });
});
