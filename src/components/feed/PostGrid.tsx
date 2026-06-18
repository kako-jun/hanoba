import { useMemo, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { diluteFeed } from "../../lib/feed/dilution.ts";
import PostCard from "./PostCard.tsx";
import PostDetail from "./PostDetail.tsx";
import { useProfiles } from "./useProfiles.ts";
import { useDilution } from "./useDilution.ts";

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

  // 投稿頻度の高い人を「薄める」設定（#138）。取得済みリスト → 表示の間に間引き段を挟む。
  // 人ごとの level（1/2・1/5・1/10）で id ハッシュにより決定的に間引く＝リロードしても残る投稿は同じ。
  // 設定（モーダルの DilutionControl）が変わると map が更新され、表示が即座に再間引きされる。
  const { map: dilutionMap } = useDilution();
  const visible = useMemo(() => diluteFeed(posts, dilutionMap), [posts, dilutionMap]);

  // 選択中の投稿は**間引き前の posts** から引く（薄めた人でもモーダルを開いて設定を変えられる）。
  const selected = useMemo(
    () => (selectedId === null ? null : (posts.find((p) => p.id === selectedId) ?? null)),
    [posts, selectedId],
  );

  // 相対時刻の基準。描画時点でよい（1秒未満のズレは表示に影響しない）。
  const now = Math.floor(Date.now() / 1000);

  // 著者プロフィール（アイコン/名前/サイト）を一括取得（#35・キャッシュ付き）。
  // 間引き前の posts に対して引く（選択中の薄めた著者の名前/アイコンも保てる）。
  const profiles = useProfiles(posts.map((p) => p.pubkey));

  function selectHashtag(tag: string) {
    setSelectedId(null); // モーダルが開いていたら閉じてから絞り込む/再検索する。
    onSelectHashtag(tag);
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {visible.map((post, i) => (
          <PostCard
            key={post.id}
            post={post}
            index={i}
            now={now}
            onOpen={() => setSelectedId(post.id)}
            onSelectHashtag={selectHashtag}
            profile={profiles.get(post.pubkey) ?? null}
          />
        ))}
      </ul>

      {selected !== null && (
        <PostDetail
          post={selected}
          profile={profiles.get(selected.pubkey) ?? null}
          onClose={() => setSelectedId(null)}
          onSelectHashtag={selectHashtag}
          // フィード/discover は他人を薄める導線を出す（#138）。/me（MyGrid）は出さない＝自分を薄めない。
          showDilution
        />
      )}
    </>
  );
}
