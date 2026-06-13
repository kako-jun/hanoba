import { describe, expect, it } from "vitest";
import { detectHashtagQuery, filterHashtagCandidates } from "./hashtag-complete.ts";

describe("detectHashtagQuery", () => {
  it("キャレット直前の #語 を検出する", () => {
    const text = "開花した #アガ";
    const result = detectHashtagQuery(text, text.length);
    expect(result).toEqual({ query: "アガ", start: text.indexOf("#") });
  });

  it("英字の #語 を検出する", () => {
    const text = "nice #aga";
    const result = detectHashtagQuery(text, text.length);
    expect(result).toEqual({ query: "aga", start: 5 });
  });

  it("先頭の # も検出する", () => {
    const text = "#agave";
    const result = detectHashtagQuery(text, text.length);
    expect(result).toEqual({ query: "agave", start: 0 });
  });

  it("# 直後（語が空）も query='' で検出する", () => {
    const text = "今日は #";
    const result = detectHashtagQuery(text, text.length);
    expect(result).toEqual({ query: "", start: text.indexOf("#") });
  });

  it("キャレットが語の途中なら、その時点までの query を返す", () => {
    const text = "#agave です";
    // "#ag" の直後（index 3）にキャレットがある場合
    const result = detectHashtagQuery(text, 3);
    expect(result).toEqual({ query: "ag", start: 0 });
  });

  it("語中の # は検出しない（a#b は非該当）", () => {
    const text = "a#b";
    expect(detectHashtagQuery(text, text.length)).toBeNull();
  });

  it("# の後に空白が来たら（トークン外）検出しない", () => {
    const text = "#agave ";
    expect(detectHashtagQuery(text, text.length)).toBeNull();
  });

  it("# が無ければ null", () => {
    const text = "ただの一言";
    expect(detectHashtagQuery(text, text.length)).toBeNull();
  });

  it("複数タグでもキャレット直前のものを返す", () => {
    const text = "#アガベ #パキ";
    const result = detectHashtagQuery(text, text.length);
    expect(result).toEqual({ query: "パキ", start: text.lastIndexOf("#") });
  });
});

describe("filterHashtagCandidates", () => {
  const pool = ["アガベ", "アガベ実生", "パキポ", "Agave", "agavoides", "種まき"];

  it("前方一致でフィルタする", () => {
    expect(filterHashtagCandidates(pool, "アガベ")).toEqual(["アガベ", "アガベ実生"]);
  });

  it("大小文字を無視して照合し、表示は元の綴り", () => {
    expect(filterHashtagCandidates(pool, "aga")).toEqual(["Agave", "agavoides"]);
  });

  it("query が空なら全件（重複除去後）を limit まで返す", () => {
    const result = filterHashtagCandidates(["a", "b", "c"], "");
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("大小違いの重複を除去する（最初の綴りを採用）", () => {
    const result = filterHashtagCandidates(["Aga", "aga", "AGA"], "ag");
    expect(result).toEqual(["Aga"]);
  });

  it("limit を超えない", () => {
    const big = Array.from({ length: 50 }, (_, i) => `tag${i}`);
    expect(filterHashtagCandidates(big, "tag", 8)).toHaveLength(8);
  });

  it("一致しなければ空配列", () => {
    expect(filterHashtagCandidates(pool, "xyz")).toEqual([]);
  });
});
