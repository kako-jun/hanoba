// クロスクライアント discover（DESIGN §6 二段構え読み取り）の純粋関数。
// relay 呼び出しはしない（取得は client.ts の fetchDiscoverFiltered の責務）。
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

// 取得フィルタ（#t / NIP-50 search）の組み立ては多軸化（#131）で fetchDiscoverFiltered（client.ts）
// に集約した。旧 discoverTagFilters / discoverKeywordFilters（単一軸の二段構え）は撤去。
// この純粋モジュールは入力分類（classifyDiscoverQuery）・正規化（normalizeTag）・著者選定
// （selectAuthorsByName）に責務を絞る。
