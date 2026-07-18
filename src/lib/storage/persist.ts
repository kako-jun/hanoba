// navigator.storage.persist() でオリジンの保存領域を eviction から守る（#558 Layer1）。
//
// hanoba は秘密鍵（nsec）を含む状態を localStorage に保存する backendless 構成のため、
// ストレージが evict されるとアカウントごと消える。persist() を一度も呼んでいないと
// Android Chrome は（PWA インストール済みでも）best-effort 扱いのままで、ストレージ逼迫時に
// evict され得る。persist() を呼ぶと Chrome はインストール済み PWA・高エンゲージメントの
// オリジンに persistent を silent grant し、eviction を防ぐ。
//
// 注意:
// - これは「オリジンの保存領域を evict されにくくする」措置であって、書き込みの durability
//   （集約・同期）を保証するものではない。鍵のバックアップ設計とは別レイヤ。
// - Safari のタブ文脈では persistent は構造上 granted されない（heuristic の対象外）。
//   Android Chrome の PWA では granted 見込み。granted の可否は環境依存で、ここでは要求するだけ。
// - persist() は Chrome では権限ダイアログを出さず heuristic で silent に grant/deny するため、
//   ユーザー体験を妨げない。

/**
 * オリジンの保存領域を persistent にするよう要求する（冪等・SSR 安全）。
 * - `navigator.storage` が無い環境（SSR/Node・古いブラウザ）では何もせず "unsupported"。
 * - 既に persisted なら persist() を再要求せず即 "persisted"（冪等）。
 * - persist() が true なら "persisted"、false なら "prompted-denied"。
 * - 例外はすべて握りつぶし "unsupported" にフォールバックする（古い環境で落とさない）。
 */
export async function requestPersistentStorage(): Promise<"persisted" | "prompted-denied" | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.storage) return "unsupported";
  try {
    if (typeof navigator.storage.persisted === "function" && (await navigator.storage.persisted())) {
      return "persisted";
    }
    if (typeof navigator.storage.persist !== "function") return "unsupported";
    const granted = await navigator.storage.persist();
    return granted ? "persisted" : "prompted-denied";
  } catch {
    return "unsupported";
  }
}

/**
 * 現在オリジンの保存領域が persistent かを安全に返す（将来の UI 表示用）。
 * `navigator.storage.persisted` が無い環境では false。例外も false に倒す。
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator === "undefined" || typeof navigator.storage?.persisted !== "function") return false;
  try {
    return await navigator.storage.persisted();
  } catch {
    return false;
  }
}
