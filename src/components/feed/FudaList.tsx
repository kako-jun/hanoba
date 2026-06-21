import type { Fuda } from "../../lib/plants/fuda.ts";
import { discoverTagsHref } from "../../lib/feed/discoverFilter.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";
import SciName from "../ui/SciName.tsx";

interface Props {
  /** 投稿の札（学名＋和名・buildFuda の結果）。空なら呼び出し側で出し分ける。 */
  fuda: Fuda[];
}

/**
 * 投稿の植物札（#182/#23）をチップで並べる共有 UI。PostDetail（拡大モーダル）と PostCard
 * （タイムラインのカード右端）で同じ見た目・同じ挙動を使う（#239・kako-jun blink）。
 *
 * 各札はその植物の **discover 絞り込みリンク**。品種札は **属＋品種の AND**（例
 * `/discover?tags=パキポディウム,ブレビカウレ`）、属単独札は属のみ（`?tags=パキポディウム`）で絞る
 * （#272 follow-up・kako-jun「ブレビカウレ札は パキポディウム ブレビカウレ で絞るはず」＝札は属＋品種の
 * 対。本文 #タグ ボタン〔単一タグ〕クリックとは区別）。本文と同じ正規化（`discoverTagsHref`＝内部空白→`_`）。
 * 学名（catalog.sci → dictionary）が引ければイタリックで併記、無ければ和名のみ（グレースフル）。
 */
export default function FudaList({ fuda }: Props) {
  const t = useT(useLocale());
  if (fuda.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {fuda.map((f) => (
        <li key={f.key} className="min-w-0 max-w-full">
          <a
            // 札を生んだタグ集合（filterTags）で AND 絞り込み（品種札=[属,品種] / 属札=[属]・#272 逆算）。
            href={discoverTagsHref(f.filterTags)}
            title={t("fuda.search.title", { label: f.sci !== null ? `${f.sci}（${f.name}）` : f.name })}
            onClick={(e) => e.stopPropagation()}
            className="glass inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[2px] bg-ha-base/60 px-2.5 py-1 text-sm text-ha-ink shadow-sm shadow-black/25 transition-colors before:-ml-0.5 before:mr-0.5 before:h-3 before:w-1.5 before:shrink-0 before:rounded-full before:bg-ha-green/80 hover:border-ha-green/70 hover:bg-ha-green-soft/80 hover:text-ha-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
          >
            {f.sci !== null && (
              <span className="min-w-0 truncate">
                <SciName sci={f.sci} className="font-display text-ha-green-deep" />
              </span>
            )}
            <span className="min-w-0 truncate font-medium text-ha-ink">{f.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
