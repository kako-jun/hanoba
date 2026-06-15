// クロスクライアント discover（DESIGN §6 二段構え読み取り）の純粋関数。
// relay 呼び出しはしない（取得は client.ts の fetchDiscoverByTag の責務）。
//
// 狙い: hanoba 限定フィード（#4・t:hanoba）と違い、本文 #タグで mypace 等
// 他クライアントの植物投稿も集約する。書き込み側で本文 # を t 化しない契約
// （DESIGN §6・mypace 準拠）なので、集約は読み取り側の二段構えで行う:
//   ① {"#t":[tag]} … t タグ持ちを拾う（一般リレー）
//   ② NIP-50 search:"#tag" … 本文ハッシュタグを全文検索（t タグ無しも拾う・検索リレー）

import { parseProfileName } from "./parse.ts";
import type { NostrEvent } from "../nostr/types.ts";

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

/**
 * discover の検索モード（#24/#68）。
 * - `tag`         … `#` 始まり＝タグ集約。
 * - `author`      … `npub1…`＝特定著者（pubkey）で引く。
 * - `author-name` … `@ユーザー名`＝kind:0 の name で著者を引く。
 * - `keyword`     … それ以外＝本文キーワード全文検索。
 */
export type DiscoverMode = "tag" | "keyword" | "author" | "author-name";

/** 入力をモードと素の語に分類した結果。term は空（空入力）もあり得る。 */
export interface DiscoverQuery {
  mode: DiscoverMode;
  /**
   * - tag: 先頭 # 除去後の語 / keyword: trim 後の語
   * - author: npub（`nostr:` 接頭辞は除去） / author-name: 先頭 @ 除去後の名前
   */
  term: string;
}

// npub（bech32・`nostr:` 接頭辞許容）。bech32 は小文字なので case-sensitive で照合する
// （大文字 `NPUB1…` は decode 不能＝著者にせずキーワードに落とす・#68 レビュー）。
// 厳密検証は nip19.decode（client 側）に任せ、ここでは振り分けだけ。
const NPUB_RE = /^(?:nostr:)?(npub1[a-z0-9]+)$/;

/**
 * discover の入力を分類する（#24/#68・純粋関数）。
 * - 先頭が `#` … タグ意図（term は normalizeTag で # 除去）。
 * - `npub1…`（`nostr:` 接頭辞可） … 著者意図（term は npub。decode は client）。
 * - 先頭が `@` … ユーザー名意図（term は @ 除去後の名前。空名なら keyword 扱い）。
 * - それ以外 … 本文キーワード意図（term は trim のみ。# を付けない素の語）。
 *
 * 空入力（trim 後 ""）は keyword/term="" を返す（呼び出し側でリレーを叩かない）。
 */
export function classifyDiscoverQuery(raw: string): DiscoverQuery {
  const trimmed = raw.trim();
  if (trimmed.startsWith("#")) {
    return { mode: "tag", term: normalizeTag(trimmed) };
  }
  const npub = NPUB_RE.exec(trimmed);
  if (npub !== null) {
    return { mode: "author", term: npub[1]! };
  }
  if (trimmed.startsWith("@")) {
    const name = trimmed.slice(1).trim();
    if (name !== "") return { mode: "author-name", term: name };
  }
  return { mode: "keyword", term: trimmed };
}

/**
 * kind:0 群（NIP-50 name 検索の結果）から、name に検索語を含む著者の pubkey を選ぶ純粋関数（#68）。
 * NIP-50 はゆるいので parseProfileName で name を再確認して誤ヒットを除く。
 * pubkey ごと最新の kind:0 を採用し、出現順で最大 max 件。検索語は大小無視の部分一致。
 */
export function selectAuthorsByName(events: NostrEvent[], name: string, max = 20): string[] {
  const needle = name.trim().toLowerCase();
  if (needle === "") return [];
  // pubkey ごと最新の kind:0 を採用する（古い名前での誤ヒットを避ける）。
  const latest = new Map<string, NostrEvent>();
  for (const ev of events) {
    const cur = latest.get(ev.pubkey);
    if (cur === undefined || ev.created_at > cur.created_at) latest.set(ev.pubkey, ev);
  }
  // name が検索語を含む著者だけを残し、プロフィール更新が新しい順に並べてから max 件取る
  // （どの著者が残るかが relay の返却順まかせにならないように・#68 レビュー）。
  return [...latest.values()]
    .filter((ev) => {
      const n = parseProfileName(ev.content);
      return n !== null && n.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.created_at - a.created_at)
    .slice(0, max)
    .map((ev) => ev.pubkey);
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

/** discoverKeywordFilters が返すフィルタ。①=本文全文検索／②=タグも一応拾う。 */
export interface KeywordFilters {
  /** ① NIP-50 本文全文検索（# を付けない素の語＝本文中の単語を拾う・検索リレー向け）。 */
  keywordFilter: { kinds: number[]; search: string; limit: number };
  /** ② 同じ語が `t` タグでも使われていれば拾う（#t:[語]・一般リレー向け）。 */
  tagFilter: { kinds: number[]; "#t": string[]; limit: number };
}

/**
 * キーワード（本文全文検索）モードの取得フィルタを組み立てる純粋関数（#24）。
 * tag モードと違い search に `#` を付けない＝本文中に普通に書かれた語（`#` 無し・例
 * 「葉焼け」「徒長」）を拾う。あわせて同語の `t` タグ持ちも拾い、取りこぼしを減らす。
 *
 * relay 振り分け・マージは呼び出し側（client.ts）の責務。
 */
export function discoverKeywordFilters(keyword: string, limit: number): KeywordFilters {
  const term = keyword.trim();
  return {
    keywordFilter: { kinds: [1], search: term, limit },
    tagFilter: { kinds: [1], "#t": [normalizeTag(term)], limit },
  };
}
