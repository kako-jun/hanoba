import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * フィード読み込み中のスケルトン（#99）。素っ気ない「読み込み中…」の代わりに、
 * 実際のカード形（写真の正方形＋本文行）をガラスで象って pulse させ、レイアウトの予感を出す。
 * 視覚のみの飾りなので aria-hidden。読み上げ向けには status テキストを別に置く。
 */
export default function FeedSkeleton({ count = 4 }: { count?: number }) {
  const t = useT(useLocale());
  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {t("feed.skeleton.loading.sr")}
      </p>
      <ul className="flex flex-col gap-4" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <li key={i} className="glass rounded-xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:h-56 lg:h-72 animate-pulse">
              {/* 写真の正方形プレースホルダ（カードと同寸）。 */}
              <div className="shrink-0 w-full aspect-square sm:w-56 sm:h-56 lg:w-72 lg:h-72 sm:aspect-auto bg-ha-green-soft" />
              {/* 本文行＋著者行。 */}
              <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="h-4 w-3/4 rounded bg-white/10" />
                <div className="h-4 w-5/6 rounded bg-white/10" />
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-auto flex items-center gap-2 pt-2">
                  <div className="h-5 w-5 rounded-full bg-white/10" />
                  <div className="h-3 w-24 rounded bg-white/10" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
