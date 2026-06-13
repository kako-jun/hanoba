import { finalizeEvent } from "nostr-tools/pure";
import { bytesToHex } from "nostr-tools/utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildNoteTemplate } from "./events.ts";
import { exportNsec, getStoredSecretKey, importNsec } from "./keys.ts";

// 固定 sk = 0x01,0x02,...,0x20（32 bytes）。決定性の検証に使う。
const FIXED_SK = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
const SK_KEY = "hanoba:sk";

describe("keys: 決定性（nostr-tools 配線の実証）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("固定 sk＋固定 created_at で finalizeEvent の id が決定的", () => {
    const template = buildNoteTemplate({
      caption: "開花した #アガベ",
      imageUrls: ["https://image.nostr.build/xxx.jpg"],
      createdAt: 1700000000,
    });
    const ev1 = finalizeEvent(template, FIXED_SK);
    const ev2 = finalizeEvent(template, FIXED_SK);

    // 同入力 → 同 id
    expect(ev1.id).toBe(ev2.id);
    // バイト互換の回帰検出用に既知値で固定（mypace と同じ event id を生む配線）
    expect(ev1.id).toBe("d0e5d1f5246466c68bfb50f4bbc84022ae75b17ef3bd5d8c407a3f3cc80d7ede");
    expect(ev1.pubkey).toBe("84bf7562262bbd6940085748f3be6afa52ae317155181ece31b66351ccffa4b0");
  });
});

describe("keys: nsec ラウンドトリップ", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("exportNsec → importNsec で sk が一致する", () => {
    // 固定 sk を保存してから export
    window.localStorage.setItem(SK_KEY, bytesToHex(FIXED_SK));
    const nsec = exportNsec();
    expect(nsec.startsWith("nsec1")).toBe(true);

    // 別の鍵で上書きしてから importNsec で戻す
    window.localStorage.setItem(SK_KEY, "00".repeat(32));
    importNsec(nsec);

    const restored = getStoredSecretKey();
    expect(restored).not.toBeNull();
    expect(bytesToHex(restored as Uint8Array)).toBe(bytesToHex(FIXED_SK));
  });

  it("nsec でない文字列を importNsec すると throw する", () => {
    expect(() => importNsec("npub1invalidvalue")).toThrow();
  });
});
