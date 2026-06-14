// レトロ加工フィルタの選択チップ（DESIGN §3: ガチャでなく選択式）。
// 各チップに color のスウォッチ＋name。選択中をハイライト。「なし」も選べる。

import { FILTER_PRESETS, type FilterPreset } from "../../lib/image/presets.ts";

interface FilterChipsProps {
  /** 選択中フィルタ（未選択＝「なし」は null）。 */
  selected: FilterPreset | null;
  /** チップを選んだとき（「なし」は null）。 */
  onSelect: (preset: FilterPreset | null) => void;
}

export default function FilterChips({ selected, onSelect }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="フィルタを選ぶ">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selected === null}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
          selected === null ? "bg-ha-green text-ha-white" : "glass text-ha-ink hover:border-ha-green/50"
        }`}
      >
        <span className="inline-block w-3 h-3 rounded-full border border-white/25 bg-white/10" aria-hidden="true" />
        なし
      </button>
      {FILTER_PRESETS.map((preset) => {
        const isActive = selected?.name === preset.name;
        return (
          <button
            key={preset.name}
            type="button"
            onClick={() => onSelect(preset)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
              isActive ? "bg-ha-green text-ha-white" : "glass text-ha-ink hover:border-ha-green/50"
            }`}
          >
            <span
              className="inline-block w-3 h-3 rounded-full border border-white/25"
              style={{ backgroundColor: preset.color }}
              aria-hidden="true"
            />
            {preset.name}
          </button>
        );
      })}
    </div>
  );
}
