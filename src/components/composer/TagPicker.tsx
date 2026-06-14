import type { RankedTag } from "../../lib/feed/popular.ts";
import { TAG_CATEGORIES } from "../../lib/plants/tag-catalog.ts";

interface Props {
  /** 人気タグ（relay 集計・上位）。空なら人気セクションは出さない。 */
  popular: RankedTag[];
  /** チップを選んだとき（本文へ挿入する）。 */
  onPick: (tag: string) => void;
}

/** 人気タグの出現回数を 3 段階の文字サイズに割り当てる（タグクラウドの強弱）。 */
function cloudSize(count: number, max: number): string {
  if (max <= 1) return "text-sm";
  const r = count / max;
  if (r > 0.66) return "text-base font-semibold";
  if (r > 0.33) return "text-sm font-medium";
  return "text-xs";
}

function Chip({ label, onClick, sizeClass = "text-sm" }: {
  label: string;
  onClick: () => void;
  sizeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass rounded-full px-3 py-1 ${sizeClass} text-ha-ink hover:border-ha-green/50 hover:text-ha-green-deep transition-colors`}
    >
      #{label}
    </button>
  );
}

/**
 * タグピッカー（#22）。手打ちをやめ、カテゴリ／人気から選んで本文へ入れる。
 * 値は本文に `#タグ` テキストとして入るだけ（DESIGN §6・t 化しない）。
 */
export default function TagPicker({ popular, onPick }: Props) {
  const max = popular.length > 0 ? Math.max(...popular.map((t) => t.count)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-ha-green-deep">タグを選ぶ</span>

      {popular.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-ha-ink/45">人気</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {popular.map((t) => (
              <Chip
                key={`pop-${t.tag}`}
                label={t.tag}
                sizeClass={cloudSize(t.count, max)}
                onClick={() => onPick(t.tag)}
              />
            ))}
          </div>
        </div>
      )}

      {TAG_CATEGORIES.map((cat) => (
        <div key={cat.label} className="flex flex-col gap-1.5">
          <span className="text-xs text-ha-ink/45">{cat.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {cat.tags.map((tag) => (
              <Chip key={`${cat.label}-${tag}`} label={tag} onClick={() => onPick(tag)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
