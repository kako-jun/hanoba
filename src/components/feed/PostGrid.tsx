import { useEffect, useMemo, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { buildVarietyIndex } from "../../lib/plants/fuda.ts";
import { diluteFeed } from "../../lib/feed/dilution.ts";
import { fetchCommentCountsBatch, fetchReactionCountsBatch } from "../../lib/nostr/client.ts";
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

  // 品種カタログを1回だけ動的 import（カードの植物札＝buildFuda 用・#239）。グリッド単位で1回読み、
  // 各 PostCard に配る（カードごとに import しない）。重い chunk なので非同期＝カードは即描画し、
  // 札はロード後にふっと出る（グレースフル）。失敗時は null＝札を出さないだけ。
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    import("../../lib/plants/variety-catalog.ts")
      .then((mod) => {
        if (alive) setCatalog(mod.VARIETY_CATALOG);
      })
      .catch(() => {
        /* 札を出さないだけ（catalog は null のまま）。 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 札解決の索引（#257）。catalog 全走査（~2,000品種＋別名）はグリッドで**1回だけ**行い、各 PostCard へ
  // 配る（カードごとに作り直さない＝旧 buildFuda はカード数ぶん索引を再構築していた）。catalog は安定。
  const fudaIndex = useMemo(() => (catalog ? buildVarietyIndex(catalog) : null), [catalog]);

  // カードのいいね数・コメント数（#276）。グリッド単位で**1回ずつ**バッチ取得し各 PostCard へ配る
  // （catalog/useProfiles と同じ「1回取得し配る」パターン・カードごとに query しない＝N+1 回避）。
  // 取得は非同期＝カードは即描画し、count はロード後にふっと出る。失敗時は空 Map＝count を出さない。
  // カードは間引き前後で id 集合が変わらない（diluteFeed は posts の部分集合）ので、間引き前の posts で引く。
  const [reactionCounts, setReactionCounts] = useState<Map<string, number>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  // id 列をキーにして、同じ投稿集合では取り直さない（タグ絞り込み等で集合が変わったら引き直す）。
  // ids（配列）を持ち idsKey は join で派生する＝useEffect は idsKey（文字列）が変わった時だけ再実行する
  // （id 集合が変わった時だけ＝挙動は従来と等価。string→split の往復をやめただけ）。
  const ids = useMemo(() => posts.map((p) => p.id), [posts]);
  const idsKey = ids.join(",");
  useEffect(() => {
    if (idsKey === "") return; // 投稿0件なら取得しない。
    let alive = true;
    Promise.all([fetchReactionCountsBatch(ids), fetchCommentCountsBatch(ids)])
      .then(([reactions, comments]) => {
        if (!alive) return;
        setReactionCounts(reactions);
        setCommentCounts(comments);
      })
      .catch(() => {
        /* count を出さないだけ（Map は空のまま）。 */
      });
    return () => {
      alive = false;
    };
  }, [idsKey]);

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
            fudaIndex={fudaIndex}
            reactionCount={reactionCounts.get(post.id)}
            commentCount={commentCounts.get(post.id)}
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
