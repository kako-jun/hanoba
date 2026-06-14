import { useEffect, useMemo, useState } from "react";
import { fetchHanobaFeed } from "../../lib/nostr/client.ts";
import { filterByHashtag, type FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";

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
export default function FeedGrid() {
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
    return <p className="py-12 text-center text-ha-ink/60">読み込み中…</p>;
  }

  if (status === "error") {
    return (
      <div className="py-12 flex flex-col items-center gap-4 text-center">
        <p className="text-ha-ink/70">フィードを読み込めませんでした。</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:bg-ha-green-deep hover:shadow-md transition-all"
        >
          再試行
        </button>
      </div>
    );
  }

  return (
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
            絞り込みを解除
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          {activeTag !== null ? (
            <p className="text-ha-ink/70">「#{activeTag}」の投稿はまだありません。</p>
          ) : (
            <>
              <p className="text-ha-ink/70">まだ投稿がありません。最初の一枚を投稿しましょう。</p>
              <a
                href="/compose"
                className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:bg-ha-green-deep hover:shadow-md transition-all"
              >
                投稿する
              </a>
            </>
          )}
        </div>
      ) : (
        <PostGrid posts={visible} onSelectHashtag={setActiveTag} />
      )}
    </section>
  );
}
