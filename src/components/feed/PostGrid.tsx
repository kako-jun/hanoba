import { type CSSProperties, useMemo, useState } from "react";
import { relativeTime, type FeedPost } from "../../lib/feed/parse.ts";
import PostCaption from "./PostCaption.tsx";
import PostDetail from "./PostDetail.tsx";

interface Props {
  /** 表示する投稿（すべて画像あり想定・呼び出し側で取得・絞り込み済み）。 */
  posts: FeedPost[];
  /**
   * ハッシュタグをクリックしたとき。
   * - FeedGrid: 取得済み hanoba 投稿のクライアント側絞り込み。
   * - DiscoverGrid: そのタグでクロスクライアント再検索。
   * モーダルが開いていれば選択前に閉じる（呼び出し側の状態遷移と競合しないため）。
   */
  onSelectHashtag: (tag: string) => void;
}

/**
 * 「読めるフィード」の presentational コンポーネント（#34）。
 * FeedGrid（hanoba 限定）と DiscoverGrid（クロスクライアント）で共有する
 * （guidelines: 単一責務・重複排除）。取得・状態（loading/error/タグ絞り込み）は
 * 持たず、渡された posts を描画する。
 *
 * hanoba の売り（vs Instagram）＝**本文を切らず全文表示し、読むのに1クリックも要らない**。
 * - 縦並びカード。各カード＝正方形写真＋全文 caption（whitespace-pre-wrap・truncate しない）。
 * - デスクトップ（sm+）= 写真左／本文右、モバイル = 写真上／本文下。
 * - 写真タップで拡大（PostDetail モーダル＝大きい 1:1 ＋詳細）。別ルートにせず島内で開く
 *   ＝静的サイト（CF Pages・SSR なし）を維持する。
 * - 開いている投稿が posts から消えても落ちないよう selected は id 引きにする。
 *
 * 著者ヘッダ（ユーザー名＋アイコン＋複数サイトリンク）は別 Issue（#35）で同カードに載せる。
 */
export default function PostGrid({ posts, onSelectHashtag }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (selectedId === null ? null : (posts.find((p) => p.id === selectedId) ?? null)),
    [posts, selectedId],
  );

  // 相対時刻の基準。描画時点でよい（1秒未満のズレは表示に影響しない）。
  const now = Math.floor(Date.now() / 1000);

  function selectHashtag(tag: string) {
    setSelectedId(null); // モーダルが開いていたら閉じてから絞り込む/再検索する。
    onSelectHashtag(tag);
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {posts.map((post, i) => (
          <li
            key={post.id}
            // ロード時の staggered reveal（--i）。先頭の遅延だけ付け、深部は頭打ちにする。
            className="ha-rise glass rounded-2xl overflow-hidden"
            style={{ "--i": Math.min(i, 11) } as CSSProperties}
          >
            <article className="flex flex-col sm:flex-row">
              {post.imageUrl !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedId(post.id)}
                  // caption 空は仕様上起きない（一言必須・DESIGN §1）が、他クライアント投稿への防御。
                  aria-label={post.caption === "" ? "写真を拡大" : post.caption}
                  className="group block shrink-0 w-full sm:w-56 aspect-square overflow-hidden bg-ha-green-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
                >
                  <img
                    src={post.imageUrl}
                    alt={post.caption}
                    loading="lazy"
                    className="w-full h-full object-cover transition duration-300 group-hover:opacity-90"
                  />
                </button>
              )}

              <div className="flex flex-col gap-2.5 p-4 sm:p-5 min-w-0 flex-1">
                {/* 全文表示（1クリック不要）。極端な長文だけソフト上限で畳む（#40）。 */}
                {post.caption !== "" && <PostCaption caption={post.caption} />}

                {post.hashtags.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {post.hashtags.map((tag) => (
                      <li key={tag}>
                        <button
                          type="button"
                          onClick={() => selectHashtag(tag)}
                          className="rounded-full bg-ha-green-soft text-ha-green-deep px-3 py-1 text-sm font-medium hover:bg-ha-green hover:text-ha-white transition-colors"
                        >
                          #{tag}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <time className="mt-auto pt-1 text-xs text-ha-ink/55">
                  {relativeTime(post.createdAt, now)}
                </time>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {selected !== null && (
        <PostDetail
          post={selected}
          onClose={() => setSelectedId(null)}
          onSelectHashtag={selectHashtag}
        />
      )}
    </>
  );
}
