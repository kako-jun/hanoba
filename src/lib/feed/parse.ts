// フィード投稿のパース・整形の純粋関数（定義先行・テスト対象）。
// Nostr イベント → 表示用の FeedPost への変換と、id マージ・タグ絞り込み・相対時刻。
// relay 呼び出しはしない（取得は client.ts の責務）。

import { extractHashtags } from "../nostr/tags.ts";
import type { NostrEvent } from "../nostr/types.ts";

/**
 * フィード表示用の投稿。Nostr イベントから parsePost で生成する。
 *
 * - id / pubkey / createdAt: イベント由来。
 * - caption: content から画像 URL を除いた「一言」。
 * - imageUrl: content の最初の画像 URL（無ければ null）。
 * - hashtags: 本文の #ハッシュタグ（クリックでクライアント側絞り込みに使う）。
 */
export interface FeedPost {
  id: string;
  pubkey: string;
  createdAt: number;
  caption: string;
  imageUrl: string | null;
  hashtags: string[];
}

// content 中のインライン画像 URL（クエリ文字列付きも許容）。
// 拡張子: jpg/jpeg/png/gif/webp/avif。大小無視・グローバル。
// 貪欲（\S+）にして、二重拡張子（x.jpg.png 等）では最後の拡張子までを 1 URL として採る
// （非貪欲だと最初の拡張子で切れて壊れた src と caption のゴミになる）。
const IMAGE_URL_RE = /(https?:\/\/\S+\.(?:jpe?g|png|gif|webp|avif))(?:\?\S*)?/gi;

/**
 * Nostr イベント（kind:1）を表示用 FeedPost に変換する純粋関数。
 *
 * - content から画像 URL を抽出。複数あれば最初を imageUrl に、無ければ null。
 * - caption: content から画像 URL（マッチ部分）を除去 → trim。連続改行は 1 つに畳む。
 * - hashtags: extractHashtags(content)（本文 # を t タグ化せず読み取りで拾う）。
 */
export function parsePost(event: NostrEvent): FeedPost {
  const content = event.content;

  // 画像 URL の全マッチを取る（matchAll はステートフルな lastIndex を持たない安全な呼び方）。
  const matches = [...content.matchAll(IMAGE_URL_RE)];
  const imageUrl = matches.length > 0 ? matches[0]![0] : null;

  // content から画像 URL を取り除く（replace は別途新しい RegExp で。グローバルフラグの lastIndex 汚染を避ける）。
  const withoutImages = content.replace(new RegExp(IMAGE_URL_RE.source, "gi"), "");

  // 連続改行を 1 つに畳み、前後の空白を除去する。
  const caption = withoutImages.replace(/\n{2,}/g, "\n").trim();

  return {
    id: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    caption,
    imageUrl,
    hashtags: extractHashtags(content),
  };
}

/**
 * 複数のリスト（リレーごと等）を id で重複除去し、createdAt 降順に並べる。
 * 同じ id は最初に出会ったものを採用する。
 */
export function mergePostsById(...lists: FeedPost[][]): FeedPost[] {
  const byId = new Map<string, FeedPost>();
  for (const list of lists) {
    for (const post of list) {
      if (!byId.has(post.id)) {
        byId.set(post.id, post);
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * hashtags に指定タグを含む投稿だけを返す（大小無視）。
 * クライアント側のタグ絞り込みに使う（取得済みの hanoba 投稿に対してのみ適用）。
 */
export function filterByHashtag(posts: FeedPost[], tag: string): FeedPost[] {
  const needle = tag.toLowerCase();
  return posts.filter((post) => post.hashtags.some((h) => h.toLowerCase() === needle));
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * createdAt（秒）と now（秒）から「3分前」等の相対時刻を整形する純粋関数。
 *
 * - 1 分未満: 「たった今」
 * - 1 時間未満: 「N分前」
 * - 1 日未満: 「N時間前」
 * - それ以上: 「N日前」
 * 未来（now < createdAt）は「たった今」に丸める。
 */
export function relativeTime(createdAt: number, now: number): string {
  const diff = Math.floor(now - createdAt);
  if (diff < MINUTE) return "たった今";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
  return `${Math.floor(diff / DAY)}日前`;
}
