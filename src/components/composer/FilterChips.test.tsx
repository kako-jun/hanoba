import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FilterChips from "./FilterChips.tsx";
import { FILTER_PRESETS, type SelectedFilter } from "../../lib/image/presets.ts";

afterEach(cleanup);

/** 制御コンポーネントを onChange でラップして state を回す簡易ハーネス。 */
function Harness({ onChangeSpy }: { onChangeSpy?: (s: SelectedFilter[]) => void }) {
  const [selected, setSelected] = useState<SelectedFilter[]>([]);
  return (
    <FilterChips
      selected={selected}
      onChange={(next) => {
        onChangeSpy?.(next);
        setSelected(next);
      }}
    />
  );
}

const FIRST = FILTER_PRESETS[0]!.name; // 淡陽

describe("FilterChips", () => {
  it("初期はすべて なし（チップは strength=0）", () => {
    render(<FilterChips selected={[]} onChange={() => {}} />);
    const chip = screen.getByRole("button", { name: new RegExp(`${FIRST}（なし）`) });
    expect(chip).toHaveAttribute("data-strength", "0");
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).toHaveAttribute("aria-valuetext", "なし");
  });

  it("連打で なし→弱→中→強→なし と巡回し onChange が SelectedFilter[] を返す", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChangeSpy={onChange} />);

    const chipName = () => screen.getByRole("button", { name: new RegExp(FIRST) });

    await user.click(chipName()); // なし→弱
    expect(onChange).toHaveBeenLastCalledWith([{ name: FIRST, strength: 1 }]);

    await user.click(chipName()); // 弱→中
    expect(onChange).toHaveBeenLastCalledWith([{ name: FIRST, strength: 2 }]);

    await user.click(chipName()); // 中→強
    expect(onChange).toHaveBeenLastCalledWith([{ name: FIRST, strength: 3 }]);

    await user.click(chipName()); // 強→なし（削除）
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("強度を data-strength / aria-valuetext で可視化する", () => {
    render(<FilterChips selected={[{ name: FIRST, strength: 2 }]} onChange={() => {}} />);
    const chip = screen.getByRole("button", { name: new RegExp(`${FIRST}（中）`) });
    expect(chip).toHaveAttribute("data-strength", "2");
    expect(chip).toHaveAttribute("aria-valuetext", "中");
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("塗り（fill）の幅が strength/3 を反映する", () => {
    render(<FilterChips selected={[{ name: FIRST, strength: 1 }]} onChange={() => {}} />);
    const chip = screen.getByRole("button", { name: new RegExp(`${FIRST}（弱）`) });
    const fill = chip.querySelector("span[aria-hidden='true']") as HTMLElement;
    // 最初の aria-hidden span が塗り（strength=1 → 33.33%）。
    expect(fill.style.width).toBe(`${(1 / 3) * 100}%`);

    cleanup();
    render(<FilterChips selected={[{ name: FIRST, strength: 3 }]} onChange={() => {}} />);
    const chip3 = screen.getByRole("button", { name: new RegExp(`${FIRST}（強）`) });
    const fill3 = chip3.querySelector("span[aria-hidden='true']") as HTMLElement;
    expect(fill3.style.width).toBe("100%");
  });

  it("「なし」ボタンで全解除する", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FilterChips selected={[{ name: FIRST, strength: 2 }]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "なし" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("複数チップを独立に強度トグルできる", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const second = FILTER_PRESETS[3]!.name; // 美華
    render(<FilterChips selected={[{ name: FIRST, strength: 2 }]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: new RegExp(second) }));
    // 既存の淡陽中は保持し、美華を弱で追加する。
    expect(onChange).toHaveBeenCalledWith([
      { name: FIRST, strength: 2 },
      { name: second, strength: 1 },
    ]);
  });
});
