import { useEffect, useMemo, useState } from "react";
import { fetchHanobaFeed } from "../../lib/nostr/client.ts";
import { filterByHashtag, type FeedPost } from "../../lib/feed/parse.ts";
import { useT, LocaleProvider, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";
import PostGrid from "./PostGrid.tsx";
import FeedSkeleton from "./FeedSkeleton.tsx";

type Status = "loading" | "error" | "loaded";

/**
 * hanoba フィードの正方形グリッド島（client:load）。
 *
 * - マウントで fetchHanobaFeed()（t:hanoba・画像ありの hanoba 投稿だけ）。
 * - 本文 # クリックでクライアント側タグ絞り込み（filterByHashtag）。
 *   取得済みの hanoba 投稿に対してのみ絞り込む＝他クライアント投稿は混ざらない。
 *   （クロスクライアント集約は別島 DiscoverGrid・別ページ /discover の領分。混ぜない。）
 * - 正方形グリッド ＋ 詳細モーダルの描画は PostGrid に委譲（DiscoverGrid と共有）。
 * - relay 取得は useEffect（クライアント）でのみ。SSR では走らせない。
 */
// lang は index.astro がページの locale を流す（#147）。今は既定（ja）固定＝挙動不変。
// 子孫（PostGrid→PostCard 等）は LocaleProvider 経由で useLocale から読む。
export default function FeedGrid({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  const t = useT(lang);
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  async function load() {
    setStatus("loading");
    try {
      const result = await fetchHanobaFeed();
      setPosts(result);
      setStatus("loaded");
    } catch {
      // fetchHanobaFeed は基本フォールバックするが、念のため error 状態も持つ。
      setStatus("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // 絞り込み後の表示リスト。activeTag が無ければ全件。
  const visible = useMemo(
    () => (activeTag === null ? posts : filterByHashtag(posts, activeTag)),
    [posts, activeTag],
  );

  if (status === "loading") {
    return <FeedSkeleton />;
  }

  if (status === "error") {
    return (
      <div className="py-12 flex flex-col items-center gap-4 text-center">
        <p className="text-ha-ink/70">{t("feed.error")}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <LocaleProvider value={lang}>
      <section className="flex flex-col gap-4">
        {activeTag !== null && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-ha-green text-ha-white px-3 py-1 text-sm font-medium">
              #{activeTag}
            </span>
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="text-sm text-ha-green hover:text-ha-green-deep underline underline-offset-2"
            >
              {t("feed.filter.clear")}
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          activeTag !== null ? (
            <p className="py-12 text-center text-ha-ink/70">{t("feed.tag.empty", { tag: activeTag })}</p>
          ) : (
            // 投稿が無いときはプレーンな空状態（演出カードは廃止）。
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-ha-ink/70">{t("feed.empty")}</p>
              <a
                href="/compose"
                className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
              >
                {t("nav.compose")}
              </a>
            </div>
          )
        ) : (
          <PostGrid posts={visible} onSelectHashtag={setActiveTag} />
        )}
      </section>
    </LocaleProvider>
  );
}
