// プロフィールの複数サイトリンク（#35 Piece 2）のための純粋関数。
// URL → サービス名（表示・title/aria 用）と、hanoba の統一アイコン名への対応付け。
// mypace の serviceDetection を移植。アイコンは lucide ではなく hanoba 自前 SVG
// （#21・単一出自/統一線幅）の小さなカテゴリ集合に寄せる。ブランドロゴの寄せ集めにしない。

import type { IconName } from "../../components/ui/Icon.tsx";

/**
 * URL から表示用のサービス名を判定する純粋関数（mypace 移植・ホスト名照合に強化）。
 * 部分一致ではなくホスト名（`new URL().hostname`）で照合し、`x.com` が `maxx.com`
 * やクエリ文字列に紛れ込んで誤爆するのを防ぐ（#77 レビュー指摘）。
 * URL としてパースできない/ホストが無いものは `Website`。
 */
export function detectServiceLabel(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "Website";
  }
  if (host === "") return "Website";

  // ドメイン完全一致 or サブドメイン（`.domain` 終端）。`x.com` 等の単短ドメインの誤爆を防ぐ。
  const isHost = (domain: string): boolean => host === domain || host.endsWith(`.${domain}`);
  // ホスト名に文字列を含む（インスタンスが多数あるサービス＝mastodon.*・steam* 等のみ）。
  const hostHas = (s: string): boolean => host.includes(s);

  // グローバル
  if (isHost("github.com")) return "GitHub";
  if (isHost("x.com") || isHost("twitter.com")) return "X";
  if (isHost("youtube.com") || isHost("youtu.be")) return "YouTube";
  if (isHost("instagram.com")) return "Instagram";
  if (isHost("linkedin.com")) return "LinkedIn";
  if (isHost("facebook.com")) return "Facebook";
  if (isHost("bsky.app")) return "Bluesky";
  if (isHost("twitch.tv")) return "Twitch";
  if (isHost("discord.gg") || isHost("discord.com")) return "Discord";
  if (isHost("reddit.com")) return "Reddit";
  if (isHost("medium.com")) return "Medium";
  if (isHost("substack.com")) return "Substack";
  if (isHost("tiktok.com")) return "TikTok";
  if (isHost("threads.net")) return "Threads";
  if (hostHas("mastodon.") || hostHas("mstdn.")) return "Mastodon";
  if (isHost("gitlab.com")) return "GitLab";
  if (isHost("bitbucket.org")) return "Bitbucket";
  if (isHost("stackoverflow.com")) return "Stack Overflow";
  if (isHost("dev.to")) return "DEV";
  if (hostHas("hashnode.")) return "Hashnode";
  if (isHost("patreon.com")) return "Patreon";
  if (isHost("ko-fi.com")) return "Ko-fi";
  if (isHost("buymeacoffee.com")) return "Buy Me a Coffee";
  if (isHost("paypal.me") || isHost("paypal.com")) return "PayPal";
  if (isHost("spotify.com")) return "Spotify";
  if (isHost("soundcloud.com")) return "SoundCloud";
  if (isHost("bandcamp.com")) return "Bandcamp";
  if (isHost("music.apple.com")) return "Apple Music";
  if (isHost("dribbble.com")) return "Dribbble";
  if (isHost("behance.net")) return "Behance";
  if (isHost("figma.com")) return "Figma";
  if (isHost("codepen.io")) return "CodePen";
  if (isHost("producthunt.com")) return "Product Hunt";
  if (hostHas("pinterest.")) return "Pinterest";
  if (isHost("tumblr.com")) return "Tumblr";
  if (isHost("vimeo.com")) return "Vimeo";
  if (isHost("dailymotion.com")) return "Dailymotion";
  if (isHost("telegram.me") || isHost("t.me")) return "Telegram";
  if (isHost("signal.org")) return "Signal";
  if (isHost("whatsapp.com")) return "WhatsApp";
  if (isHost("line.me")) return "LINE";
  if (hostHas("steam")) return "Steam";
  if (isHost("itch.io")) return "itch.io";
  if (isHost("playstation.com")) return "PlayStation";
  if (isHost("xbox.com")) return "Xbox";
  if (hostHas("nintendo.")) return "Nintendo";
  if (isHost("gumroad.com")) return "Gumroad";
  if (isHost("notion.so") || isHost("notion.site")) return "Notion";
  if (hostHas("amazon.")) return "Amazon";
  if (isHost("etsy.com")) return "Etsy";

  // 日本のサービス（植物・園芸・同人ユーザーが使いやすい）
  if (isHost("qiita.com")) return "Qiita";
  if (isHost("zenn.dev")) return "Zenn";
  if (isHost("note.com")) return "note";
  if (isHost("hatenablog.com") || hostHas("hatenadiary.")) return "はてなブログ";
  if (isHost("b.hatena.ne.jp")) return "はてブ";
  if (isHost("hatena.ne.jp")) return "はてな";
  if (isHost("pixiv.net")) return "Pixiv";
  if (isHost("fanbox.cc")) return "FANBOX";
  if (isHost("booth.pm")) return "BOOTH";
  if (isHost("nicovideo.jp") || isHost("nico.ms")) return "ニコニコ";
  if (isHost("ameblo.jp") || isHost("ameba.jp")) return "Ameba";
  if (isHost("fc2.com")) return "FC2";
  if (isHost("livedoor.jp") || isHost("blog.jp")) return "livedoor";
  if (isHost("speakerdeck.com")) return "Speaker Deck";
  if (isHost("slideshare.net")) return "SlideShare";
  if (isHost("lit.link")) return "lit.link";
  if (isHost("linktr.ee")) return "Linktree";
  if (isHost("potofu.me")) return "POTOFU";
  if (isHost("suzuri.jp")) return "SUZURI";
  if (isHost("minne.com")) return "minne";
  if (isHost("creema.jp")) return "Creema";
  if (isHost("stores.jp")) return "STORES";
  if (isHost("base.shop") || isHost("thebase.in")) return "BASE";
  if (isHost("mercari.com")) return "メルカリ";
  if (isHost("rakuten.co.jp")) return "楽天";
  if (isHost("bilibili.com")) return "bilibili";

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
