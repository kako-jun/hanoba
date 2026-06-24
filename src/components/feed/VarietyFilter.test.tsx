import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { buildVarietyIndex, type FudaIndex } from "../../lib/plants/fuda.ts";
import { LocaleProvider } from "../../lib/i18n/index.ts";

// 植物カタログ（最小・PostCard.test.tsx と同形）。カテゴリ「多肉植物」と pickable 属「パキポディウム」に
// loc を付け、#タグ表示ローカライズ（カテゴリ/属→閲覧言語）を検証する。品種「グラキリス」は loc を持たない。
const TEST_CATALOG: VarietyCategory[] = [
  {
    label: "多肉植物",
    loc: { en: "Succulents", zh: "多肉植物", es: "Suculentas" },
    genera: [
      {
        name: "パキポディウム",
        pickable: true,
        loc: { en: "Pachypodium", zh: "棒锤树属", es: "Pachypodium" },
        varieties: [{ name: "グラキリス", sci: "Pachypodium rosulatum var. gracilius" }],
      },
    ],
  },
];

// useFudaIndex は内部で variety-catalog を非同期 import する（非同期ロード待ちが要る）。テストでは
// 固定の FudaIndex（or null）を返すモックにして、ローカライズ挙動だけを同期的に固める（DiscoverGrid.test.tsx
// と同じ「module 境界を vi.mock で止める」流儀）。
let fudaIndex: FudaIndex | null = buildVarietyIndex(TEST_CATALOG);
vi.mock("./useFudaIndex.ts", () => ({
  useFudaIndex: () => fudaIndex,
}));

// TagPicker は子（品種ドリルダウン＋検索＝重いカタログ動的 import・portal）。このテストは選択タグの
// チップと×ボタンに集中するので、TagPicker は何も描かないスタブにする（チップだけを観測する）。
vi.mock("../composer/TagPicker.tsx", () => ({
  default: () => null,
}));

import VarietyFilter from "./VarietyFilter.tsx";

const noop = () => {};

// locale を与えて VarietyFilter を描く（PostCard.test.tsx の LocaleProvider 流儀）。
function renderFilter(locale: "ja" | "en", props: { tags: string[]; onChange?: (tags: string[]) => void }) {
  return render(
    <LocaleProvider value={locale}>
      <VarietyFilter tags={props.tags} onChange={props.onChange ?? noop} />
    </LocaleProvider>,
  );
}

describe("VarietyFilter ローカライズ（#464・表示は訳す／remove は ja 正準で通す）", () => {
  afterEach(() => {
    cleanup();
    // 各テストで index 状態を既定（ロード済み）へ戻す。
    fudaIndex = buildVarietyIndex(TEST_CATALOG);
  });

  it("en ではカテゴリチップの表示を loc.en に訳す（#塊根→Succulents 系・#460）", () => {
    renderFilter("en", { tags: ["多肉植物"] });
    // 表示は英語。ja 原典の表示は en では出ない。
    expect(screen.getByText("#Succulents")).toBeInTheDocument();
    expect(screen.queryByText("#多肉植物")).toBeNull();
  });

  it("en では pickable 属チップの表示も loc.en に訳す", () => {
    renderFilter("en", { tags: ["パキポディウム"] });
    expect(screen.getByText("#Pachypodium")).toBeInTheDocument();
    expect(screen.queryByText("#パキポディウム")).toBeNull();
  });

  it("ja では同じタグを raw（原典）で表示する", () => {
    renderFilter("ja", { tags: ["多肉植物"] });
    expect(screen.getByText("#多肉植物")).toBeInTheDocument();
  });

  it("品種・自由タグ（hashtagLoc に無い語）は en でも ja のまま据え置く", () => {
    // グラキリス=品種（loc 無し）／板付け=辞書外の自由タグ。どちらも訳さず原典のまま出す。
    renderFilter("en", { tags: ["グラキリス", "板付け"] });
    expect(screen.getByText("#グラキリス")).toBeInTheDocument();
    expect(screen.getByText("#板付け")).toBeInTheDocument();
  });

  it("削除（×）は localize 後の表示でなく raw ja タグを除いた配列で onChange を呼ぶ（最重要の不変条件）", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // en で「多肉植物」と「板付け」を絞り込み中。多肉植物の表示は Succulents だが、外す値は ja 正準。
    renderFilter("en", { tags: ["多肉植物", "板付け"], onChange });
    // aria-label も localize 値（Succulents）で出る＝可視と読み上げが揃う（U+201C/U+201D の弧引用符）。
    const removeBtn = screen.getByRole("button", { name: "Remove “Succulents”" });
    await user.click(removeBtn);
    // onChange に渡るのは raw「多肉植物」を除いた配列（"Succulents" ではない）。
    // ＝言語を跨いでも同じ #タグで繋がる cross-language filter を壊さない（#409/#460/#464）。
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["板付け"]);
  });

  it("index 未ロード（null）でも raw #tag を素で出す（crash しない・グレースフル）", () => {
    fudaIndex = null;
    renderFilter("en", { tags: ["多肉植物"] });
    // 索引が無いので localize できず原典のまま。例外も投げない。
    expect(screen.getByText("#多肉植物")).toBeInTheDocument();
  });

  it("削除ボタンの aria-label が可視チップの表示（localize 値）と一致する", () => {
    renderFilter("en", { tags: ["パキポディウム"] });
    // 可視は #Pachypodium・読み上げも Pachypodium で揃う。
    expect(screen.getByText("#Pachypodium")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove “Pachypodium”" })).toBeInTheDocument();
  });
});
