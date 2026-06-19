import { describe, expect, it } from "vitest";
import { normalizeTag } from "./discover.ts";

describe("normalizeTag", () => {
  it("前後の空白を trim する", () => {
    expect(normalizeTag("  アガベ  ")).toBe("アガベ");
  });

  it("先頭の # を除去する", () => {
    expect(normalizeTag("#アガベ")).toBe("アガベ");
  });

  it("空白と先頭 # の両方を処理する", () => {
    expect(normalizeTag("  #パキポ  ")).toBe("パキポ");
  });

  it("連続する先頭 # も除去する", () => {
    expect(normalizeTag("##植物")).toBe("植物");
  });

  it("先頭以外の # は残す", () => {
    expect(normalizeTag("#a#b")).toBe("a#b");
  });

  it("空文字・空白のみ・# のみは空になる", () => {
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("#")).toBe("");
    expect(normalizeTag("  #  ")).toBe("");
  });
});
