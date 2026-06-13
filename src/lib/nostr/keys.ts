// 鍵管理と署名。localStorage 保存（MVP は平文）＋ NIP-07 拡張対応。
//
// SSR 安全: localStorage / window はトップレベルで触らず、必ず関数内で参照する
// （Astro の静的ビルドでこのモジュールが評価されても落ちないように）。

import { finalizeEvent, generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { nip19 } from "nostr-tools";
import { bytesToHex, hexToBytes } from "nostr-tools/utils";
import type { EventTemplate, NostrEvent } from "./types.ts";

// NIP-07 拡張が注入する window.nostr の薄い型宣言。
// nostr-tools は WindowNostr 型を export するが global 宣言はしないため、ここで宣言する。
declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>;
      signEvent: (event: unknown) => Promise<unknown>;
    };
  }
}

const SK_KEY = "hanoba:sk";
const USE_NIP07_KEY = "hanoba:useNip07";

// ---- localStorage ベースの鍵管理 -------------------------------------------
//
// MVP は秘密鍵を localStorage に平文保存する。
// より安全には NIP-07 拡張（window.nostr）に署名を委譲するのが推奨。
// setUseNip07(true) で NIP-07 を優先できる。

/** 新しい秘密鍵を生成し、hex 文字列で localStorage に保存して返す。 */
export function generateAndStoreSecretKey(): Uint8Array {
  const sk = generateSecretKey();
  localStorage.setItem(SK_KEY, bytesToHex(sk));
  return sk;
}

/** 保存済みの秘密鍵を返す。無ければ null。 */
export function getStoredSecretKey(): Uint8Array | null {
  if (typeof localStorage === "undefined") return null;
  const hex = localStorage.getItem(SK_KEY);
  if (hex === null) return null;
  return hexToBytes(hex);
}

/** 秘密鍵が保存済みか。 */
export function hasStoredKey(): boolean {
  return getStoredSecretKey() !== null;
}

/** 保存済みの秘密鍵を返す。無ければ生成して保存する。 */
export function getOrCreateSecretKey(): Uint8Array {
  const existing = getStoredSecretKey();
  if (existing !== null) return existing;
  return generateAndStoreSecretKey();
}

// ---- NIP-07 ----------------------------------------------------------------

/** NIP-07 拡張（window.nostr）が利用可能か。 */
export function hasNip07(): boolean {
  return typeof window !== "undefined" && !!window.nostr;
}

/** NIP-07 を使う設定が有効か（拡張があり、かつユーザーが選択済み）。 */
export function isNip07Enabled(): boolean {
  return hasNip07() && localStorage.getItem(USE_NIP07_KEY) === "1";
}

/** NIP-07 を使うかどうかを設定する。 */
export function setUseNip07(use: boolean): void {
  if (use) {
    localStorage.setItem(USE_NIP07_KEY, "1");
  } else {
    localStorage.removeItem(USE_NIP07_KEY);
  }
}

// ---- 公開鍵・署名 -----------------------------------------------------------

/** 公開鍵（hex）を返す。NIP-07 有効ならそちら、無ければ保存鍵から導出。 */
export async function getPublicKeyHex(): Promise<string> {
  if (isNip07Enabled() && window.nostr) {
    return window.nostr.getPublicKey();
  }
  return getPublicKey(getOrCreateSecretKey());
}

/**
 * テンプレートに署名して署名済みイベントを返す。
 * NIP-07 有効なら拡張に委譲、無ければ保存鍵でローカル署名（finalizeEvent）。
 */
export async function signTemplate(template: EventTemplate): Promise<NostrEvent> {
  if (isNip07Enabled() && window.nostr) {
    const signed = await window.nostr.signEvent(template);
    return signed as NostrEvent;
  }
  return finalizeEvent(template, getOrCreateSecretKey());
}

// ---- 秘密鍵の入出力（nsec） -------------------------------------------------

/** 保存済み秘密鍵を nsec（bech32）でエクスポートする。鍵が無ければ生成する。 */
export function exportNsec(): string {
  return nip19.nsecEncode(getOrCreateSecretKey());
}

/** nsec をインポートして hex で localStorage に保存する。 */
export function importNsec(nsec: string): void {
  const decoded = nip19.decode(nsec as `nsec1${string}`);
  if (decoded.type !== "nsec") {
    throw new Error("nsec ではありません");
  }
  localStorage.setItem(SK_KEY, bytesToHex(decoded.data));
}
