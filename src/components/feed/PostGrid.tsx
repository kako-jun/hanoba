import { type CSSProperties, useMemo, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import PostDetail from "./PostDetail.tsx";

interface Props {
  /** 表示する投稿（すべて画像あり想定・呼び出し側で取得・絞り込み済み）。 */
  posts: FeedPost[];
  /**
   * 詳細モーダル内でハッシュタグをクリックしたとき。
   * - FeedGrid: 取得済み hanoba 投稿のクライアント側絞り込み。
   * - DiscoverGrid: そのタグでクロスクライアント再検索。
   * モーダルは選択前に閉じる（呼び出し側の状態遷移と競合しないため）。
   */
  onSelectHashtag: (tag: string) => void;
}

/**
 * 正方形グリッド ＋ 投稿詳細モーダルの presentational コンポーネント。
 * FeedGrid（hanoba 限定）と DiscoverGrid（クロスクライアント）で共有する
 * （guidelines: 単一責務・重複排除）。取得・状態（loading/error/タグ絞り込み）は
 * 持たず、渡された posts を描画してセルクリックで PostDetail を開くだけ。
 *
 * - 正方形グリッド: aspect-square のセルに object-cover の 1:1 画像。
 * - セルクリックで PostDetail をモーダル表示（別ルートにしない＝静的サイト維持）。
 * - 開いている投稿が posts から消えても落ちないよう selected は id 引きにする。
 */
export default function PostGrid({ posts, onSelectHashtag }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (selectedId === null ? null : (posts.find((p) => p.id === selectedId) ?? null)),
    [posts, selectedId],
  );

  function selectHashtag(tag: string) {
    setSelectedId(null); // モーダルが開いていたら閉じてから絞り込む/再検索する。
    onSelectHashtag(tag);
  }

  return (
    <>
      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5">
        {posts.map((post, i) => (
          <li
            key={post.id}
            // 角丸・影で「浮くカード」に（地はフラット・カードは持ち上げる＝階層）。
            // ロード時の staggered reveal（--i）。先頭の遅延だけ付け、深部は頭打ちにする。
            className="ha-rise group aspect-square overflow-hidden rounded-2xl bg-ha-green-soft shadow-sm ring-1 ring-ha-green/10 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-ha-green/25"
            style={{ "--i": Math.min(i, 11) } as CSSProperties}
          >
            <button
              type="button"
              onClick={() => setSelectedId(post.id)}
              // caption 空は仕様上起きない（一言必須・DESIGN §1）が、他クライアント投稿への防御。
              aria-label={post.caption === "" ? "投稿の詳細を開く" : post.caption}
              className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green focus-visible:ring-offset-1"
            >
              {post.imageUrl !== null && (
                <img
                  src={post.imageUrl}
                  alt={post.caption}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
              )}
            </button>
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
