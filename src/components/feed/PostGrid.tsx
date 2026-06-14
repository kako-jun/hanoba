import { useMemo, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import PostCard from "./PostCard.tsx";
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
 * 「読めるフィード」の presentational コンポーネント（#34/#50）。
 * FeedGrid（hanoba 限定）と DiscoverGrid（クロスクライアント）で共有する。
 * 取得・状態（loading/error/タグ絞り込み）は持たず、渡された posts を
 * 縦並びの PostCard に map する。写真タップで PostDetail モーダルを開く
 * （別ルートにせず島内で開く＝静的サイトを維持）。
 *
 * 開いている投稿が posts から消えても落ちないよう selected は id 引きにする。
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
          <PostCard
            key={post.id}
            post={post}
            index={i}
            now={now}
            onOpen={() => setSelectedId(post.id)}
            onSelectHashtag={selectHashtag}
          />
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
