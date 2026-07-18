import { beforeEach, describe, expect, it } from "vitest";
import {
  APP_STORAGE_KEY,
  getAppStorage,
  setAppStorage,
  updateAppStorage,
  getBookPage,
  setBookPage,
} from "./appStorage.ts";

// 集約 localStorage 境界（#558 Layer3）。get/set/update・壊れ値の握り潰し・部分更新の非破壊を固定する。

describe("appStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getAppStorage", () => {
    it("未保存は空 {}", () => {
      expect(getAppStorage()).toEqual({});
    });

    it("保存済みの JSON をそのまま返す", () => {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ lang: "ja", name: "太郎" }));
      expect(getAppStorage()).toEqual({ lang: "ja", name: "太郎" });
    });

    it("壊れた JSON は {} に倒す", () => {
      localStorage.setItem(APP_STORAGE_KEY, "{not json");
      expect(getAppStorage()).toEqual({});
    });

    it("object 以外（配列・プリミティブ）は {} に倒す", () => {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify([1, 2, 3]));
      expect(getAppStorage()).toEqual({});
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify("just a string"));
      expect(getAppStorage()).toEqual({});
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(null));
      expect(getAppStorage()).toEqual({});
    });
  });

  describe("setAppStorage", () => {
    it("書いて読むと同じ状態に戻る", () => {
      setAppStorage({ lang: "en", useNip07: true });
      expect(getAppStorage()).toEqual({ lang: "en", useNip07: true });
    });

    it("undefined フィールドは直列化で落ちる（キーが消える）", () => {
      setAppStorage({ lang: "ja", name: undefined });
      expect(getAppStorage()).toEqual({ lang: "ja" });
    });
  });

  describe("updateAppStorage", () => {
    it("部分更新で他フィールドを消さない", () => {
      setAppStorage({ lang: "ja", name: "太郎" });
      updateAppStorage((s) => ({ ...s, name: "花子" }));
      expect(getAppStorage()).toEqual({ lang: "ja", name: "花子" });
    });

    it("未保存からの更新でも新規フィールドを書ける", () => {
      updateAppStorage((s) => ({ ...s, recentTags: ["アガベ"] }));
      expect(getAppStorage()).toEqual({ recentTags: ["アガベ"] });
    });

    it("壊れた保存値からの更新は {} を土台に扱う（クラッシュしない）", () => {
      localStorage.setItem(APP_STORAGE_KEY, "{not json");
      updateAppStorage((s) => ({ ...s, lang: "es" }));
      expect(getAppStorage()).toEqual({ lang: "es" });
    });
  });

  describe("book page helpers", () => {
    it("未設定は null", () => {
      expect(getBookPage("gazettePage")).toBeNull();
      expect(getBookPage("handbookPage")).toBeNull();
    });

    it("set した ID を読み戻せる。2 フィールドは互いに独立", () => {
      setBookPage("gazettePage", "welcome");
      setBookPage("handbookPage", "crest");
      expect(getBookPage("gazettePage")).toBe("welcome");
      expect(getBookPage("handbookPage")).toBe("crest");
      // 他フィールド（lang 等）を潰さない設計の確認。
      setAppStorage({ lang: "ja" });
      setBookPage("gazettePage", "vote");
      expect(getAppStorage()).toEqual({ lang: "ja", gazettePage: "vote" });
    });

    it("空文字は null 扱い", () => {
      setBookPage("gazettePage", "");
      expect(getBookPage("gazettePage")).toBeNull();
    });
  });
});
