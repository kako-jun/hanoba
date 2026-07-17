import { useEffect, useMemo, useRef, useState } from "react";
import { fetchHanobaFeed } from "../../lib/nostr/client.ts";
import { filterByHashtag, mergeAppendById, type FeedPost } from "../../lib/feed/parse.ts";
import { useT, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";
import { waitForSwCheck } from "../../lib/pwa/registerUpdate.ts";
import PostGrid from "./PostGrid.tsx";
import FeedSkeleton from "./FeedSkeleton.tsx";
import LoadMoreButton from "./LoadMoreButton.tsx";

const FEED_PAGE = 100;

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
  // lang は SSR/初期描画の種（ja）。マウント後にクライアント解決値（en を選んでいれば en）へ寄せる。
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  // #554: 「もっと見る」（過去へ遡って追記）。hasMore は初期 true、新規増分0 で打ち止め。
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // 再取得中の古い応答で setState しない stale-async ガード。
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function load() {
    setStatus("loading");
    setHasMore(true);
    try {
      // PWA 更新チェックが一段落するまで relay 取得を待つ（#551・agasteer 方式）。直後に
      // 更新 reload が起きた場合に無駄になる取得を減らす。初回以降はすでに解決済みで即時。
      await waitForSwCheck;
      const result = await fetchHanobaFeed(FEED_PAGE);
      if (!aliveRef.current) return;
      setPosts(result);
      setStatus("loaded");
    } catch {
      // fetchHanobaFeed は基本フォールバックするが、念のため error 状態も持つ。
      if (aliveRef.current) setStatus("error");
    }
  }

  // #554: 母集団（絞り込み前の posts）の最古 createdAt を until にして次バッチを追記する。
  // 絞り込み（activeTag）は表示時 useMemo のままで、ここは母集団を伸ばす（絞り込み表示が0件でも増やせる）。
  async function loadMore() {
    const oldest = posts[posts.length - 1]; // posts は createdAt 降順＝末尾が最古。
    if (loadingMore || oldest === undefined) return;
    setLoadingMore(true);
    const until = oldest.createdAt;
    try {
      const batch = await fetchHanobaFeed(FEED_PAGE, until);
      if (!aliveRef.current) return;
      setPosts((prev) => {
        const merged = mergeAppendById(prev, batch);
        // 新規増分0 なら打ち止め（同秒境界の重複は dedup が畳むので -1 は不要）。
        if (merged.length === prev.length) setHasMore(false);
        return merged;
      });
    } catch {
      // 取得失敗はボタンを残して再試行可能にする（hasMore は据え置き）。
    } finally {
      if (aliveRef.current) setLoadingMore(false);
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
    <LocaleProvider value={loc}>
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

        {/* #554: もっと見る。母集団に投稿がある間だけ出す（絞り込み表示が0件でも母集団は伸ばせる）。 */}
        {posts.length > 0 && (
          <LoadMoreButton hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
        )}
      </section>
    </LocaleProvider>
  );
}
