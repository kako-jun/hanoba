import { insertTag } from "../../lib/image/hashtag-complete.ts";
import type { PlantEntry } from "../../lib/plants/dictionary.ts";
import { detectPlants } from "../../lib/plants/detect.ts";
import { childrenOf } from "../../lib/plants/search.ts";

interface Props {
  /** 現在の一言（本文）。ここから植物を認識する。 */
  caption: string;
  /** 正規タグを足すとき（本文へ挿入）。 */
  onAddTag: (tag: string) => void;
}

/**
 * 正規形ピッカー＋多段ドリルダウン（#23 Phase 2 / #63）。
 *
 * 作文中に書いた俗称/カナ/英/略（例「パキポ」）を認識し、その植物の**正規形**
 * （`name`）のタグをワンタップで足せる。学名も併記して迷いを消す。
 * さらに、属（例: パキポディウム）には「**もっと具体的に**」として子（種/品種＝
 * グラキリス等）を出し、辿って具体化できる（属タグと具体タグは併存可）。
 *
 * 既に付いているタグは出さない（insertTag が変化させない＝既存と判定）。
 */
export default function PlantSuggest({ caption, onAddTag }: Props) {
  const notTagged = (p: PlantEntry) => insertTag(caption, p.name) !== caption;

  // 認識した植物ごとに、未付与の本体チップ＋未付与の子（もっと具体的に）をまとめる。
  const groups = detectPlants(caption)
    .map((plant) => ({ plant, self: notTagged(plant), children: childrenOf(plant.id).filter(notTagged) }))
    .filter((g) => g.self || g.children.length > 0);
  if (groups.length === 0) return null;

  function Chip({ entry }: { entry: PlantEntry }) {
    return (
      <button
        type="button"
        onClick={() => onAddTag(entry.name)}
        title={`${entry.sci}（${entry.name}）のタグを足す`}
        className="glass inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 transition-colors"
      >
        <span className="text-ha-green-deep font-semibold">＋ #{entry.name}</span>
        <span className="font-display italic text-ha-ink/55">{entry.sci}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-ha-ink/45">植物のタグを正規形でそろえる</span>
      <div className="flex flex-col gap-2">
        {groups.map((g) => (
          <div key={g.plant.id} className="flex flex-col gap-1.5">
            {g.self && (
              <div className="flex flex-wrap gap-1.5">
                <Chip entry={g.plant} />
              </div>
            )}
            {g.children.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-ha-ink/45">もっと具体的に</span>
                {g.children.map((c) => (
                  <Chip key={c.id} entry={c} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
