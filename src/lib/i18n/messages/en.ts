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
  "common.retry": "Retry",

  "time.justNow": "just now",
  "time.minutesAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",

  "card.photo.zoom": "Zoom photo",
  "card.photos.count": "{n}",
  "card.author.profile": "{name}'s profile",
  "card.readMore": "Read more",
  "reaction.likes.aria": "{n} likes",
  "reaction.comments.aria": "{n} comments",
  "fuda.search.title": "Search for {label}",
  "filter.remove.aria": "Remove “{tag}”",

  "feed.error": "Couldn't load the feed.",
  "feed.empty": "No posts yet.",
  "feed.error.short": "Couldn't load.",
  "feed.filter.clear": "Clear filter",
  "feed.tag.empty": "No posts for “#{tag}” yet.",
  "discover.loading": "Searching for “{summary}”…",
  "discover.empty": "No posts found for “{summary}”. Try another variety.",

  "my.subject": "you",
  "my.empty": "You haven't placed any plants yet.",
  "my.edit.aria": "Edit this post",
  "my.delete.aria": "Delete this post",
  "my.edit.done": "Post edited (re-published as a new post).",
  "my.delete.photoUnconfirmed":
    "The post was deleted, but we couldn't confirm the photo was removed (it may disappear in a few minutes).",
  "my.delete.failed": "Couldn't delete. Please try again later.",
  "my.firstPost": "Place your first one",
  "my.loading.sr": "Loading your plants…",
  "my.delete.confirm.q": "Delete this, photos and all?",
  "my.delete.confirm.note": "(Can't be undone)",
  "my.delete.confirm.yes": "Delete",
  "my.delete.confirm.no": "Cancel",
  "my.delete.deleting": "Deleting…",

  "home.hero.title": "Grow it. Show it.",
  "home.hero.lead":
    "A social feed for plant photos. Faster and simpler than Instagram — just add a word. Field crops, staghorns, seedlings: all in one place.",
  "home.hero.sub": "This is the timeline of plants kept in Hanōba. For plants across all of Nostr, see {link}.",
  "home.hero.sub.link": "Everyone's Plants",

  "fab.compose.aria": "Post",

  "site.description": "A social feed for plant photos. Faster and simpler than Instagram — just add a word.",

  "meta.about.title": "About Hanōba — an imaginary plant city",
  "meta.about.description": "Hanōba is a social feed for plant photos — an imaginary city of plant lovers that we all grow together.",
  "meta.compose.title": "Post — Hanōba",
  "meta.discover.title": "Everyone's Plants — Hanōba",
  "meta.discover.description": "Browse the plants of all of Nostr (#plantstr) together with Hanōba's posts.",
  "meta.me.title": "Your Plants — Hanōba",
  "meta.me.description": "The plants you've placed in Hanōba. You can delete posts here (photos and all).",
  "meta.ranking.title": "Rankings — Hanōba",
  "meta.ranking.description": "The varieties trending now, tallied weekly from Hanōba's posts — with week-over-week change (↑↓, NEW, RE).",
  "meta.u.title": "Citizen profile — Hanōba",
  "meta.u.description": "A Hanōba citizen's public profile — the plants they've placed and their activity stats (posts, photos, varieties grown, days resident).",
  "meta.vote.title": "Residents' Vote — Hanōba City Hall",
  "meta.vote.description": "Hanōba City Hall's residents' vote. Variety ordering, feature requests, and bug reports — drop a note on the boards. Name optional.",

  "discover.lead": "Browse the plants of all of Nostr (#plantstr) together with Hanōba's posts.",
  "me.lead": "The ones you've placed. Delete one and the post and its photos go together.",
  "ranking.lead":
    "The varieties trending now, tallied weekly from Hanōba's posts — with week-over-week change (↑↓, NEW, RE). Everyone's posts move the chart.",

  "vote.h1": "Residents' Vote",
  "vote.intro":
    "Ahem. This is the residents' ballot. Citizens with something to say about city affairs — speak freely. A vote counts even unsigned. The Mayor reads every one.",
  "vote.note": "* Each section is a message board. Write freely (name optional).",
  "vote.board.aria": "Residents' Vote — {title}",
  "vote.board.requests.title": "Variety requests",
  "vote.board.requests.intro":
    "Every wish about varieties belongs here — ordering, varieties missing from the register, anything else. No need to hold back. The Mayor reads them all.",
  "vote.board.features.title": "Feature requests",
  "vote.board.features.intro": "Petition for any mechanism this city ought to have. The Mayor shall see to it (perhaps).",
  "vote.board.bugs.title": "Bug reports",
  "vote.board.bugs.intro": "Found a fault in the city? Report it here. The repair crew will be dispatched at once.",

  "citizen.level.traveler": "Traveler",
  "citizen.level.citizen": "Citizen",
  "citizen.level.citizenN": "Citizen L{n}",

  "stats.subject.default": "this citizen",
  "stats.activity.heading": "{subject}'s activity",
  "stats.posts.label": "Posts",
  "stats.posts.unit": "",
  "stats.photos.label": "Photos",
  "stats.photos.unit": "",
  "stats.varieties.label": "Varieties",
  "stats.varieties.unit": "",
  "stats.tenure.label": "Resident",
  "stats.tenure.unit": "d",
  "stats.varieties.grown": "Varieties grown",
  "stats.variety.filterTitle": "Filter everyone's plants by {label}",

  "green.heading": "Green {subject} added to the city",
  "green.heading.note": "(1 cell = 1 photo; greener photos are darker)",
  "green.capped": "(latest {n})",
  "green.legend.low": "Green Low",
  "green.legend.high": "High",

  "activity.heading": "Activity grass",
  "activity.heading.note": "(across = weeks, down = weekdays; darker = more posts that day)",
  "activity.streak.current": "Current streak",
  "activity.streak.longest": "Longest",
  "activity.streak.days": "d",
  "activity.legend.low": "Low",
  "activity.legend.high": "High",

  "profile.subject.default": "Citizen",
  "profile.notFound": "Couldn't find this citizen's profile.",
  "profile.toDiscover": "To Everyone's Plants",
  "profile.isMe": "This is your public profile (to Your Plants)",
  "profile.favorites": "Favorite varieties",
  "profile.loading.sr": "Loading this citizen's plants…",
  "profile.empty": "This citizen has no plants yet.",
};
