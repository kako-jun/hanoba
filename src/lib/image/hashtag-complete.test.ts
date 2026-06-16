import { describe, expect, it } from "vitest";
import {
  captionHasTag,
  detectHashtagQuery,
  filterHashtagCandidates,
  insertTag,
  removeTag,
} from "./hashtag-complete.ts";

describe("removeTag", () => {
  it("末尾のタグを外し、末尾空白は1つ保つ", () => {
    expect(removeTag("#多肉植物 #アガベ #チタノタ ", "チタノタ")).toBe("#多肉植物 #アガベ ");
  });

  it("中間のタグを外して二重空白を残さない", () => {
    expect(removeTag("メモ #多肉植物 #アガベ ", "多肉植物")).toBe("メモ #アガベ ");
  });

  it("先頭 # 付き・内部空白入りの引数でも外せる", () => {
    expect(removeTag("#我が家_の株 です", "#我が家 の株")).toBe(" です");
  });

  it("語の一部には誤爆しない", () => {
    expect(removeTag("#チタノタス ", "チタノタ")).toBe("#チタノタス ");
  });

  it("無関係な散文の連続スペースは畳まない", () => {
    expect(removeTag("hello  world #アガベ ", "アガベ")).toBe("hello  world ");
  });

  it("タグ行の最後の1つを外したら散文末尾に空行（改行）を残さない", () => {
    expect(removeTag("水やり\n#アガベ ", "アガベ")).toBe("水やり ");
  });

  it("タグ行に兄弟が残るなら改行（タグ行）は保つ", () => {
    expect(removeTag("水やり\n#アガベ #パキポ ", "パキポ")).toBe("水やり\n#アガベ ");
  });

  it("散文中の改行は #タグ を含まないので触れない", () => {
    expect(removeTag("一行目\n二行目 #アガベ ", "アガベ")).toBe("一行目\n二行目 ");
  });

  it("除去後に末尾が空の改行行ならタブ・複数空白ごと畳む（collapse 分岐）", () => {
    // 既存の "prose\n#tag " ケースは除去正規表現が \n を飲むので collapse 分岐に入らない。
    // ここでは除去後に末尾が \n[ \t]* で終わる構成を作り、collapse（\n[ \t]*$）だけを射抜く。
    expect(removeTag("水やり\n#アガベ\n  ", "アガベ")).toBe("水やり"); // 改行+複数空白
    expect(removeTag("水やり\n#アガベ\n\t", "アガベ")).toBe("水やり"); // 改行+タブ
    expect(removeTag("水やり #アガベ\n", "アガベ")).toBe("水やり"); // 行内タグ＋末尾改行
  });

  it("除去後の末尾が改行でない（タグ直後がタブ/空白）なら畳まずその空白を残す", () => {
    // 除去正規表現が \n を飲み、末尾はタブ/空白だけ＝collapse の対象外。境界の取り違え防止。
    expect(removeTag("水やり\n#アガベ\t", "アガベ")).toBe("水やり\t");
    expect(removeTag("水やり\n#アガベ   ", "アガベ")).toBe("水やり   ");
  });

  it("兄弟が残るタグ行はタブ・複数空白が末尾でも改行を保つ", () => {
    // 兄弟（#アガベ）が末尾行に残るので空タグ行ではない＝改行は畳まない。
    // 除去正規表現は #パキポ の前の空白を飲むので、直後のタブはそのまま残る。
    expect(removeTag("水やり\n#アガベ #パキポ\t", "パキポ")).toBe("水やり\n#アガベ\t");
  });

  it("無ければそのまま・insertTag と往復で戻る", () => {
    expect(removeTag("#アガベ ", "パキポディウム")).toBe("#アガベ ");
    const added = insertTag("メモ", "アガベ");
    expect(captionHasTag(removeTag(added, "アガベ"), "アガベ")).toBe(false);
  });
});

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

  it("散文の末尾には改行で分けてタグ行を作る", () => {
    expect(insertTag("開花", "アガベ")).toBe("開花\n#アガベ ");
    expect(insertTag("水やり", "アガベ")).toBe("水やり\n#アガベ ");
  });

  it("散文が改行で終わっていれば二重改行しない", () => {
    expect(insertTag("開花\n", "アガベ")).toBe("開花\n#アガベ ");
  });

  it("末尾行が既にタグ行なら同じ行にスペース区切りで積む", () => {
    expect(insertTag("水やり\n#アガベ ", "パキポ")).toBe("水やり\n#アガベ #パキポ ");
    expect(insertTag("#アガベ", "パキポ")).toBe("#アガベ #パキポ ");
  });

  it("タグ行が空白で終わっていれば二重空白にしない", () => {
    expect(insertTag("#アガベ ", "パキポ")).toBe("#アガベ #パキポ ");
  });

  it("散文に対しカテゴリ→属→品種の順で3連挿入すると1本のタグ行に積む", () => {
    // ピッカーの品種選択（#カテゴリ→#属→#品種 の順で onPick 3回）に相当。
    // 1回目で散文と改行で分かれ、2・3回目は末尾タグ行へスペースで継続する。
    let c = "我が家の株";
    c = insertTag(c, "多肉植物");
    expect(c).toBe("我が家の株\n#多肉植物 ");
    c = insertTag(c, "アガベ");
    expect(c).toBe("我が家の株\n#多肉植物 #アガベ ");
    c = insertTag(c, "チタノタ");
    expect(c).toBe("我が家の株\n#多肉植物 #アガベ #チタノタ ");
  });

  it("文字種（英・かな・CJK）いずれの散文でも改行で分けてタグ行を作る", () => {
    expect(insertTag("flowering", "Agave")).toBe("flowering\n#Agave ");
    expect(insertTag("みずやり", "あがべ")).toBe("みずやり\n#あがべ ");
    expect(insertTag("開花", "多肉植物")).toBe("開花\n#多肉植物 ");
  });

  it("タグ行がタブで終わっていても二重空白にせずそのまま継続する", () => {
    // 継続判定は /\s$/ なのでタブ末尾でも区切りを足さない（タブ＝既存の区切り扱い）。
    expect(insertTag("#アガベ\t", "パキポ")).toBe("#アガベ\t#パキポ ");
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
