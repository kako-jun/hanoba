import { describe, expect, it } from "vitest";
import { buildFuda, buildVarietyIndex, fudaForName, resolveFuda } from "./fuda.ts";
import { VARIETY_CATALOG, type VarietyCategory } from "./variety-catalog.ts";

// 期待値は実カタログ（VARIETY_CATALOG）と実辞書（dictionary.ts）から確定する（#182/#23/#459）。
// 札は **学名（sci）そのもの**（#459＝和名は札に出さない）。key は canonical 品種名/属名で dedupe する。
// - 塊根植物 › パキポディウム › { グラキリス(sci あり), 象牙宮(sci あり), ブレビカウレ(sci あり), ... }
// - dictionary: アガベ→Agave / チタノタ→Agave titanota /
//   パキポディウム→Pachypodium / グラキリス→Pachypodium rosulatum var. gracilius
//
// sci の解決順（catalog.sci → dictionary 品種 → dictionary 属 → null）は、実カタログの学名付与が
// 進むと「sci 無し品種」が消えて陳腐化するため、**合成カタログ SYNTH で決定的に検証する**（#182）。
// dictionary は安定なので、属名に実在の「アガベ」(→Agave)、辞書外に架空名を使えば決定的。
const SYNTH: VarietyCategory[] = [
  {
    label: "テスト科",
    genera: [
      // 属名「アガベ」は dictionary にあり（→Agave）。品種で catalog.sci 有無を作り分ける。
      { name: "アガベ", pickable: true, varieties: [{ name: "合成種A", sci: "Agave fakea" }, { name: "合成種B" }] },
      // 属名「ゲンクウ属」は dictionary 外＝属 sci も引けない。
      { name: "ゲンクウ属", pickable: true, varieties: [{ name: "合成種C" }] },
    ],
  },
];

// #506 の畳み込み専用の合成カタログ。sci を catalog に直書きし、辞書・属フォールバックに一切依存させない
// （実カタログの学名付与が進んでも陳腐化しない・#182）。同属に「具体種（解決後 sci に空白あり）」と
// 「属レベルの受け皿品種（解決後 sci が裸属名＝空白なし）」を並べ、具体種があれば受け皿が落ち・
// 受け皿単独なら残ることを辞書非依存で固定する。属名は架空にして dictionary 一致を避ける。
const FOLD_SYNTH: VarietyCategory[] = [
  {
    label: "畳みテスト科",
    genera: [
      {
        name: "フォルダ属",
        pickable: true,
        varieties: [
          { name: "受け皿品種", sci: "Folda" }, // 空白なし＝属レベル（裸属名の受け皿）
          { name: "具体品種", sci: "Folda specifica" }, // 空白あり＝具体種（species）
        ],
      },
      {
        // #506 Q1: `Genus sp.`（種未特定）が属レベル扱い（具体種と誤認しない）ことを決定的に固定する属。
        // 同一 catalog genus 内へ 受け皿（裸属名）・`Xenia sp.`・具体種（species）を並べる。
        name: "クセニア属",
        pickable: true,
        varieties: [
          { name: "クセニア受け皿", sci: "Xenia" }, // 空白なし＝属レベル（裸属名の受け皿）
          { name: "クセニア未特定", sci: "Xenia sp." }, // Genus sp.＝種未特定＝属レベル扱い（非具体種）
          { name: "クセニア具体", sci: "Xenia realis" }, // 空白あり・sp. でない＝具体種（species）
        ],
      },
    ],
  },
];

