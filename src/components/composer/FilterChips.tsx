// 植物写真向けフィルタの選択チップ。重ねがけできるよう各チップをトグルにする。
// 各チップに color のスウォッチ＋name。選択中をハイライト。「なし」は全解除。

import { FILTER_PRESETS, type FilterPreset } from "../../lib/image/presets.ts";

interface FilterChipsProps {
  /** 選択中フィルタ（空配列＝「なし」）。 */
  selected: readonly FilterPreset[];
  /** 選択状態を更新する。 */
  onChange: (presets: FilterPreset[]) => void;
}

export default function FilterChips({ selected, onChange }: FilterChipsProps) {
  function toggle(preset: FilterPreset) {
    const exists = selected.some((item) => item.name === preset.name);
    onChange(exists ? selected.filter((item) => item.name !== preset.name) : [...selected, preset]);
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="フィルタを重ねる">
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={selected.length === 0}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
          selected.length === 0 ? "bg-ha-green text-ha-white" : "glass text-ha-ink hover:border-ha-green/50"
        }`}
      >
        <span className="inline-block w-3 h-3 rounded-full border border-white/25 bg-white/10" aria-hidden="true" />
        なし
      </button>
      {FILTER_PRESETS.map((preset) => {
        const isActive = selected.some((item) => item.name === preset.name);
        return (
          <button
            key={preset.name}
            type="button"
            onClick={() => toggle(preset)}
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
