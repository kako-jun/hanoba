import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 写真一覧グリッド下の「もっと見る」ボタン（#554・3画面共通）。
 * - hasMore が false のときは何も描かない（打ち止め＝ボタンごと消す・文言は出さない）。
 * - loading 中は無効化してラベルを「読み込み中…」に差し替える（二度押し・多重 fetch を防ぐ）。
 * 見た目は retry ボタンのトークンに準拠（DESIGN の ha-green 系）。
 */
export default function LoadMoreButton({
  hasMore,
  loading,
  onClick,
}: {
  hasMore: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const loc = useLocale();
  const t = useT(loc);
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-2">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-busy={loading}
        className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-progress"
      >
        {loading ? t("feed.loadingMore") : t("feed.loadMore")}
      </button>
    </div>
  );
}
