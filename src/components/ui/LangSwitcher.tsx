import { useEffect, useState } from "react";
import { LOCALES, resolveClientLocale, setClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";

/** 各言語の短いボタン表記と aria（#384 多言語・N 言語へ一般化）。LOCALES に言語を足したらここに追記する。 */
const LABEL: Record<Locale, string> = { en: "EN", ja: "JA", es: "ES" };
const ARIA: Record<Locale, string> = { en: "English", ja: "日本語", es: "Español" };
// 表示順＝既定言語を先頭に（世界に出す殻の素地＝既定が基準の向き）、残りは LOCALES の順。
const ORDER: Locale[] = [DEFAULT_LOCALE, ...LOCALES.filter((l) => l !== DEFAULT_LOCALE)];

/**
 * 表示言語のセグメント切替（#147 段階2 go-live・#384 で N 言語へ一般化）。ヘッダに常駐。
 *
 * - マウント前は SSR/初期 HTML と一致させるため DEFAULT_LOCALE で描く。
 * - マウント後に resolveClientLocale() で現在言語を確定（選んでいる言語を強調）。
 *   これで hydration mismatch を起こさず、post-mount の更新で正す。
 * - 非アクティブを押すと setClientLocale() が保存＋フルリロード（静的殻を確実に入替）。
 *
 * 殻の文言入替（flash 回避）は MainLayout の is:inline スクリプトが担う。ここは「選ぶ」だけ。
 */
export default function LangSwitcher() {
  // SSR 種は既定言語（初期 HTML と一致）。マウント後にクライアント解決値へ寄せる。
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
      {ORDER.map((l) => (
        <button
          key={l}
          type="button"
          aria-label={ARIA[l]}
          aria-pressed={loc === l}
          onClick={() => loc !== l && setClientLocale(l)}
          className={`${base} ${loc === l ? active : idle}`}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
