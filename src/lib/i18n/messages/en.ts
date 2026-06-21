// 英語カタログ（#147 段階1）。
//
// `Partial<Record<MessageKey, string>>`＝**完備義務を課さない**（緩さ優先・#147）。
// 未訳キーは t.ts が ja に fallback する＝英訳が虫食いでも壊れない。完備をテストで強制しない。
//
// 世界観文言は直訳でなく意訳（ブランドの空気を保つ）:
// - 「育てて、見せる。」→ "Grow it. Show it."（韻と簡潔さ）
// - 「みんなの植物 / あなたの植物」→ "Everyone's Plants / Your Plants"
// - 学名（sci）は言語横断の共通キーとして常時併記する方針（段階3）。

import type { MessageKey } from "./ja.ts";

export const en: Partial<Record<MessageKey, string>> = {
  "nav.discover": "Everyone's Plants",
  "nav.me": "Your Plants",
  "nav.compose": "Post",
  "nav.ranking": "Rankings",
  "nav.menu.open": "Open menu",
  "nav.menu.close": "Close menu",
  "nav.home.aria": "Hanōba home",

  "footer.tagline": "Hanōba — an imaginary city of plant lovers — grown by all of us.",

  "scrollToTop.aria": "Back to top",

  "install.title": "Add to Home Screen",
  "install.ios": "Tap {arrow} in the share menu and choose “Add to Home Screen” to open it like an app.",
  "install.tagline": "Opens like an app.",
  "install.add": "Add",
  "install.later": "Later",

  "common.close": "Close",

  "home.hero.title": "Grow it. Show it.",
  "home.hero.lead":
    "A social feed for plant photos. Faster and simpler than Instagram — just add a word. Field crops, staghorns, seedlings: all in one place.",
  "home.hero.sub": "This is the timeline of plants kept in Hanōba. For plants across all of Nostr, see {link}.",
  "home.hero.sub.link": "Everyone's Plants",

  "fab.compose.aria": "Post",

  "site.description": "A social feed for plant photos. Faster and simpler than Instagram — just add a word.",
};
