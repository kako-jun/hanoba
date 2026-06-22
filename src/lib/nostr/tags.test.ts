import { describe, expect, it } from "vitest";
import { buildAutoTags, extractHashtags, stripHashtags } from "./tags.ts";

describe("buildAutoTags", () => {
  it("厳密にこの順序のタグを返す（mypace / hanoba / plantstr / client）", () => {
    expect(buildAutoTags()).toEqual([
      ["t", "mypace"],
      ["t", "hanoba"],
      ["t", "plantstr"],
      ["client", "hanoba"],
    ]);
  });

  it("呼ぶたびに新しい配列を返す（共有参照で破壊されない）", () => {
    const a = buildAutoTags();
    const b = buildAutoTags();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("extractHashtags", () => {
  it("英字のハッシュタグを抽出する", () => {
    expect(extractHashtags("育てた #agave かっこいい")).toEqual(["agave"]);
  });

  it("日本語（ひらがな・カタカナ・CJK）のハッシュタグを抽出する", () => {
    expect(extractHashtags("開花した #アガベ #パキポ #植物")).toEqual(["アガベ", "パキポ", "植物"]);
  });

  it("先頭の # を抽出する", () => {
    expect(extractHashtags("#アガベ が咲いた")).toEqual(["アガベ"]);
  });

  it("空白の後の # を抽出する", () => {
    expect(extractHashtags("今日は #種まき した")).toEqual(["種まき"]);
  });

  it("重複は出現順を保ちつつ除去する", () => {
    expect(extractHashtags("#アガベ いいね #アガベ 最高 #パキポ")).toEqual(["アガベ", "パキポ"]);
  });

  it("単語内の # は抽出しない（a#b は非該当）", () => {
    expect(extractHashtags("a#b は無視 #ok")).toEqual(["ok"]);
  });

  it("ハッシュタグが無ければ空配列", () => {
    expect(extractHashtags("ただの一言です")).toEqual([]);
  });

  it("引用記号(>)の直後の # も抽出する", () => {
    expect(extractHashtags(">#引用タグ")).toEqual(["引用タグ"]);
  });

  it("大小文字はそのまま保持する", () => {
    expect(extractHashtags("#Agave と #agave は別")).toEqual(["Agave", "agave"]);
  });
});

describe("stripHashtags", () => {
  it("末尾のタグを除いて本文だけ返す", () => {
    expect(stripHashtags("開花した #アガベ #パキポ")).toBe("開花した");
  });

  it("文中・先頭のタグも除き、余分な空白を畳む", () => {
    expect(stripHashtags("#アガベ が #種まき から咲いた")).toBe("が から咲いた");
  });

  it("単語内の # は本文として残す（a#b は非タグ）", () => {
    expect(stripHashtags("a#b は残す #ok")).toBe("a#b は残す");
  });

  it("改行は保ちつつ行頭行末の余白を除く", () => {
    expect(stripHashtags("一行目 #t1\n二行目 #t2")).toBe("一行目\n二行目");
  });

  it("タグだけの本文は空文字になる", () => {
    expect(stripHashtags("#アガベ #パキポ")).toBe("");
  });

  it("全角空白区切りのタグを除去し、残った連続空白を畳む", () => {
    expect(stripHashtags("開花　#アガベ　最高")).toBe("開花 最高");
  });

  it("タグが無ければそのまま（trim のみ）", () => {
    expect(stripHashtags("  ただの一言です  ")).toBe("ただの一言です");
  });

  it("空行（段落区切り）は残す（#65）", () => {
    expect(stripHashtags("一段目\n\n二段目 #タグ")).toBe("一段目\n\n二段目");
  });
});
