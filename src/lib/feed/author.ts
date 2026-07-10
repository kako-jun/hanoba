/**
 * Nostr profile の表示名を画面表示用に正規化する。
 * 空文字・空白だけは未名乗り、前後空白は除去して扱う。
 */
export function normalizeAuthorName(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const normalized = name.trim();
  return normalized === "" ? null : normalized;
}

/** 名乗り済みなら正規化名、未名乗りなら locale 済みの fallback を返す。 */
export function authorDisplayName(name: string | null | undefined, unnamedLabel: string): string {
  return normalizeAuthorName(name) ?? unnamedLabel;
}
