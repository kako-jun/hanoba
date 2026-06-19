// クロスクライアント discover（DESIGN §6 二段構え読み取り）のタグ正規化の純粋関数。
// relay 呼び出しはしない（取得は client.ts の fetchDiscoverFiltered の責務）。
//
// 狙い: hanoba 限定フィード（#4・t:hanoba）と違い、本文 #タグで mypace 等
// 他クライアントの植物投稿も集約する。書き込み側で本文 # を t 化しない契約
// （DESIGN §6・mypace 準拠）なので、集約は読み取り側の二段構えで行う:
//   ① {"#t":[tag]} … t タグ持ちを拾う（一般リレー）
//   ② NIP-50 search:"#tag" … 本文ハッシュタグを全文検索（t タグ無しも拾う・検索リレー）
//
// discover は #239 で「品種タグで絞るだけ」になったため、このモジュールはタグ正規化のみに責務を絞る。

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
