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
  "nav.ranking": "Census",
  "nav.vote": "Town Vote",
  "nav.gazette": "Municipal Gazette",
  "nav.menu.open": "Open menu",
  "nav.menu.close": "Close menu",
  "nav.home.aria": "Hanōba home",

  "footer.nav.aria": "Footer navigation",
  "footer.tagline":
    "Hanōba — an imaginary city of plant lovers — grown by all of us.",

  "scrollToTop.aria": "Back to top",

  "install.title": "Add to Home Screen",
  "install.ios":
    "Tap {arrow} in the share menu and choose “Add to Home Screen” to open it like an app.",
  "install.tagline": "Opens like an app.",
  "install.add": "Add",
  "install.later": "Later",

  "update.restarting": "New version available. Restarting...",

  "common.close": "Close",
  "common.retry": "Retry",

  "time.justNow": "just now",
  "time.minutesAgo": "{n}m ago",
  "time.hoursAgo": "{n}h ago",
  "time.daysAgo": "{n}d ago",

  "card.photo.zoom": "Zoom photo",
  "card.photos.count": "{n}",
  "card.author.profile": "{name}'s profile",
  "card.author.profileWithId": "{name}'s profile ({id})",
  "author.unnamed": "Traveler",
  "card.readMore": "Read more",
  "card.engagement.like": "Add a flower",
  "card.engagement.comment": "Comment",
  "reaction.likes.aria": "{n} flowers",
  "reaction.comments.aria": "{n} comments",
  "fuda.search.title": "Search for {label}",
  "filter.remove.aria": "Remove “{tag}”",

  "feed.error": "Couldn't load the feed.",
  "feed.empty": "No posts yet.",
  "feed.error.short": "Couldn't load.",
  "feed.filter.clear": "Clear filter",
  "feed.tag.empty": "No posts for “#{tag}” yet.",
  "feed.loadMore": "Load more",
  "feed.loadingMore": "Loading…",
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
  "home.hero.sub":
    "This is the timeline of plants kept in Hanōba. For plants across all of Nostr, see {link}.",
  "home.hero.sub.link": "Everyone's Plants",

  "fab.compose.aria": "Post",

  "site.description":
    "A social feed for plant photos. Faster and simpler than Instagram — just add a word.",

  "meta.about.title": "About Hanōba — an imaginary plant city",
  "meta.about.description":
    "Hanōba is a social feed for plant photos — an imaginary city of plant lovers that we all grow together.",
  "meta.compose.title": "Post — Hanōba",
  "meta.discover.title": "Everyone's Plants — Hanōba",
  "meta.discover.description":
    "Browse the plants of all of Nostr (#plantstr) together with Hanōba's posts.",
  "meta.me.title": "Your Plants — Hanōba",
  "meta.me.description":
    "The plants you've placed in Hanōba. You can delete posts here (photos and all).",
  "meta.ranking.title": "Census — Hanōba",
  "meta.ranking.description":
    "The varieties trending now, tallied weekly from Hanōba's posts — with week-over-week change (↑↓, NEW, RE).",
  "meta.u.title": "Citizen profile — Hanōba",
  "meta.u.description":
    "A Hanōba citizen's public profile — the plants they've placed and their activity stats (posts, photos, varieties grown, days resident).",
  "meta.vote.title": "Residents' Vote — Hanōba City Hall",
  "meta.vote.description":
    "Hanōba City Hall's residents' vote. Variety ordering, feature requests, and bug reports — drop a note on the boards. Name optional.",
  "meta.gazette.title": "Municipal Gazette — Hanōba",
  "meta.gazette.description":
    "Notes from Mayor Botanics von Hanōba on what's new in the city — new civic windows, features, and improvements, written up as a gazette.",

  "discover.lead":
    "Browse the plants of all of Nostr (#plantstr) together with Hanōba's posts.",
  "me.lead":
    "The ones you've placed. Delete one and the post and its photos go together.",
  "ranking.lead":
    "Ahem. This is the census office. The varieties trending now are tallied weekly from citizens' posts — with week-over-week change (↑↓, NEW, RE) noted alongside. Every citizen's post moves this very chart.",

  "vote.h1": "Residents' Vote",
  "vote.intro":
    "Ahem. This is the residents' ballot. Citizens with something to say about city affairs — speak freely. A vote counts even unsigned. The Mayor reads every one.",
  "vote.note":
    "* Each section is a message board. Write freely (name optional).",
  "vote.board.aria": "Residents' Vote — {title}",
  "vote.board.requests.title": "Variety requests",
  "vote.board.requests.intro":
    "Every wish about varieties belongs here — ordering, varieties missing from the register, anything else. No need to hold back. The Mayor reads them all.",
  "vote.board.features.title": "Feature requests",
  "vote.board.features.intro":
    "Petition for any mechanism this city ought to have. The Mayor shall see to it (perhaps).",
  "vote.board.bugs.title": "Bug reports",
  "vote.board.bugs.intro":
    "Found a fault in the city? Report it here. The repair crew will be dispatched at once.",

  "citizen.level.traveler": "Traveler",
  "citizen.level.citizen": "Citizen",

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
  // Horizontal paging of grown varieties (#388: notebook swipe + blur page turn, 10 per page).
  "stats.varieties.pager.aria": "Page through grown varieties",
  "stats.varieties.pager.prev": "Previous page",
  "stats.varieties.pager.next": "Next page",
  "stats.varieties.pager.indicator": "{page} / {total}",

  "green.heading": "Green {subject} added to the city",
  "green.cumulative.label": "fully-green photos",
  "green.cumulative.value": "≈{equivalent}",
  "green.measuring": "(measuring green…)",

  "activity.heading": "Shooting grass",
  "activity.heading.note": "(last {weeks} weeks)",
  "activity.streak.current": "Current streak",
  "activity.streak.longest": "Longest",
  "activity.streak.days": "d",
  "activity.legend.low": "Low",
  "activity.legend.high": "High",

  "profile.subject.default": "Citizen",
  "profile.subject.withId": "{name} ({id})",
  "profile.notFound": "Couldn't find this citizen's profile.",
  "profile.toDiscover": "To Everyone's Plants",
  "profile.isMe": "This is your public profile (to Your Plants)",
  "profile.favorites": "Favorite varieties",
  "profile.loading.sr": "Loading this citizen's plants…",
  "profile.empty": "This citizen has no plants yet.",

  "compose.account.prompt": "Nice to meet you. What's your handle?",
  "compose.photos.heading": "Photos",
  "compose.photos.count": "{count}/{max}",
  "compose.photos.limitNotice": "Up to 4 photos. Added as many as would fit.",
  "compose.photos.thumbAlt": "Photo {n}",
  "compose.reorder.left.aria": "Move selected photo left",
  "compose.reorder.left": "Left",
  "compose.reorder.right.aria": "Move selected photo right",
  "compose.reorder.right": "Right",
  "compose.reorder.counter": "Photo {index} / {total}",
  "compose.undo": "Undo",
  "compose.undo.aria":
    "Undo the last image edit (rotation, filter, crop, shot date)",
  "compose.filter.heading": "Filters",
  "compose.shotDate.heading": "Date taken",
  "compose.shotDate.auto": "Detected automatically.",
  "compose.shotDate.input.aria": "Date this photo was taken",
  "compose.shotDate.exclude": "Don't include the date",
  "compose.shortfall.name": "a username",
  "compose.shortfall.photo": "a photo",
  "compose.shortfall.caption": "a word",
  "compose.shortfall.lead": "Add ",
  "compose.shortfall.trail": "to post",
  "compose.action.removeOne": "Remove this photo",
  "compose.action.resetImage": "Choose another photo",
  "compose.submit.uploading": "Sending photos {done}/{total}",
  "compose.submit.publishing": "Posting…",
  "compose.submit": "Post",
  "compose.done": "Posted. Heading to Your Plants…",
  // First-post nsec backup nudge (#558 Layer2). The warning reuses account.profile.nsec.*.
  "compose.nsecPrompt.title": "Keep a copy of your key",
  "compose.nsecPrompt.body":
    "You're posted. This account exists only through a key stored on this device. If you don't keep a copy, you'll lose it for good when you switch devices or your browser data is cleared.",
  "compose.nsecPrompt.restoreHint": "To use another device or restore your account, you paste this key (nsec).",
  "compose.nsecPrompt.saved": "I saved it",
  "compose.nsecPrompt.later": "Later",
  "compose.error.notConfirmed":
    "Couldn't confirm the post. Please try again with a better connection (your draft is kept).",
  "compose.error.generic": "Posting failed.",
  "compose.error.imageLoad": "Couldn't load the image.",

  "crop.image.alt": "Photo to crop",
  "crop.rotate.label": "Rotate",
  "crop.rotate.left90.aria": "Rotate photo 90° left",
  "crop.rotate.left90": "90° left",
  "crop.rotate.fineLeft.aria": "0.5° left",
  "crop.rotate.fineRight.aria": "0.5° right",
  "crop.rotate.slider.aria": "Fine angle adjustment (0.5° steps)",
  "crop.rotate.right90.aria": "Rotate photo 90° right",
  "crop.rotate.right90": "90° right",
  "crop.dragHint": "Drag the frame to position it.",

  "caption.label": "A word",
  "caption.placeholder":
    "About your plant. A word, or more. Add tags like #agave too.",
  "caption.suggest.aria": "Hashtag suggestions",

  "filter.strength.none": "Off",
  "filter.strength.weak": "Low",
  "filter.strength.medium": "Mid",
  "filter.strength.strong": "High",
  "filter.group.aria": "Layer filters",
  "filter.chip.aria": "{name} ({strength})",

  "picker.shoot": "Camera",
  "picker.album": "Album",
  "picker.hint":
    "Take a photo of your plant, or choose from your album. Up to 4.",
  "picker.error.notImage":
    "Please choose an image file (videos can't be posted).",
  "picker.error.limit": "Up to 4 photos.",
  "picker.add.aria": "Add a photo",
  "picker.camera.aria": "Take with camera",
  "picker.gallery.aria": "Choose from album",

  "tag.heading.filter": "Filter by variety",
  "tag.heading.compose": "Choose tags",
  "tag.fromPlants": "Choose from plants",
  "tag.breadcrumb.root": "Plants",
  "tag.group.recent": "Recent",
  "tag.group.popular": "Popular",
  "tag.overflow.button": "More",
  "tag.overflow.aria": "More {label} tags",
  "tag.overflow.count": "{label} ({n} more)",
  "tag.overflow.dialog.aria": "{label} tags",
  "tag.overflow.close.aria": "Close tag list",
  "tag.request": "This plant isn't here → request it",
  "tag.back.aria": "Go back one step",
  "tag.back": "‹ Back",
  "tag.close.aria": "Close drilldown",
  "tag.search.aria": "Search tags",
  "tag.search.placeholder": "Search varieties and genera (e.g. Titanota)",
  "tag.dict.loading": "Loading dictionary…",
  "tag.dict.error": "Couldn't load the dictionary. Please try again.",
  "tag.noResults": "No matches",
  "tag.category.label": "Category",
  "tag.useFreeform": "Use #{tag} as is",
  "tag.useCategory": "Use #{label} as is",
  "tag.useGenus": "Use #{name} as is",

  "account.handle.unset": "Handle not set",
  "account.name.clear": "Clear input",
  "account.name.import.label": "Continue with an account you already have",
  "account.name.import.placeholder": "Paste nsec1…",
  "account.name.import.aria": "nsec secret key",
  "account.name.import.error.invalid":
    "That nsec isn't valid. Paste an `nsec1…` key.",
  "account.name.import.help":
    "You can continue with an account you use on mypace and elsewhere. Your information is saved only on this device.",
  "account.name.import.cancel": "Cancel",
  "account.name.import.submitting": "Checking…",
  "account.name.import.submit": "Continue",
  "account.name.edit.placeholder": "Handle (you can change it later)",
  "account.name.edit.aria": "Handle",
  "account.name.edit.save": "Save",
  "account.name.edit.hint": "Set a handle and you can post, not just browse.",
  "account.name.edit.haveAccount": "Already have an account?",
  "account.name.set": "Set a handle",
  "account.name.change": "Change handle",
  "account.name.changeAccount": "Change account",

  "account.profile.heading": "Profile",
  "account.profile.sub": "Icon, bio, sites",
  "account.profile.edit": "Edit",
  "account.profile.editHint": "Set a handle name first.",
  "account.profile.icon.label": "Icon",
  "account.profile.icon.uploading": "Uploading…",
  "account.profile.icon.pick": "Choose an image",
  "account.profile.icon.remove": "Remove",
  "account.profile.icon.urlPlaceholder": "Or paste an image URL (https://…)",
  "account.profile.icon.urlAria": "Icon image URL",
  "account.profile.icon.uploadError":
    "Couldn't upload the image. Please try again later.",
  "account.profile.about.label": "Bio",
  "account.profile.about.placeholder":
    "Your plants, favorite varieties, and so on",
  "account.profile.sites.label": "Sites & SNS",
  "account.profile.sites.hint":
    "They line up as icons in the author area of enlarged photos. Each person can guide visitors to their own site.",
  "account.profile.sites.urlPlaceholder": "https://…",
  "account.profile.sites.urlAria": "URL of site {n}",
  "account.profile.sites.clearAria": "Clear site {n}",
  "account.profile.sites.moveUpAria": "Move site {n} up",
  "account.profile.sites.moveDownAria": "Move site {n} down",
  "account.profile.sites.removeAria": "Remove site {n}",
  "account.profile.sites.add": "＋ Add a site",
  "account.profile.nameMissing": "Set a handle above first.",
  "account.profile.saved": "Saved.",
  "account.profile.saveError": "Couldn't save (it's saved on this device).",
  "account.profile.saving": "Saving…",
  "account.profile.save": "Save",
  "account.profile.nsec.label": "Secret key (backup)",
  "account.profile.nsec.warning":
    "If you don't keep this key, you can never recover your account once you switch devices or clear your browser data. Also, anyone who knows this key can control all of your posts. Don't show it to anyone or paste it anywhere.",
  "account.profile.nsec.codeAria": "Secret key (nsec)",
  "account.profile.nsec.hideAria": "Hide secret key",
  "account.profile.nsec.showAria": "Show secret key",
  "account.profile.nsec.hide": "Hide",
  "account.profile.nsec.show": "Show",
  "account.profile.nsec.copyAria": "Copy secret key",
  "account.profile.nsec.copy": "Copy",
  "account.profile.nsec.copied": "Copied",

  "account.favorites.hint":
    "They appear on your profile. Find others who like the same varieties.",
  "account.favorites.removeAria": "Remove {name} from favorite varieties",
  "account.favorites.search.aria": "Search varieties",
  "account.favorites.dict.empty": "—",
  "account.favorites.useFreeform": "Add “{freeform}” as is",

  "detail.dialog.aria": "Post details",
  "detail.photo.alt": "{caption} ({n})",
  "detail.photo.prev": "Previous photo",
  "detail.photo.next": "Next photo",
  "detail.photo.goto": "Show photo {n}",
  "detail.fuda.heading": "Plants in this post",
  "detail.translate": "Translate",
  "detail.translate.original": "Show original",
  "detail.translate.busy": "Translating…",
  "detail.likes.loading": "loading",
  "detail.likes.like.label": "Add a flower",
  "detail.likes.unlike.label": "Flower added",
  "detail.likes.like.aria": "{n} flowers. Tap to add a flower.",
  "detail.likes.unlike.aria": "{n} flowers. A flower is added. Tap again to remove it.",
  "detail.likes.sending": "Adding a flower",
  "detail.likes.unsending": "Removing your flower",
  "detail.likes.error": "Could not add a flower. Please try again.",
  "detail.likes.unlike.error": "Could not remove your flower. Please try again.",
  "detail.share.aria": "Share on X",
  "detail.share.split.aria": "Share on X (split)",
  "detail.share.whole": "Full text",

  "comment.section.aria": "Comments",
  "comment.heading": "Comments",
  "comment.sort.toNew": "Sort newest first",
  "comment.sort.toOld": "Sort oldest first",
  "comment.sort.old": "Oldest first",
  "comment.sort.new": "Newest first",
  "comment.loading": "Loading…",
  "comment.error.submit":
    "Couldn't send your comment. Please wait a moment and try again.",
  "comment.error.remove": "Couldn't delete the comment.",
  "comment.empty": "No comments yet",
  "comment.delete.aria": "Delete this comment",
  "comment.delete.label": "Delete",
  "comment.delete.confirm.q": "Delete this?",
  "comment.delete.confirm.no": "Cancel",
  "comment.deleting": "Deleting…",
  "comment.input.aria": "Write a comment",
  "comment.input.clear": "Clear comment",
  "comment.input.placeholder": "Write a comment…",
  "comment.submit": "Comment",
  "comment.submit.posting": "Posting…",

  "edit.dialog.aria": "Edit post",
  "edit.heading": "Edit post",
  "edit.caption.label": "Text",
  "edit.caption.placeholder": "A word (you can write #tags in the text too)",
  "edit.error": "Couldn't edit. Please wait a while and try again.",
  "edit.confirm.lead": "Editing ",
  "edit.confirm.repost": "re-publishes this as a new post",
  "edit.confirm.mid": ", and ",
  "edit.confirm.has.prefix": "this post's ",
  "edit.confirm.has.counts": "{likes} flowers and {comments} comments",
  "edit.confirm.has.suffix": " won't carry over.",
  "edit.confirm.none":
    "The flowers and comments on the original post won't carry over.",
  "edit.confirm.q": "Are you sure?",
  "edit.back": "Back",
  "edit.confirm.submit": "Edit and re-post",
  "edit.cancel": "Cancel",
  "edit.saving": "Re-posting…",
  "edit.update": "Update",

  "ranking.board.loading": "Loading…",
  "ranking.board.error": "Couldn't load the rankings.",
  "ranking.board.reload": "Reload",
  "ranking.board.empty": "There aren't enough posts yet to show a ranking.",
  "ranking.board.firstPost": "Post the first pot",
  "ranking.board.demo": "Dev preview (?demo) — synthetic data, not real posts.",
  "ranking.board.firstWeek":
    "This is the first week of tallying. Comparison with last week (↑↓) starts next week.",
  "ranking.board.count.unit": "",
  "ranking.board.chart.loading": "Loading chart…",
  "ranking.board.delta.new": "new entry",
  "ranking.board.delta.re": "re-entry",
  "ranking.board.delta.same": "no change",
  "ranking.board.delta.up": "up {by}",
  "ranking.board.delta.down": "down {by}",
  "ranking.board.rowSummary": "#{rank} {sci} {count} posts {delta}",

  "ranking.chart.sparse":
    "The trend chart appears once two or more weeks have accumulated.",
  "ranking.chart.caption":
    "Progress (movement) — weekly post counts. See the table above for exact ranks.",
  "ranking.chart.summary":
    "A chart of weekly post counts for the top varieties ({names}). See the table above for details.",

  "dilution.stop.none": "None",
  "dilution.trigger.idle": "Adjust how {name} appears",
  "dilution.trigger.active": "Reducing {name} to 1/{n}",
  "dilution.heading": "Show less of {name}'s posts in the feed",
  "dilution.slider.aria": "How much to reduce {name}'s posts in the feed",

  "input.clear": "Clear input",
  "input.resizeHandle.aria": "Resize the input height",

  "feed.skeleton.loading.sr": "Loading plants…",

  // About label (aboutLabel.ts・#262). Visitor = the gateway to the world; citizen = your own book.
  "about.label.visitor": "About Hanōba",
  "about.label.citizen": "Citizen's Handbook",

  // Hanōba Citizen's Handbook (cityHall.ts / CityHallBook・#163). Voiced by Mayor Botanics von Hanōba.
  "cityHall.book.title": "The Hanōba Citizen's Handbook",
  "cityHall.mayor.name": "Botanics von Hanōba",
  "cityHall.mayor.shortName": "Botanics",
  // P1 Welcome (the Mayor's address of greeting).
  "cityHall.welcome.title": "An Invitation to Settle",
  "cityHall.welcome.0":
    "Ahem. I am the Mayor of Hanōba, Botanics von Hanōba. Welcome, to the green city.",
  "cityHall.welcome.image.alt": "An overview of Hanōba, wrapped in green",
  "cityHall.welcome.1":
    "In my city there is no rent for land. So long as you grow a plant, your plot is yours, free and forever. There is but one thing to do—plant a single pot of yours in a square plot, and add a word. With that, you too are a citizen of standing. Photographs of plants only (people and pets, take them to some other town).",
  "cityHall.welcome.2":
    "The city's chronicle, its ordinances, its flower shows—all may be viewed from this city hall. Come now, see to the formalities of settling. Decide upon a name you like, and the matter is done. No true name is required—it suffices that you are yourself.",
  "cityHall.welcome.3":
    "* Hanōba is a photo SNS for plants only. One square photo + a word, plants only. Register a name to post.",
  // P2 Town Map (the figure-book's early reward page; civic windows strip at the foot).
  "cityHall.map.title": "Town Map",
  "cityHall.map.lead":
    "Ahem. Behold the map of our city. Hanōba spreads like a single leaf, along the Vein River.",
  "cityHall.map.landmark.0.name": "The Vein River",
  "cityHall.map.landmark.0.text":
    "The city's spine. Every plot shares the water drawn from its veins.",
  "cityHall.map.landmark.1.name": "The Square Plots",
  "cityHall.map.landmark.1.text":
    "A rule set by the first mayor. Every garden is equally square. Large garden or small, to this city all are treasures.",
  "cityHall.map.landmark.2.name": "City Hall",
  "cityHall.map.landmark.2.text":
    "Where you stand now. The civic windows are just below.",
  "cityHall.map.note":
    "The crest and our specialties are recorded on a later page. Consult them with this map as you explore.",
  "cityHall.map.placeholder": "Map in the making",
  "cityHall.map.civic.heading": "Civic Windows",
  "cityHall.map.civic.0.label": "Town Vote",
  "cityHall.map.civic.1.label": "Exhibition (Contest)",
  "cityHall.map.civic.2.label": "Municipal Gazette",
  "cityHall.map.civic.3.label": "Census",
  "cityHall.map.comingSoon": "Opening soon",
  "cityHall.districts.title": "District Guide",
  "cityHall.districts.lead":
    "Ahem. Different plants favor different homes. Allow me to show you the quarter worthy of your pot.",
  "cityHall.districts.0.name": "Glasshouse Quarter",
  "cityHall.districts.0.text":
    "A city of glass, light, and moisture for houseplants and orchids.",
  "cityHall.districts.0.note": "Morning begins by reading the light through the glass; by noon, the streets echo with misting bottles.",
  "cityHall.districts.1.name": "Field District",
  "cityHall.districts.1.text":
    "Square plots of vegetables and herbs share the waters of the Vein River.",
  "cityHall.districts.1.note": "Neighbors agree when to open the channels, and share their harvest baskets beneath the pavilion.",
  "cityHall.districts.2.name": "Orchard Hill",
  "cityHall.districts.2.text":
    "Citrus and fruit trees change their flowers and fragrance with every season.",
  "cityHall.districts.2.note": "The upper slopes catch the breeze. Citizens help with pollination in bloom and harvest when fruit ripens.",
  "cityHall.districts.3.name": "Seedling Alley",
  "cityHall.districts.3.text":
    "A narrow lane for lovers of seeds and sprouts. The smallest pot holds the largest future.",
  "cityHall.districts.3.note": "Doorway tags record each sowing date; spare seeds go into the alley's exchange box.",
  "cityHall.districts.4.name": "Plant-Care Street",
  "cityHall.districts.4.text":
    "A communal nursery where knowledge of repotting, pruning, and watering is exchanged.",
  "cityHall.districts.4.note": "Benches and tools are shared. Bring a struggling pot, and someone's knowledge will lend a hand.",
  // P3 Chronicle. Opens with the Mayor's preamble (every page leads with the Mayor's voice · #469 change B).
  "cityHall.guide.vista": "City Vista",
  "cityHall.guide.landmarks": "Vein River and Landmarks",
  "cityHall.guide.crest": "Civic Crest",
  "cityHall.guide.crest.text": "An ivory field, two green pillars, and one pink crossbar form the letter H: Hanōba's flag and civic emblem.",
  "cityHall.guide.specialties": "Local Specialties",
  "cityHall.guide.specialties.text": "Foliage, field produce, fruit trees, seeds and sprouts, and the tools of care: the pride of five districts.",
  "cityHall.nav.jumpBack": "Back 5 pages",
  "cityHall.nav.jumpForward": "Forward 5 pages",
  "book.nav.first": "First page",
  "book.nav.last": "Last page",
  "cityHall.nav.toc": "Contents",
  "cityHall.chronicle.title": "Chronicle",
  "cityHall.chronicle.lead":
    "Ahem. Let me tell you a little of how our city came to be.",
  "cityHall.chronicle.entry.0.era": "Year One, Spring",
  "cityHall.chronicle.entry.0.text":
    "The first mayor, Botanics von Hanōba, plants the first pot upon the wasteland. The day the sprout appears is decreed the city's birth.",
  "cityHall.chronicle.entry.1.era": "Year One, Summer",
  "cityHall.chronicle.entry.1.text":
    'The Mayor proclaims, "There is no plant called a weed." The making of any ordinance that ranks one above another is forbidden, forever.',
  "cityHall.chronicle.entry.2.era": "Year One, Autumn",
  "cityHall.chronicle.entry.2.text":
    "The waters of the Leafvein River first nourish the greenhouse quarter.",
  "cityHall.chronicle.entry.3.era": "Year One, Winter",
  "cityHall.chronicle.entry.3.text":
    'All plots are decreed to be square. The reason is recorded only as "because it is beautiful."',
  "cityHall.chronicle.note":
    "Each time a citizen arrives, this chronicle is written further.",
  // P4 City ordinances (the Hanōba Charter, each article with the Mayor's commentary). Opens with the Mayor's preamble (#469 change B).
  "cityHall.ordinance.title": "City Ordinances",
  "cityHall.ordinance.lead":
    "Ahem. Here is our city's charter. Formal, yes — but every article is a rule made for the plants.",
  "cityHall.ordinance.0.article": "Article I (Land)",
  "cityHall.ordinance.0.text":
    "The rent for land in the City of Hanōba shall be free, so long as a plant is grown.",
  "cityHall.ordinance.0.commentary":
    "The will to grow is itself your rent. To water, to gaze upon a leaf—with that, you have paid in full.",
  "cityHall.ordinance.1.article": "Article II (Plot)",
  "cityHall.ordinance.1.text":
    "To a single plot shall be added one square photograph, and a word.",
  "cityHall.ordinance.1.commentary":
    "Plots are square, and square alone. Why? Because they are beautiful. That is reason enough.",
  "cityHall.ordinance.2.article": "Article III (Resident)",
  "cityHall.ordinance.2.text":
    "One who has given a name shall be deemed a citizen.",
  "cityHall.ordinance.2.commentary":
    "To give a name is to file for settlement. It need not be your true name. It suffices that you are yourself.",
  "cityHall.ordinance.3.article": "Article IV (Equality)",
  "cityHall.ordinance.3.text":
    "The city loves all plants equally. No plant by the name of weed exists in this city.",
  "cityHall.ordinance.3.commentary":
    "The moss in the shade, the succulent at the eaves—all are treasures of the city. An ordinance that ranks them shall never be enacted.",
  "cityHall.ordinance.4.article": "Article V (Photograph)",
  "cityHall.ordinance.4.text":
    "Photographs displayed in this city shall be of plants alone.",
  "cityHall.ordinance.4.commentary":
    "Let people and pets shine each in their own town. This is a city of plants.",
  // The Mayor's brief word added upon a level promotion.
  "cityHall.flavor.citizen":
    "Your settlement is duly received. Welcome, citizens.",
  "cityHall.flavor.tenured":
    "Ahem. You are now an old friend of the city. I have left the inner rooms open for you.",
  // CityHallBook UI chrome.
  "cityHall.mayorTitle": "Mayor {name}",
  "book.nav.aria": "Turn the page",
  "book.nav.prev": "Previous page",
  "book.nav.prev.label": "Back",
  "book.nav.next": "Next page",
  "book.nav.next.label": "Next",
  "book.nav.indicator": "{page} / {total}",

  // Municipal Gazette (gazette.ts / GazetteBook · #164). A static changelog written in the voice of
  // Mayor Botanics von Hanōba. Shares the same book pager (BookPager) as the Citizen's Handbook.
  // Articles are numbered oldest to newest; a first visit with no saved page opens the final/newest page (#533).
  "gazette.book.title": "The Hanōba Municipal Gazette",
  // Article 0: the Citizen's Handbook revision (#137).
  "gazette.articles.0.heading": "A Revised Citizen's Handbook",
  "gazette.articles.0.body.0":
    "Ahem. I have given the Citizen's Handbook a full revision. District guides, the city chronicle, the ordinances — everything a traveler might wish to know, gathered anew into one volume.",
  "gazette.articles.0.body.1":
    "Pick it up and leaf through it, and Hanōba's origins and rules become clear at a glance. No more wandering lost.",
  "gazette.articles.0.closing": "Do carry this volume with you as a companion on your travels.",
  "gazette.articles.0.link.0.label": "Open the Citizen's Handbook",
  // Article 1: multilingual display language support (#147).
  "gazette.articles.1.heading": "Our Language Opens to the World",
  "gazette.articles.1.body.0":
    "Ahem. I have switched Hanōba's default display language to English and set multilingual support properly in motion. The switch is available from any page.",
  "gazette.articles.1.body.1":
    "Words may differ, but the heart of cultivation is one. Welcoming plant lovers from every corner of the world — that is the measure of our city.",
  "gazette.articles.1.closing": "Friends who journey from afar are welcomed just the same as you.",
  // Article 2: the residents' vote and census windows open (#160 · #162).
  "gazette.articles.2.heading": "Two Civic Windows, Now Open",
  "gazette.articles.2.body.0":
    "Ahem. I have opened the residents' vote and a window onto the rising popularity of varieties. The former carries your voice; the latter shows which varieties are thriving in this city right now.",
  "gazette.articles.2.body.1":
    "At last, we have a proper way to reflect both the citizens' voice and the varieties' momentum in city affairs.",
  "gazette.articles.2.closing": "I miss neither your vote nor a variety's rise — rest assured of that.",
  "gazette.articles.2.link.0.label": "Visit the Residents' Vote",
  "gazette.articles.2.link.1.label": "Visit the Census",
  // Article 3 (oldest): the "Your Plants" screen merges name and profile (#104).
  "gazette.articles.3.heading": "Your Plants, Now on a Single Card",
  "gazette.articles.3.body.0":
    "Ahem. I have revised the \"Your Plants\" screen and combined your name and profile onto a single card.",
  "gazette.articles.3.body.1":
    "Now a single glance at that card tells you just what kind of citizen you are.",
  "gazette.articles.3.closing": "Your card, too, shall surely be one to take pride in.",
  "gazette.articles.3.link.0.label": "View Your Plants",
  // Article 4 (newest): reactions (flowers) and comments open (#529 · #530 · #142 · #537).
  "gazette.articles.4.heading": "A Flower to Give, a Word to Share",
  "gazette.articles.4.body.0":
    "Ahem. I have made it so a post may be sent a yellow flower in token of your favor, with a few words of your own attached besides. And should you have a change of heart, touch that flower once more and the gift is undone — the Mayor holds no grudge.",
  "gazette.articles.4.body.1":
    "To lend your heart to another's pot, and to exchange a few words — that too is part of this city's work of cultivation.",
  "gazette.articles.4.closing":
    "Not one of your flowers, nor a single word, shall go to waste — all become nourishment for this city's growth.",
  "gazette.articles.4.link.0.label": "View Everyone's Plants",
};
