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

/** SSR 安全に localStorage を取得する（サーバ評価時は null）。鍵関連の読み書きは全てこれ経由にする。 */
function getLS(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

// ---- localStorage ベースの鍵管理 -------------------------------------------
//
// MVP は秘密鍵を localStorage に平文保存する。
// より安全には NIP-07 拡張（window.nostr）に署名を委譲するのが推奨。
// setUseNip07(true) で NIP-07 を優先できる。

/** 新しい秘密鍵を生成し、hex 文字列で localStorage に保存して返す。 */
export function generateAndStoreSecretKey(): Uint8Array {
  const sk = generateSecretKey();
  getLS()?.setItem(SK_KEY, bytesToHex(sk));
  return sk;
}

/** 保存済みの秘密鍵を返す。無ければ null。 */
export function getStoredSecretKey(): Uint8Array | null {
  const hex = getLS()?.getItem(SK_KEY);
  if (hex === null || hex === undefined) return null;
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
  return hasNip07() && getLS()?.getItem(USE_NIP07_KEY) === "1";
}

/** NIP-07 を使うかどうかを設定する。 */
export function setUseNip07(use: boolean): void {
  const ls = getLS();
  if (ls === null) return;
  if (use) {
    ls.setItem(USE_NIP07_KEY, "1");
  } else {
    ls.removeItem(USE_NIP07_KEY);
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
  const decoded = nip19.decode(nsec);
  if (decoded.type !== "nsec") {
    throw new Error("nsec ではありません");
  }
  getLS()?.setItem(SK_KEY, bytesToHex(decoded.data));
  // 鍵＝アカウントが変わったので、旧鍵のプロフィール控え（picture/about/websites）を捨てる。
  // 残すと別人のアバター/サイトが新アカウントの kind:0 に混入・上書きされる（#78 レビュー M1）。
  // 新アカウントの値は呼び出し側が relay から再シードする（client.fetchMyProfile）。
  getLS()?.removeItem(PROFILE_EXTRA_KEY);
}

// ---- 表示名（ユーザー名） ---------------------------------------------------
//
// 「ユーザー名を入れたら投稿できる」（#28）。表示名はローカルにも控え、kind:0 でも publish する
// （publish は client.publishProfile の責務）。ここは localStorage の読み書きだけ。

const NAME_KEY = "hanoba:name";

/** 保存済みの表示名を返す（未設定は null）。 */
export function getDisplayName(): string | null {
  const name = getLS()?.getItem(NAME_KEY);
  return name === null || name === undefined || name === "" ? null : name;
}

/** 表示名をローカルに保存する（空はエラー）。kind:0 publish は別途（client.saveDisplayName）。 */
export function setDisplayName(name: string): void {
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("ユーザー名を入力してください");
  getLS()?.setItem(NAME_KEY, trimmed);
}

// ---- プロフィールの付加項目（picture / about / websites・#35 Piece3） ----------
//
// kind:0 は replaceable なので publish のたびに全項目を載せ直す必要がある。name 以外の
// 項目をローカルにも控え、name だけ変えたときも全体を publish できるようにする（clobber 防止）。
// 取得は client.fetchMyProfile（relay）が一次ソースだが、編集中の控えとしてここに保存する。

const PROFILE_EXTRA_KEY = "hanoba:profileExtra";

/** プロフィールの name 以外の編集項目。 */
export interface ProfileExtra {
  picture: string | null;
  about: string | null;
  websites: string[];
}

/** 保存済みのプロフィール付加項目を返す（未設定/壊れは空）。 */
export function getProfileExtra(): ProfileExtra {
  const empty: ProfileExtra = { picture: null, about: null, websites: [] };
  const raw = getLS()?.getItem(PROFILE_EXTRA_KEY);
  if (raw === null || raw === undefined || raw === "") return empty;
  try {
    const d = JSON.parse(raw) as Partial<ProfileExtra>;
    return {
      picture: typeof d.picture === "string" && d.picture !== "" ? d.picture : null,
      about: typeof d.about === "string" && d.about !== "" ? d.about : null,
      websites: Array.isArray(d.websites) ? d.websites.filter((w): w is string => typeof w === "string") : [],
    };
  } catch {
    return empty;
  }
}

/** プロフィール付加項目をローカルに保存する。 */
export function setProfileExtra(extra: ProfileExtra): void {
  getLS()?.setItem(PROFILE_EXTRA_KEY, JSON.stringify(extra));
}

/**
 * ローカル控えと relay 実体をマージする純粋関数（#78 レビュー M2）。
 * ローカルに値があればそれを優先し、空のフィールドだけ relay 値で補う。
 * kind:0 は replaceable なので、名前だけの変更でも relay にしか無い項目を消さないために使う。
 */
export function mergeProfileExtra(local: ProfileExtra, remote: ProfileExtra | null): ProfileExtra {
  if (remote === null) return local;
  return {
    picture: local.picture ?? remote.picture,
    about: local.about ?? remote.about,
    websites: local.websites.length > 0 ? local.websites : remote.websites,
  };
}
