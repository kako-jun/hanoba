import { describe, expect, it } from "vitest";
import { moveById } from "./reorder.ts";

type Item = { id: string; tag?: string };

function ids(items: readonly Item[]): string[] {
  return items.map((i) => i.id);
}

describe("moveById", () => {
  const base: Item[] = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

  it("右へ（+1）: 対象が 1 つ後ろへ動く", () => {
    expect(ids(moveById(base, "b", +1))).toEqual(["a", "c", "b", "d"]);
  });

  it("左へ（-1）: 対象が 1 つ前へ動く", () => {
    expect(ids(moveById(base, "c", -1))).toEqual(["a", "c", "b", "d"]);
  });

  it("先頭を右へ＝先頭がカバーから外れる", () => {
    expect(ids(moveById(base, "a", +1))).toEqual(["b", "a", "c", "d"]);
  });

  it("末尾を左へ", () => {
    expect(ids(moveById(base, "d", -1))).toEqual(["a", "b", "d", "c"]);
  });

  it("先頭をさらに左は no-op（範囲外クランプ）", () => {
    expect(ids(moveById(base, "a", -1))).toEqual(["a", "b", "c", "d"]);
  });

  it("末尾をさらに右は no-op（範囲外クランプ）", () => {
    expect(ids(moveById(base, "d", +1))).toEqual(["a", "b", "c", "d"]);
  });

  it("存在しない id は no-op", () => {
    expect(ids(moveById(base, "zzz", +1))).toEqual(["a", "b", "c", "d"]);
  });

  it("delta 0 は no-op", () => {
    expect(ids(moveById(base, "b", 0))).toEqual(["a", "b", "c", "d"]);
  });

  it("|delta|>1 は target index をクランプして動く（末尾まで）", () => {
    expect(ids(moveById(base, "a", +99))).toEqual(["b", "c", "d", "a"]);
  });

  it("|delta|>1 は target index をクランプして動く（先頭まで）", () => {
    expect(ids(moveById(base, "d", -99))).toEqual(["d", "a", "b", "c"]);
  });

  it("常に新しい配列を返す（no-op でも参照は別）", () => {
    const result = moveById(base, "a", -1); // no-op ケース
    expect(result).not.toBe(base);
    expect(result).toEqual(base);
  });

  it("元配列を変更しない（非破壊）", () => {
    const snapshot = ids(base);
    moveById(base, "b", +1);
    expect(ids(base)).toEqual(snapshot);
  });

  it("crop/filters 相当の付随プロパティは要素ごと一緒に動く", () => {
    const withTags: Item[] = [
      { id: "a", tag: "A" },
      { id: "b", tag: "B" },
      { id: "c", tag: "C" },
    ];
    const moved = moveById(withTags, "a", +1);
    expect(moved).toEqual([
      { id: "b", tag: "B" },
      { id: "a", tag: "A" },
      { id: "c", tag: "C" },
    ]);
  });

  it("1 要素・空配列でも壊れない（no-op）", () => {
    expect(ids(moveById([{ id: "x" }], "x", +1))).toEqual(["x"]);
    expect(ids(moveById([], "x", +1))).toEqual([]);
  });
});
