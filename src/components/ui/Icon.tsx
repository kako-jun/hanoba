// 統一アイコンセット（#21）。
// 寄せ集めの Unicode 記号（♡ / × / ↑↓ / →）をやめ、単一出自・統一線幅の SVG に揃える。
// 線アイコンは currentColor・stroke-width 1.75 で統一。heart だけ塗り（いいね＝花の差し色）。
//
// 使い方: <Icon name="close" className="w-5 h-5" />
// 装飾用途は aria-hidden（既定）。意味を持たせる場合は呼び出し側で aria-label を付ける。

type IconName = "close" | "heart" | "search" | "chevron" | "trash" | "camera" | "image" | "sprout";

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
      // いいね＝塗り（花＝ピンクは呼び出し側で text-ha-pink を指定）。
      return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
          <path d="M12 20.5 4.2 12.9a4.6 4.6 0 0 1 6.5-6.5l1.3 1.3 1.3-1.3a4.6 4.6 0 0 1 6.5 6.5z" />
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
  }
}
