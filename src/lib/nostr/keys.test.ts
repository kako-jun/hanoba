import { finalizeEvent } from "nostr-tools/pure";
import { bytesToHex } from "nostr-tools/utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildNoteTemplate } from "./events.ts";
import {
  exportNsec,
  getProfileExtra,
  getPublicKeyHex,
  getStoredSecretKey,
  importNsec,
  isNip07Enabled,
  mergeProfileExtra,
  setProfileExtra,
  setUseNip07,
} from "./keys.ts";

// 固定 sk = 0x01,0x02,...,0x20（32 bytes）。決定性の検証に使う。
const FIXED_SK = new Uint8Array(Array.from({ length: 32 }, (_, i) => i + 1));
const SK_KEY = "hanoba:sk";
const USE_NIP07_KEY = "hanoba:useNip07";

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
    // バイト互換の回帰検出用に既知値で固定（mypace と同じ event id を生む配線）。
    // content が "開花した #アガベ #plantstr\n<url>" になった（#408・本文 #plantstr 自動併記）
    // ため既知 id を更新。pubkey は鍵由来で content に依らないので不変。
    expect(ev1.id).toBe("f9d7f79e2e1d342d73aa63e0a3cb31a9a94b5325e4405428bdee31147a845c7c");
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

  it("importNsec はプロフィール控え（profileExtra）を消す（鍵交換で他人の値を残さない・#78 M1）", () => {
    window.localStorage.setItem(SK_KEY, bytesToHex(FIXED_SK));
    setProfileExtra({ picture: "https://old", about: "前の鍵の自己紹介", websites: ["https://old"], favoriteVarieties: ["グラキリス"] });
    const nsec = exportNsec();
    importNsec(nsec);
    expect(getProfileExtra()).toEqual({ picture: null, about: null, websites: [], favoriteVarieties: [] });
  });
});

// NIP-07 有効フラグは identity-critical なので集約 blob（hanoba）でなく専用キー hanoba:useNip07 で
// 隔離する（#558 レビュー should①）。集約 blob のリセットに巻き込まれてフラグが消えると、compose 経路が
// 新規ローカル鍵をサイレント生成して別 pubkey で投稿してしまうため。
describe("NIP-07 フラグの専用キー隔離（#558 should①）", () => {
  const REAL_NOSTR_PUBKEY = "npubfromextension0000000000000000000000000000000000000000000000000";

  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
    delete (window as { nostr?: unknown }).nostr;
  });

  it("setUseNip07(true) は集約 blob（hanoba）でなく専用キー hanoba:useNip07 に書く", () => {
    setUseNip07(true);
    expect(window.localStorage.getItem(USE_NIP07_KEY)).toBe("1");
    // 集約 blob には一切載らない（後方互換なしデプロイの一括リセットで消えない）。
    expect(window.localStorage.getItem("hanoba")).toBeNull();
    setUseNip07(false);
    expect(window.localStorage.getItem(USE_NIP07_KEY)).toBeNull();
  });

  it("集約 blob を丸ごと消しても NIP-07 有効フラグは残り、投稿の pubkey は拡張由来で不変", async () => {
    (window as { nostr?: unknown }).nostr = {
      getPublicKey: () => Promise.resolve(REAL_NOSTR_PUBKEY),
      signEvent: () => Promise.resolve({}),
    };
    setUseNip07(true);
    // デプロイ時の一括リセット相当＝集約 blob を丸ごと破棄（専用キーには触れない）。
    window.localStorage.removeItem("hanoba");
    // フラグは生き残り、compose 経路は新規ローカル鍵を生成せず拡張の pubkey を使う。
    expect(isNip07Enabled()).toBe(true);
    expect(await getPublicKeyHex()).toBe(REAL_NOSTR_PUBKEY);
    // ローカル鍵はサイレント生成されていない（アカウント分岐が起きていない）。
    expect(getStoredSecretKey()).toBeNull();
  });
});

describe("mergeProfileExtra（ローカル優先・空欄だけ relay 補完）", () => {
  it("ローカルが空の項目だけ relay 値で埋める", () => {
    expect(
      mergeProfileExtra(
        { picture: null, about: null, websites: [], favoriteVarieties: [] },
        { picture: "https://p", about: "a", websites: ["https://w"], favoriteVarieties: ["チタノタ"] },
      ),
    ).toEqual({ picture: "https://p", about: "a", websites: ["https://w"], favoriteVarieties: ["チタノタ"] });
  });

  it("ローカルに値があれば relay で上書きしない（好きな品種も clobber 防止・#141）", () => {
    expect(
      mergeProfileExtra(
        { picture: "https://local", about: "ローカル", websites: ["https://lw"], favoriteVarieties: ["グラキリス"] },
        { picture: "https://remote", about: "リモート", websites: ["https://rw"], favoriteVarieties: ["オベサ"] },
      ),
    ).toEqual({ picture: "https://local", about: "ローカル", websites: ["https://lw"], favoriteVarieties: ["グラキリス"] });
  });

  it("remote が null ならローカルそのまま", () => {
    const local = { picture: "https://x", about: null, websites: [], favoriteVarieties: ["パキポディウム"] };
    expect(mergeProfileExtra(local, null)).toEqual(local);
  });
});
