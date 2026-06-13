// Nostr クライアント。リレーへの接続・publish はこの 1 モジュールに集約する。
// 他モジュールや React 島から relay 呼び出しをばら撒かない（guidelines §3）。

import { SimplePool } from "nostr-tools/pool";
import { mergePostsById, parsePost, type FeedPost } from "../feed/parse.ts";
import { GENERAL_RELAYS, RELAYS, TAG_HANOBA } from "./constants.ts";
import { buildNoteTemplate } from "./events.ts";
import { signTemplate } from "./keys.ts";
import { extractHashtags } from "./tags.ts";
import type { NostrEvent } from "./types.ts";

// SimplePool はシングルトンとして遅延生成する（最初の publish 時に WebSocket 接続）。
let pool: SimplePool | null = null;

function getPool(): SimplePool {
  if (pool === null) {
    pool = new SimplePool();
  }
  return pool;
}

/**
 * 署名済みイベントを全リレーへ publish する。
 * いずれか 1 リレーが OK を返せば成功（Promise.any）。全滅なら throw。
 */
export async function publishEvent(event: NostrEvent): Promise<void> {
  const promises = getPool().publish(RELAYS, event);
  await Promise.any(promises);
}

/**
 * 投稿テンプレートを構築・署名・publish し、署名済みイベントを返す。
 * 返り値は呼び出し側（フィード即時反映など）の利便のため。
 */
export async function signAndPublishNote(input: {
  caption: string;
  imageUrls?: string[];
  createdAt?: number;
}): Promise<NostrEvent> {
  const template = buildNoteTemplate(input);
  const signed = await signTemplate(template);
  await publishEvent(signed);
  return signed;
}

/**
 * 最近の hanoba 投稿から、本文で使われた #ハッシュタグの一覧を取得する。
 * 一言入力中のタグ補完（emergent taxonomy・DESIGN §3）の候補プールに使う。
 *
 * - `{"#t":["hanoba"], kinds:[1]}` で hanoba タグ持ちの最近の投稿を取得
 * - 各 content から extractHashtags で本文 # を抽出 → 出現順で flat + dedup
 * - 失敗（オフライン等）は throw せず空配列にフォールバックする
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchKnownHashtags(limit = 200): Promise<string[]> {
  try {
    const events = await getPool().querySync([...GENERAL_RELAYS], {
      kinds: [1],
      "#t": [TAG_HANOBA],
      limit,
    });
    const seen = new Set<string>();
    const result: string[] = [];
    for (const event of events) {
      for (const tag of extractHashtags(event.content)) {
        if (seen.has(tag)) continue;
        seen.add(tag);
        result.push(tag);
      }
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * hanoba フィードを取得する。`t:hanoba` で絞った kind:1 投稿だけを拾う
 * （mypace の一般投稿は hanoba に流さない＝DESIGN §6・Issue #4）。
 *
 * - `{"#t":["hanoba"], kinds:[1]}` で hanoba タグ持ちの最近の投稿を取得
 * - 各 event を parsePost → mergePostsById で id dedup・createdAt 降順
 * - hanoba は写真 SNS のため、画像 URL を持たない投稿（imageUrl === null）は除外する
 * - 失敗（オフライン等）は throw せず空配列にフォールバックする
 *
 * クロスクライアントの本文 # 全文検索（NIP-50・DESIGN §6 二段構え）は
 * この Issue では使わない（将来の discover 機能の領分）。ここは hanoba 限定。
 *
 * relay 呼び出しはこの client モジュールに集約する（島から直接叩かない）。
 */
export async function fetchHanobaFeed(limit = 100): Promise<FeedPost[]> {
  try {
    const events = await getPool().querySync([...GENERAL_RELAYS], {
      kinds: [1],
      "#t": [TAG_HANOBA],
      limit,
    });
    const posts = mergePostsById(events.map(parsePost));
    return posts.filter((post) => post.imageUrl !== null);
  } catch {
    return [];
  }
}
