// 植物写真向けフィルタの選択チップ（#171）。各効果を なし/弱/中/強 の4段トグルにする。
// クリックのたびに なし→弱→中→強→なし で巡回し、横長チップを3段階に塗りつぶして強度を見せる。
// 各チップに color のスウォッチ＋name。「なし」は全解除。

import { FILTER_PRESETS, type FilterPreset, type FilterStrength, type SelectedFilter } from "../../lib/image/presets.ts";

interface FilterChipsProps {
  /** 選択中フィルタ（空配列＝「なし」）。各要素が name＋strength を持つ。 */
  selected: readonly SelectedFilter[];
  /** 選択状態を更新する。 */
  onChange: (selected: SelectedFilter[]) => void;
}

const STRENGTH_LABEL: Record<0 | FilterStrength, string> = { 0: "なし", 1: "弱", 2: "中", 3: "強" };

export default function FilterChips({ selected, onChange }: FilterChipsProps) {
  const chipClass =
    "relative flex w-[5.25rem] items-center justify-center gap-1.5 overflow-hidden rounded-full px-2.5 py-1.5 text-sm transition-colors";

  /** 現在の強度（0=なし）。 */
  function strengthOf(preset: FilterPreset): 0 | FilterStrength {
    return selected.find((item) => item.name === preset.name)?.strength ?? 0;
  }

  /** なし→弱→中→強→なし で巡回する。 */
  function cycle(preset: FilterPreset) {
    const current = strengthOf(preset);
    const next = ((current + 1) % 4) as 0 | FilterStrength;
    const without = selected.filter((item) => item.name !== preset.name);
    onChange(next === 0 ? without : [...without, { name: preset.name, strength: next }]);
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="フィルタを重ねる">
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={selected.length === 0}
        className={`${chipClass} ${
          selected.length === 0 ? "bg-ha-green text-ha-white" : "glass text-ha-ink hover:border-ha-green/50"
        }`}
      >
        <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/25 bg-white/10" aria-hidden="true" />
        なし
      </button>
      {FILTER_PRESETS.map((preset) => {
        const strength = strengthOf(preset);
        const isActive = strength > 0;
        return (
          <button
            key={preset.name}
            type="button"
            onClick={() => cycle(preset)}
            aria-pressed={isActive}
            aria-label={`${preset.name}（${STRENGTH_LABEL[strength]}）`}
            aria-valuetext={STRENGTH_LABEL[strength]}
            data-strength={strength}
            className={`${chipClass} ${
              isActive ? "bg-ha-green/15 text-ha-ink border border-ha-green/40" : "glass text-ha-ink hover:border-ha-green/50"
            }`}
          >
            {/* 横長チップを strength/3 の割合で塗りつぶして強度を可視化する（3段階の塗り）。 */}
            {strength > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 bg-ha-green/35"
                style={{ width: `${(strength / 3) * 100}%` }}
              />
            )}
            <span
              className="relative inline-block h-3 w-3 shrink-0 rounded-full border border-white/25"
              style={{ backgroundColor: preset.color }}
              aria-hidden="true"
            />
            <span className="relative">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
}
