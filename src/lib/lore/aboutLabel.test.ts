import { describe, expect, it } from "vitest";
import { aboutLabelVisitor, aboutLabelCitizen } from "./aboutLabel.ts";
import { DEFAULT_LOCALE } from "../i18n/locale.ts";

// about ラベルは (言語)×(訪問者/市民) の 2 軸（#390）。純関数が各 locale で正しい4文字列を返すことを固定する。
// （殻の言語 swap・名乗り swap の合成は .astro 側 is:inline で、ここでは文言の引きだけを担保する）
describe("aboutLabel（#262/#390・2軸の文言）", () => {
  it("訪問者ラベルを locale 別に引く", () => {
    expect(aboutLabelVisitor("ja")).toBe("Hanōba とは");
    expect(aboutLabelVisitor("en")).toBe("About Hanōba");
  });

  it("市民ラベルを locale 別に引く", () => {
    expect(aboutLabelCitizen("ja")).toBe("市民手帳");
    expect(aboutLabelCitizen("en")).toBe("Citizen's Handbook");
  });

  it("locale 省略時は DEFAULT_LOCALE で解決する（殻が焼かれる言語）", () => {
    expect(aboutLabelVisitor()).toBe(aboutLabelVisitor(DEFAULT_LOCALE));
    expect(aboutLabelCitizen()).toBe(aboutLabelCitizen(DEFAULT_LOCALE));
  });
});
