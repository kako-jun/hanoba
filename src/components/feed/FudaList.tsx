import type { Fuda } from "../../lib/plants/fuda.ts";
import { discoverTagHref } from "../../lib/feed/discoverFilter.ts";
import SciName from "../ui/SciName.tsx";

interface Props {
  /** 投稿の札（学名＋和名・buildFuda の結果）。空なら呼び出し側で出し分ける。 */
  fuda: Fuda[];
}

/**
 * 投稿の植物札（#182/#23）をチップで並べる共有 UI。PostDetail（拡大モーダル）と PostCard
 * （タイムラインのカード右端）で同じ見た目・同じ挙動を使う（#239・kako-jun blink）。
 *
 * 各札はその植物の **discover 絞り込みリンク**（`/discover?tags=<和名>`）。クリックすると
 * その品種で絞り込まれた discover 画面になる（札＝その植物のタグでフィルタ）。本文と同じ正規化
 * （`discoverTagHref`＝内部空白→`_`）で、複数語の品種名でも投稿のタグと一致する。
 * 学名（catalog.sci → dictionary）が引ければイタリックで併記、無ければ和名のみ（グレースフル）。
 */
export default function FudaList({ fuda }: Props) {
  if (fuda.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {fuda.map((f) => (
        <li key={f.key} className="min-w-0 max-w-full">
          <a
            href={discoverTagHref(f.name)}
            title={`${f.sci !== null ? `${f.sci}（${f.name}）` : f.name}で探す`}
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
