import { beforeEach, describe, expect, it } from "vitest";
import { getRecentTags, pushRecentTag, recordRecentTags } from "./recent-tags.ts";

describe("recent-tags", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("初期状態は空配列", () => {
    expect(getRecentTags()).toEqual([]);
  });

  it("push したタグが先頭に来る（新しい順）", () => {
    pushRecentTag("チタノタ");
    pushRecentTag("水やり");
    expect(getRecentTags()).toEqual(["水やり", "チタノタ"]);
  });

  it("先頭 # を除去して保存する", () => {
    pushRecentTag("#開花");
    expect(getRecentTags()).toEqual(["開花"]);
  });

  it("同じタグを再 push すると先頭に繰り上げ・重複しない（大小無視）", () => {
    pushRecentTag("Albo");
    pushRecentTag("チタノタ");
    pushRecentTag("albo");
    expect(getRecentTags()).toEqual(["albo", "チタノタ"]);
  });

  it("最大12件で打ち切る", () => {
    for (let i = 0; i < 20; i++) pushRecentTag(`タグ${i}`);
    const recent = getRecentTags();
    expect(recent).toHaveLength(12);
    expect(recent[0]).toBe("タグ19");
  });

  it("空タグは無視する", () => {
    pushRecentTag("   ");
    pushRecentTag("#");
    expect(getRecentTags()).toEqual([]);
  });

  it("壊れた保存値は空配列に倒す", () => {
    window.localStorage.setItem("hanoba:recent-tags", "{not json");
    expect(getRecentTags()).toEqual([]);
  });

  it("配列でない保存値も空配列に倒す", () => {
    window.localStorage.setItem("hanoba:recent-tags", JSON.stringify({ a: 1 }));
    expect(getRecentTags()).toEqual([]);
  });

  describe("recordRecentTags（投稿成功後の一括記録）", () => {
    it("投稿のタグ群を記録する（先頭が最も新しく見える＝配列の並び順を保つ）", () => {
      recordRecentTags(["多肉植物", "アガベ", "チタノタ"]);
      expect(getRecentTags()).toEqual(["多肉植物", "アガベ", "チタノタ"]);
    });

    it("複数回の投稿で新しい投稿のタグが前に来る・重複は繰り上げ", () => {
      recordRecentTags(["アガベ", "チタノタ"]);
      recordRecentTags(["パキポディウム", "アガベ"]);
      expect(getRecentTags()).toEqual(["パキポディウム", "アガベ", "チタノタ"]);
    });
  });
});
