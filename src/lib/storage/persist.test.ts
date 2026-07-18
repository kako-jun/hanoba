import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPersistentStorage } from "./persist.ts";

// navigator.storage をテストごとに差し替える（happy-dom には StorageManager が無い/限定的なため
// configurable な defineProperty でスタブし、afterEach で元へ戻す）。
const originalStorageDescriptor = Object.getOwnPropertyDescriptor(navigator, "storage");

function setStorage(storage: unknown): void {
  Object.defineProperty(navigator, "storage", { value: storage, configurable: true });
}

afterEach(() => {
  if (originalStorageDescriptor) {
    Object.defineProperty(navigator, "storage", originalStorageDescriptor);
  } else {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "storage");
  }
  vi.restoreAllMocks();
});

describe("requestPersistentStorage", () => {
  it("既に persisted なら persist() を呼ばず 'persisted' を返す（冪等）", async () => {
    const persist = vi.fn();
    setStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    await expect(requestPersistentStorage()).resolves.toBe("persisted");
    expect(persist).not.toHaveBeenCalled();
  });

  it("未 persisted かつ persist()=true なら 'persisted'", async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(true) });

    await expect(requestPersistentStorage()).resolves.toBe("persisted");
  });

  it("未 persisted かつ persist()=false なら 'prompted-denied'", async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockResolvedValue(false) });

    await expect(requestPersistentStorage()).resolves.toBe("prompted-denied");
  });

  it("navigator.storage が無い環境では例外を出さず 'unsupported'", async () => {
    setStorage(undefined);

    await expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });

  it("persist() が throw しても握りつぶして 'unsupported'", async () => {
    setStorage({ persisted: vi.fn().mockResolvedValue(false), persist: vi.fn().mockRejectedValue(new Error("boom")) });

    await expect(requestPersistentStorage()).resolves.toBe("unsupported");
  });
});
