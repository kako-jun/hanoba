import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClientLocale, setClientLocale, LOCALE_STORAGE_KEY } from "./clientLocale.ts";

// happy-dom は localStorage を持つ。各テストの前にクリアして独立させる。
describe("clientLocale", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("resolveClientLocale", () => {
    it("保存が無ければ既定（go-live で en）を返す", () => {
      expect(resolveClientLocale()).toBe("en");
    });

    it("localStorage に保存した言語を読む（en）", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "en");
      expect(resolveClientLocale()).toBe("en");
    });

    it("localStorage に保存した言語を読む（ja）", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "ja");
      expect(resolveClientLocale()).toBe("ja");
    });

    it("未対応の値は既定（en）に落とす", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
      expect(resolveClientLocale()).toBe("en");
    });

    it("空文字も既定（en）に落とす", () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, "");
      expect(resolveClientLocale()).toBe("en");
    });
  });

  describe("setClientLocale", () => {
    it("選んだ言語を保存し、リロードする", () => {
      // location.reload を spy（実リロードは happy-dom 上で副作用になるため差し替える）。
      const reload = vi.spyOn(location, "reload").mockImplementation(() => {});
      setClientLocale("en");
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en");
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("ja を保存しても同様にリロードする", () => {
      const reload = vi.spyOn(location, "reload").mockImplementation(() => {});
      setClientLocale("ja");
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("保存した値は resolveClientLocale で読み戻せる", () => {
      vi.spyOn(location, "reload").mockImplementation(() => {});
      setClientLocale("en");
      expect(resolveClientLocale()).toBe("en");
    });
  });
});
