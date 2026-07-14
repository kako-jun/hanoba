import { describe, expect, it } from "vitest";
import { UPDATE_COOLDOWN_MS, isComposeRoute, isUpdateCooldownActive } from "./updateGuard.ts";

describe("isUpdateCooldownActive（純関数）", () => {
  it("未更新（null）は抑制しない", () => {
    const now = 1_000_000;
    expect(isUpdateCooldownActive(null, now)).toBe(false);
  });

  it("更新直後は抑制中", () => {
    const t = 1_000_000;
    expect(isUpdateCooldownActive(t, t)).toBe(true);
  });

  it("時計巻き戻し（now が lastUpdatedAt より前）も保守的に抑制中とみなす（doc通りの回帰テスト）", () => {
    // #551 QA 指摘で修正：elapsed が負でも elapsed < durationMs は真＝cooldown 中として扱う。
    // 「elapsed >= 0 を別途要求する」実装に戻すと、この1ms巻き戻りケースだけ cooldown が外れ即 reload を
    // 許してしまう＝doc（updateGuard.ts のコメント）の意図と逆行する。
    const t = 1_000_000;
    expect(isUpdateCooldownActive(t, t - 1)).toBe(true);
  });

  it("期間内（クールダウン未経過）は抑制中", () => {
    const t = 1_000_000;
    expect(isUpdateCooldownActive(t, t + UPDATE_COOLDOWN_MS - 1)).toBe(true);
  });

  it("ちょうどクールダウン経過は抑制解除", () => {
    const t = 1_000_000;
    expect(isUpdateCooldownActive(t, t + UPDATE_COOLDOWN_MS)).toBe(false);
  });

  it("クールダウン経過後は抑制しない", () => {
    const t = 1_000_000;
    expect(isUpdateCooldownActive(t, t + UPDATE_COOLDOWN_MS + 1)).toBe(false);
  });
});

describe("isComposeRoute（純関数）", () => {
  it("/compose は true", () => {
    expect(isComposeRoute("/compose")).toBe(true);
  });

  it("末尾スラッシュ付き /compose/ も true", () => {
    expect(isComposeRoute("/compose/")).toBe(true);
  });

  it("/composer は前方一致で誤爆しない（false）", () => {
    expect(isComposeRoute("/composer")).toBe(false);
  });

  it("ホーム / は false", () => {
    expect(isComposeRoute("/")).toBe(false);
  });

  it("空文字は false", () => {
    expect(isComposeRoute("")).toBe(false);
  });

  it("大文字小文字を区別する（/Compose は false）", () => {
    expect(isComposeRoute("/Compose")).toBe(false);
  });
});
