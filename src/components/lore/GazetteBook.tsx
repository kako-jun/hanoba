import { useEffect, useLayoutEffect, useState } from "react";
import BookPager from "./BookPager.tsx";
import MayorMark from "./MayorMark.tsx";
import Icon from "../ui/Icon.tsx";
import { type GazetteArticle, buildGazette } from "../../lib/lore/gazette.ts";
import {
  useT,
  LocaleProvider,
  resolveClientLocale,
  DEFAULT_LOCALE,
  type Locale,
} from "../../lib/i18n/index.ts";

// 市政だより（#164）。市長ボタニクス・フォン・ハノーバが執筆した体裁の静的リリースノート
// （Nostr投稿・専用鍵・バックエンド・自動投稿は無し）。市民手帳（CityHallBook）と同じ
// 本ページャー（BookPager）を共有する。1記事=1ページ、最古→最新の時間順で採番し、
// 保存位置の無い初回だけ defaultPage="last" で最新記事を開く（前＝過去／次＝未来）。
// docs/lore.md に役割・文体の doctrine を持つ。

// SSR では useLayoutEffect が警告を出す。クライアントでのみ layout（ペイント前）に走らせる。
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// 手帳（handbookPage）とは別フィールド＝机上のページ位置保存が互いに干渉しない。
// 集約 blob（appStorage）内の永続化フィールド名。
export const GAZETTE_PAGE_STORAGE_FIELD = "gazettePage" as const;

// lang は gazette.astro がページの locale を流す（#147 と同じ種）。client:only（言語フラッシュ回避）
// のルート島なので、この島が自分で <LocaleProvider value={loc}> を張る（CityHallBook と同じ作法）。
export default function GazetteBook({
  lang = DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  const [loc, setLoc] = useState<Locale>(lang);

  useIsoLayoutEffect(() => {
    setLoc(resolveClientLocale());
  }, []);

  const t = useT(loc);
  const articles = buildGazette(loc);
  const titleText = t("gazette.book.title");

  return (
    <LocaleProvider value={loc}>
      <BookPager
        title={titleText}
        pages={articles}
        storageField={GAZETTE_PAGE_STORAGE_FIELD}
        defaultPage="last"
        renderPage={(article) => <ArticleContent article={article} />}
      />
    </LocaleProvider>
  );
}

/** 記事1件の中身。見出し＋公開日＋市長の言葉（MayorMark）＋本文＋結び＋関連ページへの導線。 */
function ArticleContent({ article }: { article: GazetteArticle }) {
  return (
    <article className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold text-ha-green-deep">
          {article.heading}
        </h2>
        {/* 公開日は保存形式のまま（#347 の撮影日と同じ思想＝locale で書式を変えない）。 */}
        <p className="text-xs text-ha-ink/50 tabular-nums">{article.date}</p>
      </div>
      <MayorMark />
      {/* 記事の挿絵1枚（任意）。市民手帳の guide ページ種と同じマークアップに寄せる（#560）。 */}
      {article.image !== undefined && (
        <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl">
          <img src={article.image} alt={article.heading} className="w-full scale-[1.02] object-cover" />
        </div>
      )}
      {article.body.map((paragraph, i) => (
        <p
          key={i}
          className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]"
        >
          {paragraph}
        </p>
      ))}
      {/* 市長らしい短い結び。本文と区別するため引用のような左罫を添える。 */}
      <p className="text-sm text-ha-ink/70 leading-relaxed [word-break:auto-phrase] border-l-2 border-ha-green/30 pl-4">
        {article.closing}
      </p>
      {article.links.length > 0 && (
        <ul className="flex flex-col gap-2">
          {article.links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="inline-flex items-center gap-1 text-sm font-medium text-ha-green-deep hover:text-ha-green transition-colors"
              >
                {link.label}
                <Icon name="chevron" className="w-4 h-4 -rotate-90" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
