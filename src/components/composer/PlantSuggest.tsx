import { insertTag } from "../../lib/image/hashtag-complete.ts";
import { detectPlants } from "../../lib/plants/detect.ts";

interface Props {
  /** 現在の一言（本文）。ここから植物を認識する。 */
  caption: string;
  /** 正規タグを足すとき（本文へ挿入）。 */
  onAddTag: (tag: string) => void;
}

/**
 * 正規形ピッカー（#23 Phase 2）。
 * 作文中に書いた俗称/カナ/英/略（例「パキポ」）を認識し、その植物の**正規形**
 * （最も有名な表記＝`name`）のタグをワンタップで足せる。学名も併記して迷いを消す。
 * これで表記ゆれの新規発生を抑える（投稿は不変なので入口で揃える）。
 *
 * 既に正規タグが付いている植物は出さない（insertTag が変化させない＝既存と判定）。
 */
export default function PlantSuggest({ caption, onAddTag }: Props) {
  const plants = detectPlants(caption).filter((p) => insertTag(caption, p.name) !== caption);
  if (plants.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-ha-ink/45">植物のタグを正規形でそろえる</span>
      <div className="flex flex-wrap gap-1.5">
        {plants.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onAddTag(p.name)}
            title={`${p.sci}（${p.name}）のタグを足す`}
            className="glass inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 text-sm text-ha-ink hover:border-ha-green/50 transition-colors"
          >
            <span className="text-ha-green-deep font-semibold">＋ #{p.name}</span>
            <span className="font-display italic text-ha-ink/55">{p.sci}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
