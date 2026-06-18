import { beforeEach, describe, expect, it } from "vitest";
import {
  addSavedView,
  getSavedViews,
  KEY,
  removeSavedView,
  type SavedView,
} from "./views.ts";

describe("名前付きビューの状態（get/add/remove・#139 段階3）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("初期状態は空配列", () => {
    expect(getSavedViews()).toEqual([]);
  });

  it("add したビューを get で読み戻せる（末尾追加・id 付与）", () => {
    const after = addSavedView("実生", "#アガベ");
    expect(after).toHaveLength(1);
    expect(after[0]!.label).toBe("実生");
    expect(after[0]!.query).toBe("#アガベ");
    expect(typeof after[0]!.id).toBe("string");
    expect(after[0]!.id).not.toBe("");
    expect(getSavedViews()).toEqual(after);
  });

  it("複数 add は配列順（末尾追加＝先頭が古い）を保つ", () => {
    addSavedView("実生", "#アガベ");
    addSavedView("塊根", "#塊根植物");
    const views = getSavedViews();
    expect(views.map((v) => v.label)).toEqual(["実生", "塊根"]);
  });

  it("label / query を trim する", () => {
    const after = addSavedView("  実生  ", "  #アガベ  ");
    expect(after[0]!.label).toBe("実生");
    expect(after[0]!.query).toBe("#アガベ");
  });

  it("空 label は追加しない（現状を返す）", () => {
    expect(addSavedView("", "#アガベ")).toEqual([]);
    expect(addSavedView("   ", "#アガベ")).toEqual([]);
    expect(getSavedViews()).toEqual([]);
  });

  it("空 query は追加しない（現状を返す）", () => {
    expect(addSavedView("実生", "")).toEqual([]);
    expect(addSavedView("実生", "   ")).toEqual([]);
    expect(getSavedViews()).toEqual([]);
  });

  it("同 query は二重登録しない（最初の1件で代表・label 上書きもしない）", () => {
    addSavedView("実生", "#アガベ");
    const after = addSavedView("アガベ全部", "#アガベ");
    expect(after).toHaveLength(1);
    expect(after[0]!.label).toBe("実生"); // 上書きしない
  });

  it("trim 後に同 query になるものも二重登録しない", () => {
    addSavedView("実生", "#アガベ");
    const after = addSavedView("別名", "  #アガベ  ");
    expect(after).toHaveLength(1);
  });

  it("remove で id 指定のビューを消す", () => {
    addSavedView("実生", "#アガベ");
    const two = addSavedView("塊根", "#塊根植物");
    // 先頭（実生 = #アガベ）を id 指定で消す → 末尾（塊根）だけ残る。
    const targetId = two[0]!.id;
    const after = removeSavedView(targetId);
    expect(after).toHaveLength(1);
    expect(after.find((v) => v.id === targetId)).toBeUndefined();
    expect(after[0]!.label).toBe("塊根");
  });

  it("無い id の remove は現状を返す", () => {
    addSavedView("実生", "#アガベ");
    const before = getSavedViews();
    expect(removeSavedView("nope")).toEqual(before);
  });

  it("壊れた JSON は空配列に倒す", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(getSavedViews()).toEqual([]);
  });

  it("配列でない値は空配列に倒す", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ label: "x" }));
    expect(getSavedViews()).toEqual([]);
  });

  it("形の合わない要素だけ除外する（残りは生かす）", () => {
    const mixed = [
      { id: "a", label: "良", query: "#q" },
      { id: "b", label: "欠 query" }, // query 欠落
      { label: "id 欠落", query: "#x" }, // id 欠落
      "ただの文字列",
      null,
    ];
    window.localStorage.setItem(KEY, JSON.stringify(mixed));
    const views: SavedView[] = getSavedViews();
    expect(views).toEqual([{ id: "a", label: "良", query: "#q" }]);
  });
});
