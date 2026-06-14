// プロフィールの複数サイトリンク（#35 Piece 2）のための純粋関数。
// URL → サービス名（表示・title/aria 用）と、hanoba の統一アイコン名への対応付け。
// mypace の serviceDetection を移植。アイコンは lucide ではなく hanoba 自前 SVG
// （#21・単一出自/統一線幅）の小さなカテゴリ集合に寄せる。ブランドロゴの寄せ集めにしない。

import type { IconName } from "../../components/ui/Icon.tsx";

/**
 * URL から表示用のサービス名を判定する純粋関数（mypace 移植）。
 * 該当しなければ `Website`。判定は小文字化した部分一致（ドメイン含有）。
 */
export function detectServiceLabel(url: string): string {
  const lowered = url.toLowerCase();

  // グローバル
  if (lowered.includes("github.com")) return "GitHub";
  if (lowered.includes("twitter.com") || lowered.includes("x.com")) return "X";
  if (lowered.includes("youtube.com") || lowered.includes("youtu.be")) return "YouTube";
  if (lowered.includes("instagram.com")) return "Instagram";
  if (lowered.includes("linkedin.com")) return "LinkedIn";
  if (lowered.includes("facebook.com")) return "Facebook";
  if (lowered.includes("bsky.app")) return "Bluesky";
  if (lowered.includes("twitch.tv")) return "Twitch";
  if (lowered.includes("discord.gg") || lowered.includes("discord.com")) return "Discord";
  if (lowered.includes("reddit.com")) return "Reddit";
  if (lowered.includes("medium.com")) return "Medium";
  if (lowered.includes("substack.com")) return "Substack";
  if (lowered.includes("tiktok.com")) return "TikTok";
  if (lowered.includes("threads.net")) return "Threads";
  if (lowered.includes("mastodon.") || lowered.includes("mstdn.")) return "Mastodon";
  if (lowered.includes("gitlab.com")) return "GitLab";
  if (lowered.includes("bitbucket.org")) return "Bitbucket";
  if (lowered.includes("stackoverflow.com")) return "Stack Overflow";
  if (lowered.includes("dev.to")) return "DEV";
  if (lowered.includes("hashnode.")) return "Hashnode";
  if (lowered.includes("patreon.com")) return "Patreon";
  if (lowered.includes("ko-fi.com")) return "Ko-fi";
  if (lowered.includes("buymeacoffee.com")) return "Buy Me a Coffee";
  if (lowered.includes("paypal.me") || lowered.includes("paypal.com")) return "PayPal";
  if (lowered.includes("spotify.com")) return "Spotify";
  if (lowered.includes("soundcloud.com")) return "SoundCloud";
  if (lowered.includes("bandcamp.com")) return "Bandcamp";
  if (lowered.includes("music.apple.com") || lowered.includes("apple.com/music")) return "Apple Music";
  if (lowered.includes("dribbble.com")) return "Dribbble";
  if (lowered.includes("behance.net")) return "Behance";
  if (lowered.includes("figma.com")) return "Figma";
  if (lowered.includes("codepen.io")) return "CodePen";
  if (lowered.includes("producthunt.com")) return "Product Hunt";
  if (lowered.includes("pinterest.")) return "Pinterest";
  if (lowered.includes("tumblr.com")) return "Tumblr";
  if (lowered.includes("vimeo.com")) return "Vimeo";
  if (lowered.includes("dailymotion.com")) return "Dailymotion";
  if (lowered.includes("telegram.me") || lowered.includes("t.me")) return "Telegram";
  if (lowered.includes("signal.org")) return "Signal";
  if (lowered.includes("whatsapp.com")) return "WhatsApp";
  if (lowered.includes("line.me")) return "LINE";
  if (lowered.includes("steam")) return "Steam";
  if (lowered.includes("itch.io")) return "itch.io";
  if (lowered.includes("playstation.com")) return "PlayStation";
  if (lowered.includes("xbox.com")) return "Xbox";
  if (lowered.includes("nintendo.")) return "Nintendo";
  if (lowered.includes("gumroad.com")) return "Gumroad";
  if (lowered.includes("notion.so") || lowered.includes("notion.site")) return "Notion";
  if (lowered.includes("amazon.")) return "Amazon";
  if (lowered.includes("etsy.com")) return "Etsy";

  // 日本のサービス（植物・園芸・同人ユーザーが使いやすい）
  if (lowered.includes("qiita.com")) return "Qiita";
  if (lowered.includes("zenn.dev")) return "Zenn";
  if (lowered.includes("note.com")) return "note";
  if (lowered.includes("hatenablog.com") || lowered.includes("hatenadiary.")) return "はてなブログ";
  if (lowered.includes("b.hatena.ne.jp")) return "はてブ";
  if (lowered.includes("hatena.ne.jp")) return "はてな";
  if (lowered.includes("pixiv.net")) return "Pixiv";
  if (lowered.includes("fanbox.cc")) return "FANBOX";
  if (lowered.includes("booth.pm")) return "BOOTH";
  if (lowered.includes("nicovideo.jp") || lowered.includes("nico.ms")) return "ニコニコ";
  if (lowered.includes("ameblo.jp") || lowered.includes("ameba.jp")) return "Ameba";
  if (lowered.includes("fc2.com")) return "FC2";
  if (lowered.includes("livedoor.jp") || lowered.includes("blog.jp")) return "livedoor";
  if (lowered.includes("speakerdeck.com")) return "Speaker Deck";
  if (lowered.includes("slideshare.net")) return "SlideShare";
  if (lowered.includes("lit.link")) return "lit.link";
  if (lowered.includes("linktr.ee")) return "Linktree";
  if (lowered.includes("potofu.me")) return "POTOFU";
  if (lowered.includes("suzuri.jp")) return "SUZURI";
  if (lowered.includes("minne.com")) return "minne";
  if (lowered.includes("creema.jp")) return "Creema";
  if (lowered.includes("stores.jp")) return "STORES";
  if (lowered.includes("base.shop") || lowered.includes("thebase.in")) return "BASE";
  if (lowered.includes("mercari.com")) return "メルカリ";
  if (lowered.includes("rakuten.co.jp")) return "楽天";
  if (lowered.includes("bilibili.com")) return "bilibili";

  return "Website";
}

