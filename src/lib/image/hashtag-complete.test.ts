import { describe, expect, it } from "vitest";
import { captionHasTag, detectHashtagQuery, filterHashtagCandidates, insertTag } from "./hashtag-complete.ts";

describe("captionHasTag", () => {
  it("独立した #タグ が含まれれば true（大小無視）", () => {
    expect(captionHasTag("今日は #チタノタ が届いた", "チタノタ")).toBe(true);
    expect(captionHasTag("#Albo 最高", "albo")).toBe(true);
  });

  it("先頭 # 付き・内部空白入りの引数も正規化して判定する", () => {
    expect(captionHasTag("#我が家_の株 です", "#我が家 の株")).toBe(true);
  });

  it("部分一致（語の一部）では true にしない", () => {
    expect(captionHasTag("#チタノタス", "チタノタ")).toBe(false);
    expect(captionHasTag("aチタノタ", "チタノタ")).toBe(false);
  });

  it("含まれなければ false。空タグも false", () => {
    expect(captionHasTag("#アガベ", "パキポディウム")).toBe(false);
    expect(captionHasTag("#アガベ", "  ")).toBe(false);
  });

  it("insertTag と整合（入れた直後は true）", () => {
    const c = insertTag("メモ", "ブレビカウレ");
    expect(captionHasTag(c, "ブレビカウレ")).toBe(true);
  });
});

describe("insertTag", () => {
  it("空の本文には #タグ と末尾空白を入れる", () => {
    expect(insertTag("", "アガベ")).toBe("#アガベ ");
  });

  it("既存本文の末尾に区切り空白付きで足す", () => {
    expect(insertTag("開花", "アガベ")).toBe("開花 #アガベ ");
  });

  it("末尾が空白なら二重空白にしない", () => {
    expect(insertTag("開花 ", "アガベ")).toBe("開花 #アガベ ");
  });

  it("タグ内のスペースはアンダースコアにする", () => {
    expect(insertTag("", "Perle von Nürnberg")).toBe("#Perle_von_Nürnberg ");
  });

  it("先頭 # は除去して付け直す", () => {
    expect(insertTag("", "#モンステラ")).toBe("#モンステラ ");
  });

  it("既にあるタグは二重に足さない（大小無視）", () => {
    expect(insertTag("#アガベ ", "アガベ")).toBe("#アガベ ");
    expect(insertTag("my #Agave here", "agave")).toBe("my #Agave here");
  });

  it("空タグは本文をそのまま返す", () => {
    expect(insertTag("x", "   ")).toBe("x");
  });
});

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
