// クロスクライアント discover（DESIGN §6 二段構え読み取り）の純粋関数。
// relay 呼び出しはしない（取得は client.ts の fetchDiscoverByTag の責務）。
//
// 狙い: hanoba 限定フィード（#4・t:hanoba）と違い、本文 #タグで mypace 等
// 他クライアントの植物投稿も集約する。書き込み側で本文 # を t 化しない契約
// （DESIGN §6・mypace 準拠）なので、集約は読み取り側の二段構えで行う:
//   ① {"#t":[tag]} … t タグ持ちを拾う（一般リレー）
//   ② NIP-50 search:"#tag" … 本文ハッシュタグを全文検索（t タグ無しも拾う・検索リレー）

/**
 * タグ文字列を正規化する。
 * - 前後の空白を trim する。
 * - 先頭の `#`（複数連続も含む）を除去する（"#アガベ" / "アガベ" を同一視）。
 *
 * 検索フィルタ（#t / search）に渡す素のタグ語を返す。空（trim 後・# 除去後）なら ""。
 */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").trim();
}

/** discoverTagFilters が返す二段構えフィルタ。①=#t タグ／②=NIP-50 本文検索。 */
export interface DiscoverFilters {
  /** ① t タグ持ちを拾うフィルタ（一般リレー向け）。 */
  tagFilter: { kinds: number[]; "#t": string[]; limit: number };
  /** ② NIP-50 本文全文検索フィルタ（検索リレー向け）。search は "#tag"。 */
  searchFilter: { kinds: number[]; search: string; limit: number };
}

/**
 * 二段構えの取得フィルタ（DESIGN §6）を組み立てる純粋関数。
 * タグは normalizeTag で正規化してから使う（前後空白 trim・先頭 # 除去）。
 *
 * - tagFilter:    {kinds:[1], "#t":[tag], limit}             … t タグ持ち
 * - searchFilter: {kinds:[1], search:"#"+tag, limit}         … 本文 #タグ全文検索（NIP-50）
 *
 * 空タグの判定・relay 振り分け・マージは呼び出し側（client.ts）の責務。
 */
export function discoverTagFilters(tag: string, limit: number): DiscoverFilters {
  const normalized = normalizeTag(tag);
  return {
    tagFilter: { kinds: [1], "#t": [normalized], limit },
    searchFilter: { kinds: [1], search: `#${normalized}`, limit },
  };
}
