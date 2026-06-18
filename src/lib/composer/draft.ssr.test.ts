// 下書き永続化（#228）の SSR / no-op ガード。
//
// このファイルは **絶対に fake-indexeddb を import しない**（import すると global indexedDB が
// 生えてしまい no-op 分岐を踏めず偽陰性になる）。happy-dom 素の env では indexedDB が未定義で、
// getIDB() が null を返す→各関数が no-op（reject しない・例外を出さない）になることを検証する。
//
// ランナーが global を共有して indexedDB が汚染される可能性に備え、beforeEach で
// vi.stubGlobal("indexedDB", undefined) を掛け、確実に「indexedDB 未定義＝SSR 相当」分岐を踏ませる。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDraft, loadDraft, saveMeta, syncBlobs } from "./draft.ts";

describe("draft 永続化（SSR / indexedDB 未提供）", () => {
  beforeEach(() => {
    // happy-dom 素では未定義だが、他テストの実行順で global が汚染されても確実に未定義へ倒す。
    vi.stubGlobal("indexedDB", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("前提: この env では indexedDB が未定義である", () => {
    expect(typeof indexedDB).toBe("undefined");
  });

  it("loadDraft は null を返す（reject しない）", async () => {
    await expect(loadDraft()).resolves.toBeNull();
  });

  it("syncBlobs は resolve し、例外を出さない（no-op）", async () => {
    await expect(
      syncBlobs([{ id: "a", blob: new Blob([new Uint8Array([1])]), name: "a.jpg", type: "image/jpeg", order: 0 }]),
    ).resolves.toBeUndefined();
  });

  it("saveMeta は resolve し、例外を出さない（no-op）", async () => {
    await expect(
      saveMeta({ caption: "x", currentId: null, items: [{ id: "a", crop: null, filters: [] }] }),
    ).resolves.toBeUndefined();
  });

  it("clearDraft は resolve し、例外を出さない（no-op）", async () => {
    await expect(clearDraft()).resolves.toBeUndefined();
  });

  it("4関数とも console.error / console.warn を呼ばない（黙って no-op）", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await loadDraft();
    await syncBlobs([{ id: "a", blob: new Blob([new Uint8Array([1])]), name: "a.jpg", type: "image/jpeg", order: 0 }]);
    await saveMeta({ caption: "x", currentId: null, items: [] });
    await clearDraft();

    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
