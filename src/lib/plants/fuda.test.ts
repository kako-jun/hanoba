import { describe, expect, it } from "vitest";
import { buildFuda, buildVarietyIndex, fudaForName, resolveFuda } from "./fuda.ts";
import { VARIETY_CATALOG, type VarietyCategory } from "./variety-catalog.ts";

// 期待値は実カタログ（VARIETY_CATALOG）と実辞書（dictionary.ts）から確定する（#182/#23）。
// 札は「学名（sci）＋最も有名な和名（name）」を並べた1枚。最も具体的な和名を name に持つ。
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

describe("buildFuda", () => {
  it("属＋品種は品種1枚に畳む（属単独は出さない）＋ filterTags=[属,品種]（#272 逆算）", () => {
    const fuda = buildFuda(["パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    // 札クリックは属＋品種の AND で絞る（逆算が元投稿に当たる）。
    expect(fuda[0]).toMatchObject({ name: "グラキリス", filterTags: ["パキポディウム", "グラキリス"] });
  });

  it("品種単独タグでも札になる＝filterTags=[品種]（属共起の時だけ [属,品種]・#272 逆算）", () => {
    // 親属タグ無しの素の品種タグは catalog 先頭候補に倒す（#223）。逆算は filterTags=[品種]＝元投稿は
    // #品種 しか持たないので品種単独で当たる。属が併記された時だけ filterTags=[属,品種] になる。
    const fuda = buildFuda(["グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス", filterTags: ["グラキリス"] });
  });

  it("同属の複数品種はそれぞれ札になり、属単独は出ない（順序は catalog 出現順）", () => {
    // アガベの varieties は チタノタ(idx0) → ... → 白鯨(idx2) の順。
    const fuda = buildFuda(["アガベ", "チタノタ", "白鯨"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.name)).toEqual(["チタノタ", "白鯨"]);
  });

  it("カテゴリ（VarietyCategory.label）は札にしない", () => {
    expect(buildFuda(["塊根植物"], VARIETY_CATALOG)).toEqual([]);
  });

  it("カテゴリ＋属＋品種が混ざってもカテゴリは無視し品種だけ残す", () => {
    const fuda = buildFuda(["塊根植物", "パキポディウム", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス" });
  });

  it("属単独（品種タグ無し）は属名の札を出す＋ filterTags=[属]", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "アガベ", filterTags: ["アガベ"] });
  });

  it("学名は catalog の variety.sci を最優先する（塊根植物の実データ）", () => {
    // ブレビカウレ → #409 で正準「恵比寿笑い」へ統合（alias）。catalog.sci = Pachypodium brevicaule。
    // 旧投稿のタグ「ブレビカウレ」も alias 経由で正準 name に解決し、品種札は属＋品種で立てる（#272）。
    const fuda = buildFuda(["パキポディウム", "ブレビカウレ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "恵比寿笑い", sci: "Pachypodium brevicaule" });
  });

  it("catalog.sci が無くても dictionary に品種があれば品種 sci を併記する", () => {
    // チタノタ は catalog.sci 無し・dictionary に チタノタ→Agave titanota。属＋品種で立てる。
    const fuda = buildFuda(["アガベ", "チタノタ"], VARIETY_CATALOG);
    expect(fuda[0]).toMatchObject({ name: "チタノタ", sci: "Agave titanota" });
  });

  it("catalog.sci を最優先する（合成カタログで決定的）", () => {
    // 合成種A は catalog.sci="Agave fakea" を持つ＝dictionary より優先。属アガベと併記。
    const fuda = buildFuda(["アガベ", "合成種A"], SYNTH);
    expect(fuda[0]).toMatchObject({ name: "合成種A", sci: "Agave fakea" });
  });

  it("学名は catalog.sci も dictionary 品種も無ければ属 sci にフォールバックする（合成カタログ）", () => {
    // 合成種B は catalog.sci 無し・dict 外。属「アガベ」が dict にある → Agave。属アガベと併記。
    const fuda = buildFuda(["アガベ", "合成種B"], SYNTH);
    expect(fuda[0]).toMatchObject({ name: "合成種B", sci: "Agave" });
  });

  it("学名は catalog.sci も品種も属も辞書外なら null（和名のみ＝グレースフル・合成カタログ）", () => {
    // 合成種C は catalog.sci 無し・dict 外、属「ゲンクウ属」も dict 外 → null。属と併記。
    const fuda = buildFuda(["ゲンクウ属", "合成種C"], SYNTH);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "合成種C", sci: null });
  });

  it("属単独でも辞書から属 sci を引く", () => {
    const fuda = buildFuda(["アガベ"], VARIETY_CATALOG);
    expect(fuda[0]).toMatchObject({ name: "アガベ", sci: "Agave" });
  });

  it("非 pickable 見出し属（原種）配下の品種は品種和名で出し、見出し語を出さない（should #1 回帰ガード）", () => {
    // ビカクシダ › 原種(pickable:false) › リドレイ。札の name は「リドレイ」だけ＝「原種 リドレイ」に
    // ならない（見出し語を name に出さない）。sci の有無は学名付与の進捗で変わるので assert しない。
    const fuda = buildFuda(["リドレイ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("リドレイ");
    expect(fuda[0]!.name).not.toContain("原種");
  });

  it("ビカクシダのカテゴリタグをビフルカツムの別名札にせず、品種名をビフルカツムに保つ（#341）", () => {
    const fuda = buildFuda(["ビカクシダ", "ビフルカツム"], VARIETY_CATALOG);
    expect(fuda).toEqual([
      {
        key: "ビフルカツム",
        name: "ビフルカツム",
        sci: "Platycerium bifurcatum",
        filterTags: ["ビフルカツム"],
      },
    ]);
  });

  it("非 pickable 見出し属はタグしても札にしない（見出し語は表に出ない）", () => {
    // 「原種」は pickable:false の見出し属＝札にならない。
    expect(buildFuda(["原種"], VARIETY_CATALOG)).toEqual([]);
  });

  it("#409 別名 #ヴェイチー の旧投稿も正準 name『ベイチー』に解決する（read=別名→正準）", () => {
    // ビカクシダ › 原種 › { name:"ベイチー", aliases:["ヴェイチー"] } に統合済み。
    // 別名タグで打った投稿も札の name は正準「ベイチー」になる（学名は Platycerium veitchii）。
    const fuda = buildFuda(["ヴェイチー"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("ベイチー");
    expect(fuda[0]!.sci).toBe("Platycerium veitchii");
  });

  it("#409/#315 ベイチー単独は Platycerium（catalog 先頭候補）に倒れ、Anthurium に化けない", () => {
    // ベイチー は Platycerium（ビカクシダ）と Anthurium（観葉植物）に同名で存在する。
    // 親属タグ無しの単独は catalog 出現順の先頭＝ビカクシダの Platycerium veitchii に倒す。
    const fuda = buildFuda(["ベイチー"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("ベイチー");
    expect(fuda[0]!.sci).toBe("Platycerium veitchii");
  });

  it("#409/#315 アンスリウム共起なら ベイチー は Anthurium 側に確定する（同名跨ぎ・属共起解決が無回帰）", () => {
    const fuda = buildFuda(["アンスリウム", "ベイチー"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("ベイチー");
    expect(fuda[0]!.sci).toBe("Anthurium veitchii");
  });

  it("辞書外・世話タグ・他クライアント由来タグは無視する", () => {
    const fuda = buildFuda(["水やり", "謎タグ", "アガベ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "アガベ" });
  });

  it("重複タグは1枚に dedupe する", () => {
    const fuda = buildFuda(["パキポディウム", "グラキリス", "グラキリス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "グラキリス" });
  });

  it("前後空白・英大小が混じっても照合する（属 alias 経由）", () => {
    // ヒマワリ属の alias に "sunflower" がある。trim + toLowerCase 照合を確認。
    const fuda = buildFuda(["  SunFlower  "], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "ヒマワリ" });
  });

  it("品種の alias 経由タグでも札になり、name は catalog の canonical 品種名を使う", () => {
    // コケ各種(pickable:false) › ホソバオキナゴケ の alias "山苔" でヒット。
    // 来たタグ（山苔）でなく canonical 名（ホソバオキナゴケ）を name にする。見出し語も出ない。
    // sci の有無は学名付与の進捗で変わるので name のみ assert。
    const fuda = buildFuda(["山苔"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]!.name).toBe("ホソバオキナゴケ");
  });

  it("key は name で組む（dedupe 鍵）", () => {
    expect(buildFuda(["パキポディウム", "グラキリス"], VARIETY_CATALOG)[0]!.key).toBe("グラキリス");
    expect(buildFuda(["アガベ"], VARIETY_CATALOG)[0]!.key).toBe("アガベ");
  });

  // 穀物カテゴリ（#214）。イネは alias（稲/コメ/米/水稲/陸稲）を持つ pickable 属。
  // alias でも属単独札が出ない＝#214/#162 二重計上防止の核心を畳み込みで守る。
  it("穀物: 属＋品種は品種1枚に畳む（イネ＋コシヒカリ）", () => {
    const fuda = buildFuda(["イネ", "コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "コシヒカリ" });
  });

  it("穀物: 属 alias＋品種でも genus 単独札が出ず品種に畳む（稲＋コシヒカリ・二重計上防止）", () => {
    const fuda = buildFuda(["稲", "コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "コシヒカリ" });
  });

  it("穀物: 複数 alias が並んでも品種1枚に畳む（稲＋コメ＋コシヒカリ）", () => {
    const fuda = buildFuda(["稲", "コメ", "コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "コシヒカリ" });
  });

  it("穀物: alias 単独は canonical 属名の属単独札になる（稲→イネ）", () => {
    const fuda = buildFuda(["稲"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "イネ" });
  });

  it("穀物: 同属の複数品種はそれぞれ札になり属単独は出ない（catalog 出現順＝コシヒカリ→ササニシキ）", () => {
    const fuda = buildFuda(["イネ", "コシヒカリ", "ササニシキ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(2);
    expect(fuda.map((f) => f.name)).toEqual(["コシヒカリ", "ササニシキ"]);
  });

  it("穀物: 非 pickable 見出し属（雑穀）配下の品種は品種和名で札にし見出し語を出さない", () => {
    const fuda = buildFuda(["雑穀", "アワ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "アワ" });
  });

  it("穀物: 非 pickable 見出し属（雑穀）はタグしても札にしない", () => {
    expect(buildFuda(["雑穀"], VARIETY_CATALOG)).toEqual([]);
  });

  it("穀物: 非 pickable 見出し属（トウモロコシ（穀物用））配下の品種は品種和名で札にする", () => {
    const fuda = buildFuda(["トウモロコシ（穀物用）", "デントコーン"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "デントコーン" });
  });

  it("穀物: 非 pickable 見出し属（トウモロコシ（穀物用））はタグしても札にしない", () => {
    expect(buildFuda(["トウモロコシ（穀物用）"], VARIETY_CATALOG)).toEqual([]);
  });

  it("穀物: 属名＝品種名のデータ（ライムギ）でも品種1枚＝学名 Secale cereale を持つ", () => {
    const fuda = buildFuda(["ライムギ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "ライムギ", sci: "Secale cereale" });
  });

  it("穀物: デントコーンは野菜トウモロコシと別属で独立する（Zea mays 同名でも混ざらない）", () => {
    const fuda = buildFuda(["デントコーン"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "デントコーン" });
  });

  // #223 属コンテキスト解決。同名品種を別属に自然名で共存させ、#属#品種 併記で曖昧解決する。
  // データ巻き戻し: アボカドの「ハス」復活（ハスアボカド→ハス）/ ボタンの「太陽」復活。
  it("#223 属共起で品種確定: アボカド＋ハス→アボカドのハス（蓮に化けない）", () => {
    const fuda = buildFuda(["アボカド", "ハス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "ハス", sci: "Persea americana 'Hass'" });
  });

  it("#223 ハス単独は蓮属の属単独札になる（親属アボカド無し→属名一致＝水生の蓮）", () => {
    const fuda = buildFuda(["ハス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "ハス" });
    expect(fuda[0]!.sci).not.toBe("Persea americana 'Hass'"); // アボカドのハスに化けない
  });

  it("#223 属共起で品種確定: ボタン＋太陽→ボタンの太陽（サボテン/スモモに化けない）", () => {
    const fuda = buildFuda(["ボタン", "太陽"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "太陽", sci: "Paeonia suffruticosa 'Taiyo'" });
  });

  it("#223 太陽単独は既定（catalog 先頭候補）の1枚に倒す（filterTags=[品種]・親属タグ無し）", () => {
    // 太陽は サボテン(Ferocactus echidne) → スモモ(Prunus 'Taiyo') → ボタン の順で catalog に出る。
    // 親属タグが無いので既定＝先頭候補（サボテンの太陽）に倒す。逆算は filterTags=[太陽]（単独で当たる）。
    const fuda = buildFuda(["太陽"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "太陽", sci: "Ferocactus echidne", filterTags: ["太陽"] });
  });

  it("#223 属共起で品種確定: ユッカ＋エレファンティペス→ユッカ側の札（亀甲竜に化けない）", () => {
    const fuda = buildFuda(["ユッカ", "エレファンティペス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "エレファンティペス", sci: "Yucca gigantea" });
  });

  it("#223 属共起で品種確定: ディオスコレア＋エレファンティペス→亀甲竜系（塊根側・Dioscorea）", () => {
    // #409 で Dioscorea「エレファンティペス」は正準「亀甲竜」へ統合（alias）。属共起で塊根側（Dioscorea）の
    // 亀甲竜に確定し、同名 alias を持つ Yucca（Yucca gigantea）側へは化けないこと（sci で別物を排除）。
    const fuda = buildFuda(["ディオスコレア", "エレファンティペス"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "亀甲竜", sci: "Dioscorea elephantipes" });
  });

  it("#223 variety-variety も属共起で確定: アエオニウム＋夕映→アエオニウムの夕映", () => {
    const fuda = buildFuda(["アエオニウム", "夕映"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "夕映", sci: "Aeonium decorum f. variegata" });
  });

  it("#223 variety-variety も属共起で確定: シャクヤク＋夕映→シャクヤクの夕映", () => {
    const fuda = buildFuda(["シャクヤク", "夕映"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "夕映", sci: "Paeonia lactiflora 'Yubae'" });
  });

  it("#223 単一候補は親属タグ無しでも解決する（コシヒカリ単独＝既定で1枚・filterTags=[品種]）", () => {
    const fuda = buildFuda(["コシヒカリ"], VARIETY_CATALOG);
    expect(fuda).toHaveLength(1);
    expect(fuda[0]).toMatchObject({ name: "コシヒカリ", filterTags: ["コシヒカリ"] });
    // 属タグと併記すれば filterTags は [属, 品種]（札クリックの逆算が属＋品種で当たる）。
    expect(buildFuda(["イネ", "コシヒカリ"], VARIETY_CATALOG)[0]).toMatchObject({
      name: "コシヒカリ",
      filterTags: ["イネ", "コシヒカリ"],
    });
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
    expect(a1[0]).toMatchObject({ name: "グラキリス" });
    expect(b[0]).toMatchObject({ name: "コシヒカリ" });
  });
});

describe("fudaForName（#343・好きな品種の単一名→札1枚）", () => {
  const index = buildVarietyIndex(VARIETY_CATALOG);

  it("カタログ品種は学名＋和名の札に（投稿の札と同一）", () => {
    const f = fudaForName("デラウェア", index);
    expect(f).toMatchObject({ name: "デラウェア", sci: "Vitis 'Delaware'", filterTags: ["デラウェア"] });
  });

  it("属名は属単独の札に（辞書から属 sci）", () => {
    const f = fudaForName("パキポディウム", index);
    expect(f).toMatchObject({ name: "パキポディウム", sci: "Pachypodium", filterTags: ["パキポディウム"] });
  });

  it("カタログ外の自由入力は和名のみの札へフォールバック（消さない・sci=null）", () => {
    const f = fudaForName("我が家の謎の木", index);
    expect(f).toEqual({ key: "我が家の謎の木", name: "我が家の謎の木", sci: null, filterTags: ["我が家の謎の木"] });
  });

  it("カテゴリ名単独も札にできず和名のみへフォールバック（札はカテゴリを出さない・無回帰）", () => {
    const f = fudaForName("塊根植物", index);
    expect(f).toEqual({ key: "塊根植物", name: "塊根植物", sci: null, filterTags: ["塊根植物"] });
  });
});
