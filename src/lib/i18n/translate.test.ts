import { describe, expect, it } from "vitest";
import { guessLanguageHeuristic, isTranslationSupported, shouldOfferTranslation } from "./translate.ts";

describe("guessLanguageHeuristic（#385・字種の素朴判定）", () => {
  it("ひらがな/カタカナがあれば ja", () => {
    expect(guessLanguageHeuristic("きょうの多肉")).toBe("ja");
    expect(guessLanguageHeuristic("カタカナだけ")).toBe("ja");
    expect(guessLanguageHeuristic("今日は晴れ")).toBe("ja"); // 漢字+かな
  });

  it("漢字のみ（かな無し）は zh", () => {
    expect(guessLanguageHeuristic("今天天气很好")).toBe("zh");
    expect(guessLanguageHeuristic("多肉植物")).toBe("zh"); // かな無し＝中国語寄りに倒す
  });

  it("ラテン文字（en/es）や空は判別不能＝null", () => {
    expect(guessLanguageHeuristic("Hello world")).toBeNull();
    expect(guessLanguageHeuristic("Hola, mi planta")).toBeNull();
    expect(guessLanguageHeuristic("")).toBeNull();
    expect(guessLanguageHeuristic("123 !!!")).toBeNull();
  });
});

describe("isTranslationSupported（feature detection）", () => {
  it("jsdom には Translator が無い＝false（SSR/非対応で安全側）", () => {
    expect(isTranslationSupported()).toBe(false);
  });
});

describe("shouldOfferTranslation（#385・ボタン表示判定）", () => {
  it("非対応ブラウザでは出さない", () => {
    expect(shouldOfferTranslation({ captionText: "Hola", detected: "es", target: "ja", supported: false })).toBe(false);
  });

  it("空 caption は出さない", () => {
    expect(shouldOfferTranslation({ captionText: "  ", detected: null, target: "ja", supported: true })).toBe(false);
  });

  it("判別不能（null）はとりあえず出す（誤って隠さない）", () => {
    expect(shouldOfferTranslation({ captionText: "Hola", detected: null, target: "ja", supported: true })).toBe(true);
  });

  it("検出言語が閲覧言語と同じなら出さない", () => {
    expect(shouldOfferTranslation({ captionText: "今日は", detected: "ja", target: "ja", supported: true })).toBe(false);
  });

  it("サブタグ（en-US）は先頭で比較して同言語と見なす", () => {
    expect(shouldOfferTranslation({ captionText: "Hi", detected: "en-US", target: "en", supported: true })).toBe(false);
  });

  it("検出言語が違えば出す", () => {
    expect(shouldOfferTranslation({ captionText: "Hola", detected: "es", target: "ja", supported: true })).toBe(true);
  });
});
