import { describe, expect, it } from "vitest";
import { buildAutoTags, extractHashtags } from "./tags.ts";

describe("buildAutoTags", () => {
  it("厳密にこの順序のタグを返す（mypace / hanoba / client）", () => {
    expect(buildAutoTags()).toEqual([
      ["t", "mypace"],
      ["t", "hanoba"],
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