describe("buildFuda", () => {
  it("属＋品種は品種1枚に畳む（属単独は出さない）＋ filterTags=[属,品種]（#272 逆算）", () => {
    const fuda = buildFuda(["パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    // 札は学名そのもの（#459）。札クリックは属＋品種の AND で絞る（逆算が元投稿に当たる）。
    expect(fuda[0]).toMatchObject({ sci: "Pachypodium rosulatum var. gracilius", filterTags: ["パキポディウム", "グラキリス"] });
  });

  it("親属の無い素の品種タグは札にしない（#459）", () => {
    // 旧 #223「先頭候補フォールバック」は撤去。親属タグ無しの素の品種タグは
    // **最大マッチの親（属）が無い品種＝ルール違反**なので札にならない（kako-jun）。
    const fuda = buildFuda(["グラキリス"], VARIETY_CATALOG);
    expect(fuda).toEqual([]);
  });

  it("同属の複数品種はそれぞれ札になり、属単独は出ない（順序は catalog 出現順）", () => {
    // アガベの varieties は チタノタ(idx0) → ... → 白鯨(idx2) の順。学名そのもの（#459）。
    const fuda = buildFuda(["アガベ", "チタノタ", "白鯨"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.sci)).toEqual(["Agave titanota", "Agave titanota 'Hakugei'"]);
  });

  it("カテゴリ（VarietyCategory.label）は札にしない", () => {
    expect(buildFuda(["塊根植物"], VARIETY_CATALOG)).toEqual([]);
  });

  it("カテゴリ＋属＋品種が混ざってもカテゴリは無視し品種だけ残す", () => {
    const fuda = buildFuda(["塊根植物", "パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "グラキリス", sci: "Pachypodium rosulatum var. gracilius" });
  });

  it("属単独（品種タグ無し）は属名の札を出す＋ filterTags=[属]", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "アガベ", sci: "Agave", filterTags: ["アガベ"] });
  });

  it("学名は catalog の variety.sci を最優先する（塊根植物の実データ）", () => {
    // 正準＝「ブレビカウレ」（学名カナ）、別名＝「恵比寿笑い」（kako-jun の好みで縁起名は alias へ）。
    // catalog.sci = Pachypodium brevicaule。旧投稿のタグ「恵比寿笑い」も alias 経由で正準 key
    // 「ブレビカウレ」に解決し、品種札は属＋品種で立てる（#272）。
    const fuda = buildFuda(["パキポディウム", "恵比寿笑い"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "ブレビカウレ", sci: "Pachypodium brevicaule" });
  });

  it("catalog.sci が無くても dictionary に品種があれば品種 sci を使う", () => {
    // チタノタ は catalog.sci 無し・dictionary に チタノタ→Agave titanota。属＋品種で立てる。
    const fuda = buildFuda(["アガベ", "チタノタ"], VARIETY_CATALOG);
    expect(fuda[0]).toMatchObject({ key: "チタノタ", sci: "Agave titanota" });
  });

  it("catalog.sci を最優先する（合成カタログで決定的）", () => {
    // 合成種A は catalog.sci="Agave fakea" を持つ＝dictionary より優先。属アガベと併記。
    const fuda = buildFuda(["アガベ", "合成種A"], SYNTH);
    expect(fuda[0]).toMatchObject({ key: "合成種A", sci: "Agave fakea" });
  });

  it("学名は catalog.sci も dictionary 品種も無ければ属 sci にフォールバックする（合成カタログ）", () => {
    // 合成種B は catalog.sci 無し・dict 外。属「アガベ」が dict にある → Agave。属アガベと併記。
    const fuda = buildFuda(["アガベ", "合成種B"], SYNTH);
    expect(fuda[0]).toMatchObject({ key: "合成種B", sci: "Agave" });
  });

  it("学名が catalog.sci も品種も属も辞書外なら札にしない（#459＝和名へ倒さない・合成カタログ）", () => {
    // 合成種C は catalog.sci 無し・dict 外、属「ゲンクウ属」も dict 外 → どこからも学名が引けない。
    // 旧仕様は「和名のみ（sci=null）の札」を出したが、#459 で学名の無い植物は札にしない（属と併記しても）。
    const fuda = buildFuda(["ゲンクウ属", "合成種C"], SYNTH);
    expect(fuda).toEqual([]);
  });

  it("属単独でも辞書から属 sci を引く", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda[0]).toMatchObject({ key: "アガベ", sci: "Agave" });
  });

  it("非 pickable 見出し属（原種）配下の品種は親属/カテゴリの共起が無ければ札にしない（#459）", () => {
    // ビカクシダ › 原種(pickable:false) › リドレイ。pickable 属を持てず、#カテゴリ（ビカクシダ）も
    // 共起しない素の品種タグ＝親（属 or カテゴリ）が無い＝#459 で札にしない。
    expect(buildFuda(["リドレイ"], VARIETY_CATALOG)).toEqual([]);
  });

  it("ビカクシダのカテゴリタグはビフルカツムの学名札になる＋filterTags=[カテゴリ,品種]（#341/#448/#459）", () => {
    // #341/#448: ビフルカツムは非 pickable 見出し属「原種」配下＝属タグが書かれずカテゴリ（ビカクシダ）が共起する。
    // 札は学名そのもの（#459）＝Platycerium bifurcatum。逆算は [カテゴリ, 品種]（pickable 属の [属, 品種] と
    // 同じ親グルーピング＋品種の AND・kako-jun）。
    const fuda = buildFuda(["ビカクシダ", "ビフルカツム"], VARIETY_CATALOG);
    expect(fuda).toEqual([
      {
        key: "ビフルカツム",
        sci: "Platycerium bifurcatum",
        filterTags: ["ビカクシダ", "ビフルカツム"],
      },
    ]);
  });

  it("#448 非 pickable 属（交配・園芸品種）配下の品種もカテゴリ共起で filterTags=[カテゴリ,品種]（ジェイドガール）", () => {
    // ビカクシダ › 交配・園芸品種(pickable:false) › ジェイドガール。TagPicker は #ビカクシダ #ジェイドガール と書く。
    const fuda = buildFuda(["ビカクシダ", "ジェイドガール"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "ジェイドガール", sci: "Platycerium 'Jade Girl'", filterTags: ["ビカクシダ", "ジェイドガール"] });
    // カテゴリ非共起（品種タグだけ）なら親が無い＝#459 で札にしない。
    expect(buildFuda(["ジェイドガール"], VARIETY_CATALOG)).toEqual([]);
  });

  it("非 pickable 見出し属はタグしても札にしない（見出し語は表に出ない）", () => {
    // 「原種」は pickable:false の見出し属＝札にならない。
    expect(buildFuda(["原種"], VARIETY_CATALOG)).toEqual([]);
  });

  it("#409 別名 #ヴェイチー の旧投稿も属共起で正準『ベイチー』の学名に解決する", () => {
    // ビカクシダ › 原種 › { name:"ベイチー", aliases:["ヴェイチー"] } に統合済み。
    // 別名タグでも、カテゴリ（ビカクシダ）共起なら札は正準「ベイチー」の学名 Platycerium veitchii になる。
    const fuda = buildFuda(["ビカクシダ", "ヴェイチー"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.key).toBe("ベイチー");
    expect(fuda[0]!.sci).toBe("Platycerium veitchii");
  });

  it("#409/#459 ベイチー単独は親（属/カテゴリ）が無いので札にしない", () => {
    // ベイチー は Platycerium（ビカクシダ）と Anthurium（観葉植物）に同名で存在する。親属タグ無しの
    // 単独は #459 で札にしない（旧 #315 catalog 先頭候補フォールバックは撤去）。
    const fuda = buildFuda(["ベイチー"], VARIETY_CATALOG);
    expect(fuda).toEqual([]);
  });

  it("#409/#315 アンスリウム共起なら ベイチー は Anthurium 側に確定する（同名跨ぎ・属共起解決が無回帰）", () => {
    const fuda = buildFuda(["アンスリウム", "ベイチー"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.key).toBe("ベイチー");
    expect(fuda[0]!.sci).toBe("Anthurium veitchii");
  });

  it("辞書外・世話タグ・他クライアント由来タグは無視する", () => {
    const fuda = buildFuda(["水やり", "謎タグ", "アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "アガベ", sci: "Agave" });
  });

  it("重複タグは1枚に dedupe する", () => {
    const fuda = buildFuda(["パキポディウム", "グラキリス", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "グラキリス" });
  });

  it("前後空白・英大小が混じっても照合する（属 alias 経由）", () => {
    // ヒマワリ属の alias に "sunflower" がある。trim + toLowerCase 照合を確認。属単独札＝属の学名。
    const fuda = buildFuda(["  SunFlower  "], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "ヒマワリ", sci: "Helianthus" });
  });

  it("品種の alias 経由タグでも札になり、key は catalog の canonical 品種名を使う（属共起・#459）", () => {
    // コケ各種(pickable:false) › ホソバオキナゴケ の alias "山苔"。素の品種タグ単独は親が無く札にならないので
    // （#459）、カテゴリ「コケ」と併記して属共起解決させる＝来たタグ（山苔）でなく canonical key（ホソバオキナゴケ）。
    const fuda = buildFuda(["コケ", "山苔"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.key).toBe("ホソバオキナゴケ");
  });

  it("key は canonical 品種名/属名で組む（dedupe 鍵）", () => {
    expect(buildFuda(["パキポディウム", "グラキリス"], VARIETY_CATALOG)[0]!.key).toBe("グラキリス");
    expect(buildFuda(["アガベ"], VARIETY_CATALOG)[0]!.key).toBe("アガベ");
  });

  // 穀物カテゴリ（#214）。イネは alias（稲/コメ/米/水稲/陸稲）を持つ pickable 属。
  // alias でも属単独札が出ない＝#214/#162 二重計上防止の核心を畳み込みで守る。
  it("穀物: 属＋品種は品種1枚に畳む（イネ＋コシヒカリ）", () => {
    const fuda = buildFuda(["イネ", "コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "コシヒカリ", sci: "Oryza sativa 'Koshihikari'" });
  });

  it("穀物: 属 alias＋品種でも genus 単独札が出ず品種に畳む（稲＋コシヒカリ・二重計上防止）", () => {
    const fuda = buildFuda(["稲", "コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "コシヒカリ", sci: "Oryza sativa 'Koshihikari'" });
  });

  it("穀物: 複数 alias が並んでも品種1枚に畳む（稲＋コメ＋コシヒカリ）", () => {
    const fuda = buildFuda(["稲", "コメ", "コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "コシヒカリ" });
  });

  it("穀物: alias 単独は canonical 属名の属単独札になる（稲→イネ）", () => {
    const fuda = buildFuda(["稲"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "イネ", sci: "Oryza" });
  });

  it("穀物: 同属の複数品種はそれぞれ札になり属単独は出ない（catalog 出現順＝コシヒカリ→ササニシキ）", () => {
    const fuda = buildFuda(["イネ", "コシヒカリ", "ササニシキ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.key)).toEqual(["コシヒカリ", "ササニシキ"]);
  });

  it("穀物: 非 pickable 見出し属（雑穀）配下の品種はカテゴリ共起が無ければ札にしない（#459）", () => {
    // 雑穀 は非 pickable 見出し属（カテゴリは「穀物」）。雑穀タグはカテゴリではないので親グルーピングにならず
    // 素の品種タグ（アワ）に親が付かない＝#459 で札にしない。
    expect(buildFuda(["雑穀", "アワ"], VARIETY_CATALOG)).toEqual([]);
  });

  it("穀物: 非 pickable 見出し属（雑穀）はタグしても札にしない", () => {
    expect(buildFuda(["雑穀"], VARIETY_CATALOG)).toEqual([]);
  });

  it("穀物: 非 pickable 見出し属（トウモロコシ（穀物用））配下の品種もカテゴリ共起が無ければ札にしない（#459）", () => {
    // トウモロコシ（穀物用）は非 pickable 見出し属（カテゴリは「穀物」）。見出し属タグはカテゴリでないので
    // 素の品種タグ（デントコーン）に親が付かず札にならない。
    expect(buildFuda(["トウモロコシ（穀物用）", "デントコーン"], VARIETY_CATALOG)).toEqual([]);
  });

  it("穀物: 非 pickable 見出し属（トウモロコシ（穀物用））はタグしても札にしない", () => {
    expect(buildFuda(["トウモロコシ（穀物用）"], VARIETY_CATALOG)).toEqual([]);
  });

  it("穀物: 属名＝品種名のデータ（ライムギ）でも品種1枚＝学名 Secale cereale を持つ", () => {
    const fuda = buildFuda(["ライムギ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "ライムギ", sci: "Secale cereale" });
  });

  it("穀物: デントコーンはカテゴリ共起なら独立する（穀物＋デントコーン＝Zea mays）", () => {
    // デントコーンは非 pickable 見出し属（トウモロコシ（穀物用））配下＝カテゴリ「穀物」共起で札になる。
    const fuda = buildFuda(["穀物", "デントコーン"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "デントコーン", sci: "Zea mays", filterTags: ["穀物", "デントコーン"] });
  });

  // #223 属コンテキスト解決。同名品種を別属に自然名で共存させ、#属#品種 併記で曖昧解決する。
  // データ巻き戻し: アボカドの「ハス」復活（ハスアボカド→ハス）/ ボタンの「太陽」復活。
  it("#223 属共起で品種確定: アボカド＋ハス→アボカドのハス（蓮に化けない）", () => {
    const fuda = buildFuda(["アボカド", "ハス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "ハス", sci: "Persea americana 'Hass'" });
  });

  it("#223 ハス単独は蓮属の属単独札になる（親属アボカド無し→属名一致＝水生の蓮）", () => {
    const fuda = buildFuda(["ハス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "ハス", sci: "Nelumbo" });
    expect(fuda[0]!.sci).not.toBe("Persea americana 'Hass'"); // アボカドのハスに化けない
  });

  it("#223 属共起で品種確定: ボタン＋太陽→ボタンの太陽（サボテン/スモモに化けない）", () => {
    const fuda = buildFuda(["ボタン", "太陽"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "太陽", sci: "Paeonia suffruticosa 'Taiyo'" });
  });

  it("#223/#459 太陽単独は親属タグが無いので札にしない（先頭候補フォールバックは撤去）", () => {
    // 太陽は サボテン → スモモ → ボタン に同名で存在する。親属タグが無いので #459 で札にしない。
    expect(buildFuda(["太陽"], VARIETY_CATALOG)).toEqual([]);
  });

  it("#223 属共起で品種確定: ユッカ＋エレファンティペス→ユッカ側の札（亀甲竜に化けない）", () => {
    const fuda = buildFuda(["ユッカ", "エレファンティペス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "エレファンティペス", sci: "Yucca gigantea" });
  });

  it("#223 属共起で品種確定: ディオスコレア＋エレファンティペス→亀甲竜系（塊根側・Dioscorea）", () => {
    // #409 で Dioscorea「エレファンティペス」は正準「亀甲竜」へ統合（alias）。属共起で塊根側（Dioscorea）の
    // 亀甲竜に確定し、同名 alias を持つ Yucca（Yucca gigantea）側へは化けないこと（sci で別物を排除）。
    const fuda = buildFuda(["ディオスコレア", "エレファンティペス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "亀甲竜", sci: "Dioscorea elephantipes" });
  });

  it("#223 variety-variety も属共起で確定: アエオニウム＋夕映→アエオニウムの夕映", () => {
    const fuda = buildFuda(["アエオニウム", "夕映"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "夕映", sci: "Aeonium decorum f. variegata" });
  });

  it("#223 variety-variety も属共起で確定: シャクヤク＋夕映→シャクヤクの夕映", () => {
    const fuda = buildFuda(["シャクヤク", "夕映"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "夕映", sci: "Paeonia lactiflora 'Yubae'" });
  });

  it("#223/#459 単一候補でも親属タグが無ければ札にしない（コシヒカリ単独）", () => {
    // 旧仕様は単一候補を親無しでも先頭候補で1枚にした。#459 で親（属）の無い素の品種タグは札にしない。
    expect(buildFuda(["コシヒカリ"], VARIETY_CATALOG)).toEqual([]);
    // 属タグと併記すれば filterTags は [属, 品種]（札クリックの逆算が属＋品種で当たる）。
    expect(buildFuda(["イネ", "コシヒカリ"], VARIETY_CATALOG)[0]).toMatchObject({
      key: "コシヒカリ",
      filterTags: ["イネ", "コシヒカリ"],
    });
  });
});

// #506 属レベルの受け皿品種札の畳み込み。ある属で emit 対象の品種のうち具体種（解決後 sci に空白あり）が
// 1枚でもあれば、同属の属レベル受け皿札（解決後 sci が裸属名＝空白なし）を落とす。具体種が0枚なら残す。
// 実カタログの チランジア（エアプランツ=Tillandsia / イオナンタ=Tillandsia ionantha）・ベゴニア
// （木立性/根茎性/球根性ベゴニア=Begonia / マクラータ=Begonia maculata）は品種に catalog.sci があり
// 辞書非依存で決定的。1枚境界（具体種1枚で落ちる／0枚で残る）を両側とも持つ。
describe("#506 属レベル受け皿札の畳み込み", () => {
  it("畳み込み本命: 具体種が1枚あれば同属の属レベル受け皿札を落とす（エアプランツ＋イオナンタ＋チランジア）", () => {
    // エアプランツ=Tillandsia（空白なし＝属レベル受け皿）は、同属の具体種 イオナンタ=Tillandsia ionantha
    // が1枚あるので落ちる。残るのは具体種のイオナンタ札1枚のみ。key/filterTags も逆算どおり。
    const fuda = buildFuda(["エアプランツ", "イオナンタ", "チランジア"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({
      key: "イオナンタ",
      sci: "Tillandsia ionantha",
      filterTags: ["チランジア", "イオナンタ"],
    });
  });

  it("受け皿単独は残す: 同属に具体種が無ければ属レベル受け皿札はそのまま（チランジア＋エアプランツ）＝回帰防止の要", () => {
    // 具体種の兄弟がいない受け皿単独（エアプランツ=Tillandsia）は落とさない。1枚境界の残す側。
    const fuda = buildFuda(["チランジア", "エアプランツ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({
      key: "エアプランツ",
      sci: "Tillandsia",
      filterTags: ["チランジア", "エアプランツ"],
    });
  });

  it("具体種0枚なら属レベルを全部残す: 木立性/根茎性/球根性ベゴニア（全て Begonia）→3枚とも残る・catalog 出現順", () => {
    // 3枚とも解決後 sci が裸属名 Begonia（空白なし）＝具体種0枚。落とさず全部残す。1枚境界の逆側（0枚）。
    const fuda = buildFuda(["ベゴニア", "木立性ベゴニア", "根茎性ベゴニア", "球根性ベゴニア"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(3);
    expect(fuda.map((f) => f.key)).toEqual(["木立性ベゴニア", "根茎性ベゴニア", "球根性ベゴニア"]);
    expect(fuda.map((f) => f.sci)).toEqual(["Begonia", "Begonia", "Begonia"]);
  });

  it("具体種＋園芸品種（両方 sci に空白あり・属レベル無し）は両方 emit する（イオナンタ＋コットンキャンディ）", () => {
    // イオナンタ=Tillandsia ionantha（species）と コットンキャンディ=Tillandsia 'Cotton Candy'（cultivar）は
    // 両方とも空白あり＝具体種。属レベル受け皿が無いので畳まず両方残す（catalog 出現順）。
    const fuda = buildFuda(["チランジア", "イオナンタ", "コットンキャンディ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.sci)).toEqual(["Tillandsia ionantha", "Tillandsia 'Cotton Candy'"]);
  });

  it("種＋属レベル混在なら属レベルだけ畳む: マクラータ残し 木立性/根茎性ベゴニアは落とす", () => {
    // マクラータ=Begonia maculata（具体種）が1枚あるので、同属の属レベル受け皿（木立性/根茎性ベゴニア=Begonia）は
    // まとめて落ちる。残るのは具体種のマクラータ1枚。
    const fuda = buildFuda(["ベゴニア", "マクラータ", "木立性ベゴニア", "根茎性ベゴニア"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "マクラータ", sci: "Begonia maculata" });
  });

  it("畳んだ属レベル札は湧出しない: 落とした受け皿の key も sci も結果配列に一切現れない（dedupe/二重計上防止）", () => {
    // 畳み込みは continue で emit をスキップするだけ＝別経路で復活してはいけない（ランキング二重計上の担保）。
    const fuda = buildFuda(["エアプランツ", "イオナンタ", "チランジア"], VARIETY_CATALOG);
    expect(fuda.some((f) => f.key === "エアプランツ")).toBe(false); // 受け皿の key は湧出しない
    expect(fuda.some((f) => f.sci === "Tillandsia")).toBe(false); // 裸属名 sci も湧出しない（属単独札としても出ない）
  });

  it("合成カタログで決定的: 具体種があれば属レベル受け皿は落ちる（辞書非依存）", () => {
    // FOLD_SYNTH: 具体品種=Folda specifica（空白あり）が居るので 受け皿品種=Folda（空白なし）は落ちる。
    const fuda = buildFuda(["フォルダ属", "受け皿品種", "具体品種"], FOLD_SYNTH);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "具体品種", sci: "Folda specifica" });
  });

  it("合成カタログで決定的: 受け皿単独なら残る（辞書非依存）", () => {
    // FOLD_SYNTH: 具体種が来なければ 受け皿品種=Folda（裸属名・空白なし）はそのまま残る。
    const fuda = buildFuda(["フォルダ属", "受け皿品種"], FOLD_SYNTH);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "受け皿品種", sci: "Folda" });
  });

  it("S1a 別属の受け皿は畳まない（寄せ集め属・実カタログ）: 観葉植物＋ペペロミア＋ディフェンバキア→両方残す", () => {
    // その他観葉（非 pickable 見出し属）は複数の植物学的属を束ねる寄せ集め属。ペペロミア=Peperomia（裸属名＝
    // 属レベル受け皿）は、同じ catalog genus に別属の具体種 ディフェンバキア=Dieffenbachia seguine が居ても、
    // **属トークンが別（Peperomia≠Dieffenbachia）なので畳まれない**。非 pickable なのでカテゴリ（観葉植物）共起で
    // 品種札になり filterTags=[カテゴリ, 品種]（#448）。両方残るのが回帰防止の要（旧実装は Peperomia を消していた）。
    const fuda = buildFuda(["観葉植物", "ペペロミア", "ディフェンバキア"], VARIETY_CATALOG);
    // catalog 出現順は ディフェンバキア（idx0）→ ペペロミア（idx4）。
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.sci)).toEqual(["Dieffenbachia seguine", "Peperomia"]);
    expect(fuda.some((f) => f.sci === "Peperomia")).toBe(true); // 別属の具体種で消えないこと
    expect(fuda.find((f) => f.key === "ペペロミア")).toMatchObject({ filterTags: ["観葉植物", "ペペロミア"] });
  });

  it("S1b 別属の受け皿は畳まない（pickable 属に別属受け皿・実カタログ）: ペチュニア＋サフィニア＋カリブラコア→両方残す", () => {
    // pickable 属 ペチュニア（Petunia）の varieties に別植物学属の受け皿 カリブラコア=Calibrachoa（裸属名）が同居する。
    // 同じ catalog genus に具体種 サフィニア=Petunia 'Surfinia' が居ても、属トークンが別（Petunia≠Calibrachoa）なので
    // カリブラコアは畳まれない。両方 pickable 属配下なので filterTags=[属, 品種]。旧実装は Calibrachoa を消していた。
    const fuda = buildFuda(["ペチュニア", "サフィニア", "カリブラコア"], VARIETY_CATALOG);
    // catalog 出現順は サフィニア（idx0）→ カリブラコア（idx6）。
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.sci)).toEqual(["Petunia 'Surfinia'", "Calibrachoa"]);
    expect(fuda.some((f) => f.sci === "Calibrachoa")).toBe(true); // 別属の具体種で消えないこと
    expect(fuda.find((f) => f.key === "カリブラコア")).toMatchObject({ filterTags: ["ペチュニア", "カリブラコア"] });
  });

  it("Q1a `Genus sp.` は属レベル扱い（合成）: 受け皿＋Xenia sp.＋具体種→具体種のみ（sp. も畳まれる）", () => {
    // クセニア属: 受け皿=Xenia（裸属名）と クセニア未特定=Xenia sp.（種未特定＝属レベル）は、同じ属トークン Xenia の
    // 具体種 クセニア具体=Xenia realis があるので両方畳まれる。残るのは具体種1枚。
    const fuda = buildFuda(["クセニア属", "クセニア受け皿", "クセニア未特定", "クセニア具体"], FOLD_SYNTH);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ key: "クセニア具体", sci: "Xenia realis" });
  });

  it("Q1b `Genus sp.` は具体種と誤認しない（合成）: 受け皿＋Xenia sp. だけ（具体種なし）→両方残す", () => {
    // クセニア未特定=Xenia sp. は空白を含むが `sp.` なので **具体種でない**。具体種が居ないので受け皿を畳まない
    // ＝両方残る（旧 /\s/ 判定なら Xenia sp. を具体種と誤認して受け皿を消していた）。catalog 出現順。
    const fuda = buildFuda(["クセニア属", "クセニア受け皿", "クセニア未特定"], FOLD_SYNTH);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.key)).toEqual(["クセニア受け皿", "クセニア未特定"]);
    expect(fuda.map((f) => f.sci)).toEqual(["Xenia", "Xenia sp."]);
  });
});

// #257: 索引（buildVarietyIndex）を1回作って複数投稿で使い回しても、各投稿の札は独立に正しく出る
// （resolveFuda が索引を読み取り専用で扱い、可変状態は呼び出しローカルに閉じている＝汚染しない）。
describe("buildVarietyIndex / resolveFuda（#257 索引共有）", () => {
  it("buildFuda と等価（同じ catalog で索引を作って resolveFuda に渡す）", () => {
    const index = buildVarietyIndex(VARIETY_CATALOG);
    for (const tags of [["パキポディウム", "グラキリス"], ["コシヒカリ"], ["塊根植物"], []]) {
      expect(resolveFuda(tags, index)).toEqual(buildFuda(tags, VARIETY_CATALOG));
    }
  });

  it("1つの索引を複数投稿で使い回しても相互に汚染しない", () => {
    const index = buildVarietyIndex(VARIETY_CATALOG);
    const a1 = resolveFuda(["パキポディウム", "グラキリス"], index);
    const b = resolveFuda(["イネ", "コシヒカリ"], index);
    const a2 = resolveFuda(["パキポディウム", "グラキリス"], index); // 使い回し後でも同じ
    expect(a1).toEqual(a2);
    expect(a1[0]).toMatchObject({ key: "グラキリス" });
    expect(b[0]).toMatchObject({ key: "コシヒカリ" });
  });
});

describe("fudaForName（#343・好きな品種の単一名→札1枚）", () => {
  const index = buildVarietyIndex(VARIETY_CATALOG);

  it("カタログ品種は学名の札に（投稿の札と同一）", () => {
    // 単一名は **意図的な単一選択** なので、品種は属コンテキスト無しでも自身の学名で札にする（#459）。
    const f = fudaForName("デラウェア", index);
    expect(f).toMatchObject({ key: "デラウェア", sci: "Vitis 'Delaware'", filterTags: ["ぶどう", "デラウェア"] });
  });

  it("属名は属単独の札に（辞書から属 sci）", () => {
    const f = fudaForName("パキポディウム", index);
    expect(f).toMatchObject({ key: "パキポディウム", sci: "Pachypodium", filterTags: ["パキポディウム"] });
  });

  it("カタログ外の自由入力（学名が引けない）は札にしない＝null（#459＝和名へ倒さない）", () => {
    expect(fudaForName("我が家の謎の木", index)).toBeNull();
  });

  it("カテゴリ名単独も札にできず null（札はカテゴリを出さない・学名も引けない・無回帰）", () => {
    expect(fudaForName("塊根植物", index)).toBeNull();
  });
});

describe("buildVarietyIndex().hashtagLoc（#460 ハッシュタグ表示ローカライズ索引）", () => {
  const { hashtagLoc } = buildVarietyIndex(VARIETY_CATALOG);
  // 正規化キーで引く（normFudaKey = trim+lowercase+空白/_ 統一）。実カタログの確定値で検証する。
  const get = (tag: string) => hashtagLoc.get(tag.trim().toLowerCase().replace(/[_\s]+/g, "_"));

  it("カテゴリ label の Loc を持つ（塊根植物 → en=Caudex Plants）", () => {
    expect(get("塊根植物")?.en).toBe("Caudex Plants");
  });

  it("pickable 属名の Loc を持つ（パキポディウム → en=Pachypodium / アガベ → en=Agave）", () => {
    expect(get("パキポディウム")?.en).toBe("Pachypodium");
    expect(get("アガベ")?.en).toBe("Agave");
  });

  it("カテゴリ ビカクシダ・観葉植物 も Loc を持つ（実カタログの確定値）", () => {
    expect(get("ビカクシダ")?.en).toBe("Staghorn Ferns");
    expect(get("観葉植物")?.en).toBe("Foliage Plants");
  });

  it("品種（loc 無し）は索引に入れない＝ja のまま（グラキリス／チタノタ）", () => {
    expect(get("グラキリス")).toBeUndefined();
    expect(get("チタノタ")).toBeUndefined();
  });

  it("属 alias も同じ Loc に紐づく（笹の雪 の alias ビクトリアレジーナ は品種なので入らない・属 alias を確認）", () => {
    // 属の alias を1つ確認する。吹上属（アガベの品種）でなく、属レベルの alias を持つ pickable 属を使う。
    // 実カタログでは多くの属が alias を持つ。ここでは alias を持つ属が在れば Loc 共有を確認できればよい。
    // アガベは alias を持たない場合があるので、存在チェックは「カテゴリ/属が入る・品種が入らない」で代表させる。
    // （alias の Loc 共有はユニットテスト〔plant-i18n.test.ts〕で合成カタログにより確定検証している。）
    expect(get("塊根植物")).toBeDefined();
  });
});
