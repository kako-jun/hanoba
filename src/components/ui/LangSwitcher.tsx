import { useEffect, useState } from "react";
import { resolveClientLocale, setClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";

/**
 * 表示言語のセグメント切替（#147 段階2 go-live）。ヘッダに常駐。
 *
 * 並びは「EN / JA」で EN 先（en が基準の向き＝世界に出す殻の素地）。
 * - マウント前は SSR/初期 HTML と一致させるため DEFAULT_LOCALE（ja）で描く。
 * - マウント後に resolveClientLocale() で現在言語を確定（en を選んでいれば EN を強調）。
 *   これで hydration mismatch を起こさず、post-mount の更新で正す。
 * - 非アクティブ側を押すと setClientLocale() が保存＋フルリロード（静的殻を確実に入替）。
 *
 * 殻の文言入替（flash 回避）は MainLayout の is:inline スクリプトが担う。ここは「選ぶ」だけ。
 */
export default function LangSwitcher() {
  // SSR 種は ja（初期 HTML と一致）。マウント後にクライアント解決値へ寄せる。
  const [loc, setLoc] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);

  // アクティブ＝塗りの緑、非アクティブ＝控えめなリンク（押すと切替）。
  const base = "px-2.5 py-1 rounded-full leading-none font-semibold transition-colors";
  const active = "bg-ha-green text-ha-white";
  const idle = "text-ha-green-deep/70 hover:text-ha-green-deep";

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex items-center gap-0.5 rounded-full border border-ha-green/30 p-0.5 text-xs"
    >
      <button
        type="button"
        aria-label="English"
        aria-pressed={loc === "en"}
        onClick={() => loc !== "en" && setClientLocale("en")}
        className={`${base} ${loc === "en" ? active : idle}`}
      >
        EN
      </button>
      <button
        type="button"
        aria-label="日本語"
        aria-pressed={loc === "ja"}
        onClick={() => loc !== "ja" && setClientLocale("ja")}
        className={`${base} ${loc === "ja" ? active : idle}`}
      >
        JA
      </button>
    </div>
  );
}
