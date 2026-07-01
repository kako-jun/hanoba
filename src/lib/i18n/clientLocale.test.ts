import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveClientLocale,
  detectClientLocale,
  setClientLocale,
  LOCALE_STORAGE_KEY,
} from "./clientLocale.ts";

/** navigator.languages / navigator.language を差し替える（auto-detect #482 の検証用）。 */
function stubLanguages(langs: string[]): void {
  Object.defineProperty(navigator, "languages", { value: langs, configurable: true });
  Object.defineProperty(navigator, "language", { value: langs[0] ?? "", configurable: true });
}

// happy-dom は localStorage を持つ。各テストの前にクリアして独立させる。
describe("clientLocale", () => {
  beforeEach(() => {
    localStorage.clear();
    // 既定は en 環境（auto-detect が既定へ落ちる）に固定してテストを決定的にする。
    stubLanguages(["en-US"]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe("resolveClientLocale", () => {
    it("保存が無く navigator も対応外なら既定（en）を返す", () => {
      stubLanguages(["en-US"]);
      expect(resolveClientLocale()).toBe("en");
    });

    it("保存が無ければ navigator の優先言語から auto-detect する（ja-JP → ja・#482）", () => {
      stubLanguages(["ja-JP", "en-US"]);
      expect(resolveClientLocale()).toBe("ja");
    });

    it("保存値は navigator 検出より優先される（保存 en・navigator ja でも en）", () => {
      stubLanguages(["ja-JP"]);
      localStorage.setItem(LOCALE_STORAGE_KEY, "en");
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

  describe("detectClientLocale (#482)", () => {
    it("navigator が ja なら ja を返す（日本語 OS/ブラウザ）", () => {
      stubLanguages(["ja-JP", "en-US"]);
      expect(detectClientLocale()).toBe("ja");
    });

    it("navigator が zh / es でもそれぞれ検出する", () => {
      stubLanguages(["zh-CN"]);
      expect(detectClientLocale()).toBe("zh");
      stubLanguages(["es-ES"]);
      expect(detectClientLocale()).toBe("es");
    });

    it("優先リスト全体を見て最初の対応言語を採る（fr-FR, ja-JP → ja）", () => {
      stubLanguages(["fr-FR", "ja-JP", "en-US"]);
      expect(detectClientLocale()).toBe("ja");
    });

    it("対応言語が一つも無ければ既定（en）", () => {
      stubLanguages(["fr-FR", "de-DE"]);
      expect(detectClientLocale()).toBe("en");
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