/**
 * サービス名を hanoba の統一アイコン名に対応付ける純粋関数。
 * ブランドごとの専用ロゴは持たず、意味カテゴリの統一線アイコンに寄せる
 * （#21・単一出自/統一線幅）。X だけは普及済みで識別性が高いので専用。
 * 該当しなければ `link`（地球＝個人サイト/汎用）。
 */
export function serviceIconName(label: string): IconName {
  switch (label) {
    case "X":
      return "x";

    // コード/開発
    case "GitHub":
    case "GitLab":
    case "Bitbucket":
    case "CodePen":
    case "Stack Overflow":
      return "code";

    // 動画/配信
    case "YouTube":
    case "Vimeo":
    case "Dailymotion":
    case "TikTok":
    case "Twitch":
    case "ニコニコ":
    case "bilibili":
      return "youtube";

    // 写真
    case "Instagram":
      return "instagram";

    // 文章/ブログ
    case "Medium":
    case "Substack":
    case "DEV":
    case "Hashnode":
    case "Qiita":
    case "Zenn":
    case "note":
    case "はてなブログ":
    case "はてな":
    case "はてブ":
    case "Ameba":
    case "FC2":
    case "livedoor":
    case "Tumblr":
    case "Notion":
    case "Speaker Deck":
    case "SlideShare":
      return "writing";

    // 絵/デザイン
    case "Behance":
    case "Pixiv":
    case "FANBOX":
    case "Dribbble":
    case "Figma":
      return "art";

    // 音楽
    case "Spotify":
    case "Apple Music":
    case "SoundCloud":
    case "Bandcamp":
      return "music";

    // 買い物/通販
    case "Amazon":
    case "Etsy":
    case "BOOTH":
    case "SUZURI":
    case "minne":
    case "Creema":
    case "STORES":
    case "BASE":
    case "Gumroad":
    case "メルカリ":
    case "楽天":
      return "shopping";

    // ゲーム
    case "Steam":
    case "itch.io":
    case "PlayStation":
    case "Xbox":
    case "Nintendo":
      return "game";

    // 分散 SNS（Nostr 隣接）
    case "Mastodon":
    case "Bluesky":
    case "Threads":
      return "at";

    // チャット/メッセージ
    case "Discord":
    case "Telegram":
    case "LINE":
    case "Signal":
    case "WhatsApp":
    case "Reddit":
      return "chat";

    // 支援/投げ銭（花＝差し色のハート）
    case "Patreon":
    case "Ko-fi":
    case "Buy Me a Coffee":
      return "heart";

    // 個人サイト/リンク集/その他すべて
    default:
      return "link";
  }
}

/** サイトリンク 1 件分の表示データ（純粋・テスト容易）。 */
export interface SiteLink {
  url: string;
  label: string;
  icon: IconName;
}

/** websites 配列を表示用 SiteLink[] に整形する純粋関数。 */
export function toSiteLinks(websites: string[]): SiteLink[] {
  return websites.map((url) => {
    const label = detectServiceLabel(url);
    return { url, label, icon: serviceIconName(label) };
  });
}
