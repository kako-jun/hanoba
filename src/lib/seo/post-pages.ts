// SEO 用の静的投稿ページ生成（#542）。
// クライアントのフィード取得とは別に、build 時だけ Nostr から最新投稿を取得し、
// `/p/<nevent>` の Astro 静的ページへ渡す。

import { SimplePool } from "nostr-tools/pool";
import { mergePostsById, parsePost, type FeedPost } from "../feed/parse.ts";
import { GENERAL_RELAYS, TAG_HANOBA } from "../nostr/constants.ts";
import type { NostrEvent } from "../nostr/types.ts";
import { stripHashtags } from "../nostr/tags.ts";
import { encodePostNevent } from "../share/deep-link.ts";

const BUILD_QUERY_MAXWAIT = 4500;
const DEFAULT_STATIC_POST_LIMIT = 80;

export interface StaticPostPage {
  nevent: string;
  post: FeedPost;
}

export function postReadableCaption(post: Pick<FeedPost, "caption">): string {
  return stripHashtags(post.caption).trim();
}

export function postPageTitle(post: Pick<FeedPost, "caption">): string {
  const body = postReadableCaption(post).replace(/\s+/g, " ");
  const head = body === "" ? "Hanōba の植物" : body;
  return `${head.slice(0, 48)}${head.length > 48 ? "..." : ""} — Hanōba`;
}

export function postPageDescription(post: Pick<FeedPost, "caption" | "hashtags">): string {
  const body = postReadableCaption(post).replace(/\s+/g, " ");
  const tags = post.hashtags.length > 0 ? ` #${post.hashtags.slice(0, 4).join(" #")}` : "";
  const text = body === "" ? `Hanōba に置かれた植物写真。${tags}` : `${body}${tags}`;
  return text.slice(0, 150);
}

export async function fetchStaticPostPages(limit = DEFAULT_STATIC_POST_LIMIT): Promise<StaticPostPage[]> {
  const pool = new SimplePool();
  try {
    const events = await pool.querySync(
      [...GENERAL_RELAYS],
      { kinds: [1], "#t": [TAG_HANOBA], limit },
      { maxWait: BUILD_QUERY_MAXWAIT },
    );
    const posts = mergePostsById(events.map((event: NostrEvent) => parsePost(event)))
      .filter((post) => post.imageUrl !== null);

    const pages: StaticPostPage[] = [];
    const seen = new Set<string>();
    for (const post of posts) {
      const nevent = encodePostNevent(post);
      if (nevent === null || seen.has(nevent)) continue;
      seen.add(nevent);
      pages.push({ nevent, post });
    }
    return pages;
  } catch (err) {
    console.warn("[hanoba] static post pages skipped:", err instanceof Error ? err.message : err);
    return [];
  } finally {
    pool.close([...GENERAL_RELAYS]);
  }
}
