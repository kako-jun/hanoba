// 投稿詳細モーダルの deep-link（#386）の純粋ロジック。relay には触れない（nip19 のみ）。
//
// hanoba は output:"static"（SSR/edge 無し）なので、単一投稿に別ルート `/p/<id>` は持てない。
// 同じ静的 index のまま、クエリ `?p=<nevent>` をクライアント JS が読んでモーダルを開く
// （「URL は同じ・モーダル島」思想と整合）。共有・ブックマーク・リロードで開き直せる。
//
// 役割:
//   - encodePostNevent: 投稿 → nevent 文字列（buildNjumpPermalink から切り出した正本・x-share と共有）。
//   - readPostParam:    URLSearchParams の `?p=` を decode して {id, relays} に戻す（graceful）。
//   - applyPostParamTo: URLSearchParams に `?p=` を in-place で書く/消す（他クエリは触らない）。

import { nip19 } from "nostr-tools";
import { GENERAL_RELAYS } from "../nostr/constants.ts";
import type { FeedPost } from "../feed/parse.ts";

/**
 * 64桁の小文字 hex（Nostr イベント id / pubkey）。これ以外は nevent/note へ encode しても
 * 意味のない値になるため、エンコード前・decode 後の両方で弾く。
 */
const EVENT_ID_HEX = /^[0-9a-f]{64}$/;

/**
 * 投稿（FeedPost の id/pubkey）を nevent 文字列にエンコードする（#386・共有 deep-link の正本）。
 *
 * buildNjumpPermalink（x-share.ts）と同一ロジックをここに集約し、njump permalink もこれを使う
 * （重複排除・単一の正本）。
 *
 * - id が 64桁小文字 hex でなければ null（空 id を渡すと nip19 は見た目だけ正しい無意味な nevent を
 *   作るため、エンコード前に弾く）。
 * - nevent エンコード（author＋一般リレー2本をヒント）を試み、失敗時は note（id だけ）にフォールバック。
 * - note も失敗（壊れた id）なら null。
 */
export function encodePostNevent(post: Pick<FeedPost, "id" | "pubkey">): string | null {
  if (!EVENT_ID_HEX.test(post.id)) return null;
  try {
    return nip19.neventEncode({
      id: post.id,
      author: post.pubkey,
      // アプリの一般リレーを2本ヒントに添える（njump/他クライアントが投稿を引けるように）。
      relays: GENERAL_RELAYS.slice(0, 2),
    });
  } catch {
    try {
      return nip19.noteEncode(post.id);
    } catch {
      return null;
    }
  }
}

/**
 * URL のクエリから `?p=<nevent|note>` を読み、投稿 id とリレーヒントに戻す（#386・着地/復元用）。
 *
 * - `type==="nevent"` → `{id: data.id, relays: data.relays ?? []}`
 * - `type==="note"`   → `{id: data, relays: []}`
 * - id が 64桁小文字 hex でなければ null。
 * - `p` 無し/空、decode が throw（壊れた値）したら null（graceful＝通常フィードへ）。
 */
export function readPostParam(params: URLSearchParams): { id: string; relays: string[] } | null {
  const raw = params.get("p");
  if (raw === null || raw === "") return null;
  try {
    const decoded = nip19.decode(raw);
    if (decoded.type === "nevent") {
      const { id, relays } = decoded.data;
      if (!EVENT_ID_HEX.test(id)) return null;
      return { id, relays: relays ?? [] };
    }
    if (decoded.type === "note") {
      const id = decoded.data;
      if (!EVENT_ID_HEX.test(id)) return null;
      return { id, relays: [] };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 既存の URLSearchParams に `?p=` を in-place で反映する（#386・URL 書き込み用）。
 * applyFilterToParams（discoverFilter.ts）と同じスタイル。
 *
 * - nevent が非 null なら `p=<nevent>` を set。
 * - null なら `p` を delete。
 * - **他のクエリ（discover の `?tags=` 等）は触らない**（/discover では `?tags=` と `?p=` が共存しうる）。
 */
export function applyPostParamTo(params: URLSearchParams, nevent: string | null): void {
  if (nevent !== null) params.set("p", nevent);
  else params.delete("p");
}
