// 統一アイコンセット（#21）。
// 寄せ集めの Unicode 記号（♡ / × / ↑↓ / →）をやめ、単一出自・統一線幅の SVG に揃える。
// 線アイコンは currentColor・stroke-width 1.75 で統一。塗りは flower（いいね＝黄色い花）・
// heart（Ko-fi）・X 公式ロゴだけ（識別性のため）。
//
// 使い方: <Icon name="close" className="w-5 h-5" />
// 装飾用途は aria-hidden（既定）。意味を持たせる場合は呼び出し側で aria-label を付ける。

// サービスアイコンも統一線スタイル（stroke 1.75・単一出自・#21）。ブランドロゴの
// 寄せ集めにせず、意味カテゴリの線アイコンに寄せる（対応付けは lib/profile/services.ts）。
export type IconName =
  | "close"
  | "heart"
  | "flower"
  | "search"
  | "chevron"
  | "trash"
  | "camera"
  | "image"
  | "sprout"
  | "link"
  | "code"
  | "x"
  | "youtube"
  | "instagram"
  | "writing"
  | "art"
  | "music"
  | "shopping"
  | "game"
  | "at"
  | "chat";

interface IconProps {
  name: IconName;
  className?: string;
}

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export default function Icon({ name, className }: IconProps) {
  switch (name) {
    case "close":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M6 6 18 18M18 6 6 18" />
        </svg>
      );
    case "heart":
      // Ko-fi（支援）の差し色。塗り。色は呼び出し側で指定。
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 20.5 4.2 12.9a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" />
        </svg>
      );
    case "flower":
      // いいね＝黄色い花（絵文字でなく単一出自の SVG・#116）。5枚の花びら＋中心。
      // 塗りで小サイズでも花と即読できる。黄色は呼び出し側で text-ha-yellow を指定。
      // 中心はベース色で抜いて花芯に見せる（暗地単一テーマ＝session640 前提）。
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="6.6" r="3.1" />
          <circle cx="17.1" cy="10.3" r="3.1" />
          <circle cx="15.2" cy="16.3" r="3.1" />
          <circle cx="8.8" cy="16.3" r="3.1" />
          <circle cx="6.9" cy="10.3" r="3.1" />
          <circle cx="12" cy="12" r="2.6" fill="var(--color-ha-base)" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "trash":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
        </svg>
      );
    case "camera":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
          <circle cx="12" cy="13" r="3.2" />
        </svg>
      );
    case "image":
      // アルバム（フォトライブラリ）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.6" />
          <path d="m4 18 5-5 4 4 3-3 4 4" />
        </svg>
      );
    case "sprout":
      // 発芽したての双葉（投稿＝種まき・育てる）。中央の茎＋左右の子葉。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M12 21v-8" />
          <path d="M12 14c0-3.3-2.7-6-6-6 0 3.3 2.7 6 6 6Z" />
          <path d="M12 14c0-3.3 2.7-6 6-6 0 3.3-2.7 6-6 6Z" />
        </svg>
      );
    case "link":
      // 個人サイト/汎用（地球）。経線・緯線。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9s1.3-6.6 3.8-9Z" />
        </svg>
      );
    case "code":
      // コード/開発（山括弧）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
        </svg>
      );
    case "x":
      // X（旧 Twitter）公式ロゴ。線アイコンの ✕（close）と紛れないよう公式グリフを塗りで使う
      // （#21 の線縛りの明示的例外＝DESIGN.md「X だけは専用」・#115）。
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "youtube":
      // 動画/配信（角丸枠＋再生三角）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <rect x="3" y="6" width="18" height="12" rx="3" />
          {/* 再生三角は塗り（小サイズでも「再生」と即読できるよう輪郭でなく塗りに）。 */}
          <path d="m11 9.5 4 2.5-4 2.5z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "instagram":
      // 写真（角丸枠＋レンズ＋右上の点）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.6" />
          <path d="M16.5 7.5h.01" />
        </svg>
      );
    case "writing":
      // 文章/ブログ（ページ＋本文行）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4M9 12h6M9 16h6" />
        </svg>
      );
    case "art":
      // 絵/デザイン（パレット＋絵の具）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M12 3a9 9 0 1 0 0 18 1.8 1.8 0 0 0 1.4-2.9 1.8 1.8 0 0 1 1.4-2.9H17a4 4 0 0 0 4-4c0-3.4-4-6.2-9-6.2Z" />
          <path d="M7.5 11h.01M10 7.5h.01M14 7.5h.01" />
        </svg>
      );
    case "music":
      // 音楽（音符）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M9 18V6l10-2v12" />
          <circle cx="6.5" cy="18" r="2.5" />
          <circle cx="16.5" cy="16" r="2.5" />
        </svg>
      );
    case "shopping":
      // 買い物/通販（ショッピングバッグ）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M6 8h12l-1 12H7z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      );
    case "game":
      // ゲーム（ゲームパッド）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M7 8h10a4 4 0 0 1 4 4v.5a3.5 3.5 0 0 1-6.3 2.1l-.4-.6H9.7l-.4.6A3.5 3.5 0 0 1 3 12.5V12a4 4 0 0 1 4-4Z" />
          <path d="M7.5 11v2M6.5 12h2M15.5 11.5h.01M17 13h.01" />
        </svg>
      );
    case "at":
      // 分散 SNS（@）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <circle cx="12" cy="12" r="3.6" />
          <path d="M15.6 12v1.4a2.4 2.4 0 0 0 4.4 1.3A9 9 0 1 0 12 21" />
        </svg>
      );
    case "chat":
      // チャット/メッセージ（吹き出し）。
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...STROKE}>
          <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
        </svg>
      );
  }
}
