import { describe, expect, it } from "vitest";
import { VARIETY_CATALOG } from "./variety-catalog.ts";
import { searchCatalog } from "./variety-search.ts";

// #168: 基本種・別ジャンル（水草等）の網羅 guard。マス層が自分の植物を検索で見つけられること
// （= 共通タグへの収束の前提）を、代表種が VARIETY_CATALOG から検索で拾えることで担保する。

describe("基本種・別ジャンルの存在確認（#168）", () => {
  // 通称（本文 # に入る name）で 1 件以上ヒットすること。
  const basics = [
    "ひまわり",
    "パキラ",
    "ドラセナ",
    "アイビー",
    "チューリップ",
    "スイセン",
    "バジル",
    "シソ",
    "ツツジ",
    "キンモクセイ",
    "モミジ",
    "コスモス",
    "アサガオ",
    "キク",
    "アヌビアス",
    "ミクロソリウム",
    "スイレン",
    "シダ",
    "苔",
  ];

  for (const term of basics) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // alias 経由（表記揺れ）でも拾えること。
  const aliasTerms = ["向日葵", "ヘデラ", "水仙", "金木犀", "コケ"];
  for (const term of aliasTerms) {
    it(`alias「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }
});

describe("穀物カテゴリ・代表品種の検索到達性（#214）", () => {
  // 穀物カテゴリの代表品種が searchCatalog で拾えること（マス層の検索からの収束を担保）。
  const grains = ["コシヒカリ", "山田錦", "ダッタンソバ", "デントコーン"];
  for (const term of grains) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // イネ属の alias（表記揺れ）でも pickable 属として拾えること。
  const grainAliasTerms = ["稲", "コメ"];
  for (const term of grainAliasTerms) {
    it(`alias「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }
});

describe("熱帯果樹カテゴリ・代表品種の検索到達性（#216）", () => {
  // 熱帯果樹の代表属・品種が searchCatalog で拾えること（マス層の検索からの収束を担保）。
  const tropical = ["マンゴー", "バナナ", "ドラゴンフルーツ", "甲州"];
  for (const term of tropical) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // ドラゴンフルーツ属の alias（表記揺れ）でも拾えること。
  it(`alias「ピタヤ」が検索で 1 件以上ヒットする`, () => {
    expect(searchCatalog(VARIETY_CATALOG, "ピタヤ").length).toBeGreaterThan(0);
  });
});

describe("芍薬・牡丹カテゴリ・代表品種の検索到達性（#217）", () => {
  // 芍薬・牡丹の代表属・品種が searchCatalog で拾えること。
  const peony = ["シャクヤク", "ボタン", "サラ・ベルナール"];
  for (const term of peony) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // ボタン属の alias（表記揺れ）でも拾えること。
  it(`alias「牡丹」が検索で 1 件以上ヒットする`, () => {
    expect(searchCatalog(VARIETY_CATALOG, "牡丹").length).toBeGreaterThan(0);
  });
});

describe("山菜・野草カテゴリ・代表品種の検索到達性（#218）", () => {
  // 山菜・野草の代表属が searchCatalog で拾えること。
  const wild = ["フキ", "ミョウガ", "ウド", "タラの芽"];
  for (const term of wild) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }
});

describe("属取りこぼし救済・代表種の検索到達性（#220）", () => {
  // 取りこぼしていた属・品種が searchCatalog で拾えること。
  const rescued = [
    "ユッカ",
    "黒法師",
    "カンナ",
    "ゴールドクレスト",
    "コキア",
    "アーティチョーク",
    "サルミアナ",
    "こんぺいとう",
    "ヴァッセイ",
    "アンブリッジローズ",
  ];
  for (const term of rescued) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // コキア属の品種名「ホウキギ」（標準和名）でも拾えること。
  it(`「ホウキギ」が検索で 1 件以上ヒットする`, () => {
    expect(searchCatalog(VARIETY_CATALOG, "ホウキギ").length).toBeGreaterThan(0);
  });
});

describe("カタログの健全性", () => {
  it("Platycerium bifurcatum は総称でなく「ビフルカツム」1件として登録する（#341）", () => {
    const bifurcatum = VARIETY_CATALOG
      .flatMap((category) => category.genera)
      .flatMap((genus) => genus.varieties)
      .filter((variety) => variety.sci === "Platycerium bifurcatum");

    expect(bifurcatum).toEqual([{ name: "ビフルカツム", sci: "Platycerium bifurcatum" }]);
  });

  it("カテゴリ label がユニーク", () => {
    const labels = VARIETY_CATALOG.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("全 Genus の varieties に空文字 name が無い", () => {
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        for (const v of genus.varieties) {
          expect(v.name.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("属名にも空文字が無い", () => {
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        expect(genus.name.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("#409 同一属内に同じ品種 name が重複しない（真の重複は1エントリに収束）", () => {
    const dups: string[] = [];
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        const seen = new Map<string, number>();
        for (const v of genus.varieties) seen.set(v.name, (seen.get(v.name) ?? 0) + 1);
        for (const [name, n] of seen) if (n > 1) dups.push(`${cat.label}/${genus.name}: ${name} x${n}`);
      }
    }
    expect(dups).toEqual([]);
  });

  it("#409 Platycerium veitchii はベイチー1件＋alias ヴェイチー に統合（表記揺れを1エントリへ）", () => {
    const veitchii = VARIETY_CATALOG
      .flatMap((category) => category.genera)
      .flatMap((genus) => genus.varieties)
      .filter((variety) => variety.sci === "Platycerium veitchii");
    expect(veitchii).toEqual([{ name: "ベイチー", sci: "Platycerium veitchii", aliases: ["ヴェイチー"] }]);
    // 別検索（ヴェイチー）でも正準「ベイチー」に到達する。
    expect(searchCatalog(VARIETY_CATALOG, "ヴェイチー").map((h) => h.name)).toContain("ベイチー");
  });

  it("#409/#315 ベイチーは Anthurium veitchii（別属の同名）と混ざらない（属文脈で別管理）", () => {
    const anthurium = VARIETY_CATALOG
      .flatMap((category) => category.genera)
      .flatMap((genus) => genus.varieties)
      .filter((variety) => variety.sci === "Anthurium veitchii");
    // Anthurium 側の「ベイチー」は別植物として温存（統合・移動しない）。
    expect(anthurium).toEqual([{ name: "ベイチー", sci: "Anthurium veitchii" }]);
  });
});

describe("#409 P-dissolve: 盆栽カテゴリ解体・針葉樹は庭木へ一本化", () => {
  const labels = VARIETY_CATALOG.map((c) => c.label);
  const niwaki = () => VARIETY_CATALOG.find((c) => c.label === "花木・庭木")!;
  const allNames = () =>
    VARIETY_CATALOG.flatMap((c) => c.genera).flatMap((g) => g.varieties).map((v) => v.name);

  it("「盆栽」カテゴリは解体されて存在しない（盆栽は品種でなく仕立て＝tag-catalog 側 #413）", () => {
    expect(labels).not.toContain("盆栽");
  });

  it("針葉樹は独立カテゴリを作らず花木・庭木へ一本化する（コニファー以外の針葉樹も特別扱いしない・kako-jun）", () => {
    expect(labels).not.toContain("針葉樹");
    expect(labels).not.toContain("針葉樹・コニファー");
    const generaNames = niwaki().genera.map((g) => g.name);
    expect(generaNames).toContain("松柏類"); // 盆栽の松柏（黒松・真柏…）
    expect(generaNames).toContain("コニファー"); // 園芸針葉樹（据え置き）
  });

  it("松柏類・コニファー の両属が alias「針葉樹」を持ち1検索で揃う", () => {
    for (const name of ["松柏類", "コニファー"]) {
      const g = niwaki().genera.find((x) => x.name === name)!;
      expect(g.aliases ?? []).toContain("針葉樹");
    }
  });

  it("松柏類は黒松・五葉松・真柏・杜松・杉・桧・一位 を含む（盆栽から移設）", () => {
    const names = niwaki().genera.find((g) => g.name === "松柏類")!.varieties.map((v) => v.name);
    expect(names).toEqual(
      expect.arrayContaining(["黒松", "五葉松", "真柏", "糸魚川真柏", "杜松", "杉", "桧", "一位"]),
    );
  });

  it("さつき品種（月光・白光・松鏡・長寿宝）は花木・庭木 > サツキ へ統合", () => {
    const names = niwaki().genera.find((g) => g.name === "サツキ")!.varieties.map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(["月光", "白光", "松鏡", "長寿宝"]));
  });

  it("行き場のない実体（雑木・実もの観賞・花梨）が botanical へ移った", () => {
    const names = allNames();
    expect(names).toEqual(
      expect.arrayContaining(["ケヤキ", "ブナ", "ロウバイ", "ピラカンサ", "ウメモドキ", "ロウヤガキ", "カリン"]),
    );
  });

  // 検索到達性: 変種名で拾える。
  for (const term of ["黒松", "真柏", "杜松", "ケヤキ", "カリン", "月光"]) {
    it(`「${term}」が検索で 1 件以上ヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).length).toBeGreaterThan(0);
    });
  }

  // 旧表記（盆栽カタログのカタカナ/漢字）でも alias 経由で正準へ到達する（read=別名→正準）。
  const aliasPairs: Array<[string, string]> = [
    ["蝋梅", "ロウバイ"],
    ["老爺柿", "ロウヤガキ"],
    ["欅", "ケヤキ"],
    ["花梨", "カリン"],
    // 跨ぎ削除した旧盆栽の表記揺れも botanical の正準へ畳む（read 吸収の穴を塞ぐ）。
    ["山もみじ", "ヤマモミジ"],
    ["唐楓", "トウカエデ"],
  ];
  for (const [term, canonical] of aliasPairs) {
    it(`旧表記 alias「${term}」が正準「${canonical}」へ到達する`, () => {
      expect(searchCatalog(VARIETY_CATALOG, term).map((h) => h.name)).toContain(canonical);
    });
  }

  it("仕立てスタイルの擬似エントリ（苔盆栽/草もの盆栽/ミニ盆栽/寄せ植え盆栽）はカタログから消えた", () => {
    const names = allNames();
    for (const style of ["苔盆栽", "草もの盆栽", "ミニ盆栽", "寄せ植え盆栽"]) {
      expect(names).not.toContain(style);
    }
  });

  it("「盆梅」は意図的に削除（梅の盆栽仕立て＝種としては梅＝ウメ属がカバー・植物は失われない）", () => {
    // 盆梅 = Prunus mume の盆栽仕立て。仕立ては #413 で tag-catalog の別軸へ、種としての梅は
    // 花木・庭木 > ウメ がカバーするので variety-catalog から落とした（#414）。誤って「消えた」と
    // 後で復活させないための記録。梅本体（ウメ属・梅 alias）は健在であることも併せて担保する。
    const names = allNames();
    expect(names).not.toContain("盆梅");
    const ume = VARIETY_CATALOG.find((c) => c.label === "花木・庭木")!.genera.find((g) => g.name === "ウメ")!;
    expect(ume.aliases ?? []).toContain("梅");
  });
});

// #409 P-canonical パイロット: 同一学名で重複していた 19 組を「正準名 + alias」に畳んだ。
// canonical 名は検索でヒットし、旧 alias 名で検索しても canonical へ到達すること（read 吸収）を担保する。
// 別物（別学名）で同名・近名のエントリは畳まずに残す（distinct guard）。
describe("同義語統合（#409 P-canonical）", () => {
  // 全エントリ（属タグ・品種タグ）の name を平坦化する。
  const allVarietyNames = () =>
    VARIETY_CATALOG.flatMap((cat) => cat.genera.flatMap((g) => g.varieties.map((v) => v.name)));

  // catalog から学名でエントリを引く（[name, sci] の組を平坦化）。
  const allVarietyEntries = () =>
    VARIETY_CATALOG.flatMap((cat) =>
      cat.genera.flatMap((g) => g.varieties.map((v) => [v.name, v.sci] as const)),
    );

  // [canonical, alias, sci] の 19 組。canonical は存在し、alias で引くと canonical に到達する。
  // sci は統合対象の学名（この sci を持つ alias 名の重複エントリが消えていること）。
  const canonicalAliasPairs: Array<[string, string, string]> = [
    ["笹の雪", "ビクトリアレジーナ", "Agave victoriae-reginae"],
    ["吹上", "ストリクタ", "Agave stricta"],
    ["瑠璃晃", "スザンナエ", "Euphorbia suzannae"],
    ["飛竜", "ステラータ", "Euphorbia stellata"],
    ["グロボーサ", "玉鱗宝", "Euphorbia globosa"],
    ["奇怪ヶ島", "スクアローサ", "Euphorbia squarrosa"],
    ["万物想", "レティキュラータス", "Tylecodon reticulatus"],
    ["阿房宮", "パニクラーツス", "Tylecodon paniculatus"],
    ["仙女の舞", "ベハレンシス", "Kalanchoe beharensis"],
    ["レツーサ", "寿", "Haworthia retusa"],
    ["朧月", "パラグアイエンセ", "Graptopetalum paraguayense"],
    ["フーケリー", "群雀", "Pachyphytum hookeri"],
    ["グラキリス", "象牙宮", "Pachypodium rosulatum var. gracilius"],
    ["恵比寿笑い", "ブレビカウレ", "Pachypodium brevicaule"],
    ["サンデルシー", "白馬城", "Pachypodium saundersii"],
    ["光堂", "ナマクアナム", "Pachypodium namaquanum"],
    ["オベスム", "砂漠のバラ", "Adenium obesum"],
    ["亀甲竜", "エレファンティペス", "Dioscorea elephantipes"],
    ["火星人", "フォッケア", "Fockea edulis"],
  ];

  // (a) 各 canonical 名が searchCatalog で 1 件以上ヒットする。
  for (const [canonical] of canonicalAliasPairs) {
    it(`正準「${canonical}」が検索でヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, canonical).length).toBeGreaterThan(0);
    });
  }

  // (b) 旧 alias 名で引くと canonical 名が結果に含まれる（read=別名→正準）。
  for (const [canonical, alias] of canonicalAliasPairs) {
    it(`旧別名「${alias}」が正準「${canonical}」へ到達する`, () => {
      expect(searchCatalog(VARIETY_CATALOG, alias).map((h) => h.name)).toContain(canonical);
    });
  }

  // (c) 統合した学名を持つ alias 名の重複エントリは消えている（canonical へ畳まれた）。
  // ※ 同名でも別学名の別物（Tillandsia stricta=ストリクタ / Yucca=エレファンティペス 等）は残るので
  //    name 単独でなく [name, sci] 組で判定する。
  for (const [, alias, sci] of canonicalAliasPairs) {
    it(`旧別名「${alias}」の重複エントリ（${sci}）は独立では存在しない`, () => {
      const dup = allVarietyEntries().some(([name, s]) => name === alias && s === sci);
      expect(dup).toBe(false);
    });
  }

  // (d) distinct guard: 別学名で同名・近名の 4 エントリは畳まずに残す。
  const distinctSurvivors = ["鉄甲丸", "ソテツキリン", "不死鳥", "子宝草"];
  for (const name of distinctSurvivors) {
    it(`別物「${name}」は統合されず存在し続ける`, () => {
      expect(allVarietyNames()).toContain(name);
    });
  }
});

// #409 P-canonical 第2弾: 同一学名で重複していた 29 組（うち 1 組は alias 2 件）を
// 「正準名 + alias」に畳んだ（合計 30 エントリ削減）。canonical が検索でヒットし、
// 旧 alias 名で検索しても canonical へ到達すること（read 吸収）を担保する。
// 「ミディ胡蝶蘭」「八重咲きゼラニウム」は別物なので畳まずに残す（distinct guard）。
describe("同義語統合（#409 P-canonical 第2弾）", () => {
  // 全エントリ（品種タグ）の name を平坦化する。
  const allVarietyNames = () =>
    VARIETY_CATALOG.flatMap((cat) => cat.genera.flatMap((g) => g.varieties.map((v) => v.name)));

  // catalog から学名でエントリを引く（[name, sci] の組を平坦化）。
  const allVarietyEntries = () =>
    VARIETY_CATALOG.flatMap((cat) =>
      cat.genera.flatMap((g) => g.varieties.map((v) => [v.name, v.sci] as const)),
    );

  // [canonical, alias, sci] の組。canonical は存在し、alias で引くと canonical に到達する。
  // sci は統合対象の学名（この sci を持つ alias 名の重複エントリが消えていること）。
  // ハエトリグサは alias 2 件（ディオネア / マスシプラ）なので 2 行に展開する。
  const canonicalAliasPairs: Array<[string, string, string]> = [
    ["天女", "カルカレア", "Titanopsis calcarea"],
    ["兜", "兜丸", "Astrophytum asterias"],
    ["ランポー玉", "鸞鳳玉", "Astrophytum myriostigma"],
    ["フクシー", "フックシー", "Tillandsia fuchsii"],
    ["デリシオーサ", "デリシオサ", "Monstera deliciosa"],
    ["ワロクアナム", "ウォロケウシー", "Anthurium warocqueanum"],
    ["サクララン", "カルノーサ", "Hoya carnosa"],
    ["ランキフォリア", "インシグニス", "Goeppertia lancifolia"],
    ["ベンジャミン", "ベンジャミナ", "Ficus benjamina"],
    ["コンシンネ", "マジナータ", "Dracaena marginata"],
    ["ヘデラ", "ヘリックス", "Hedera helix"],
    ["ハエトリグサ", "ディオネア", "Dionaea muscipula"],
    ["ハエトリグサ", "マスシプラ", "Dionaea muscipula"],
    ["コモウセンゴケ", "スパチュラータ", "Drosera spatulata"],
    ["セファロタス", "フクロユキノシタ", "Cephalotus follicularis"],
    ["コチョウラン", "ファレノプシス", "Phalaenopsis"],
    ["フウラン", "風蘭", "Vanda falcata"],
    ["クサソテツ", "コゴミ", "Matteuccia struthiopteris"],
    ["茶碗蓮", "ミニ蓮", "Nelumbo nucifera"],
    ["ニオイゼラニウム", "センテッドゼラニウム", "Pelargonium"],
    ["ブルーサルビア", "ファリナセア", "Salvia farinacea"],
    ["メキシカンセージ", "レウカンサ", "Salvia leucantha"],
    ["ビジョナデシコ", "アメリカナデシコ", "Dianthus barbatus"],
    ["ハナニラ", "イフェイオン", "Ipheion uniflorum"],
    ["フレンチラベンダー", "ストエカス", "Lavandula stoechas"],
    ["二十日大根", "ラディッシュ", "Raphanus sativus var. sativus"],
    ["ふだん草", "スイスチャード", "Beta vulgaris var. cicla"],
    ["里芋", "さといも", "Colocasia esculenta"],
    ["食用ほおずき", "ストロベリートマト", "Physalis pruinosa"],
    ["桑", "マルベリー", "Morus"],
  ];

  // (a) 各 canonical 名が searchCatalog で 1 件以上ヒットする。
  const canonicals = [...new Set(canonicalAliasPairs.map(([c]) => c))];
  for (const canonical of canonicals) {
    it(`正準「${canonical}」が検索でヒットする`, () => {
      expect(searchCatalog(VARIETY_CATALOG, canonical).length).toBeGreaterThan(0);
    });
  }

  // (b) 旧 alias 名で引くと canonical 名が結果に含まれる（read=別名→正準）。
  //     別カテゴリ同名と混同しないよう、ヒット結果に canonical name が含まれることで判定する。
  for (const [canonical, alias] of canonicalAliasPairs) {
    it(`旧別名「${alias}」が正準「${canonical}」へ到達する`, () => {
      expect(searchCatalog(VARIETY_CATALOG, alias).map((h) => h.name)).toContain(canonical);
    });
  }

  // (c) 統合した学名を持つ alias 名の重複エントリは消えている（canonical へ畳まれた）。
  //     同名でも別学名の別物は残るので name 単独でなく [name, sci] 組で判定する。
  for (const [, alias, sci] of canonicalAliasPairs) {
    it(`旧別名「${alias}」の重複エントリ（${sci}）は独立では存在しない`, () => {
      const dup = allVarietyEntries().some(([name, s]) => name === alias && s === sci);
      expect(dup).toBe(false);
    });
  }

  // (d) distinct guard: 別物として残すべき「ミディ胡蝶蘭」「八重咲きゼラニウム」は存続する。
  const distinctSurvivors = ["ミディ胡蝶蘭", "八重咲きゼラニウム"];
  for (const name of distinctSurvivors) {
    it(`別物「${name}」は統合されず存在し続ける`, () => {
      expect(allVarietyNames()).toContain(name);
    });
  }
});

// #409 P2 多言語: カテゴリ loc のデータ整合 guard（本番 VARIETY_CATALOG を flatMap で回す既存流儀）。
describe("#409 P2 カテゴリ loc の整合性", () => {
  it("全 23 カテゴリが loc を持ち en/zh/es 3 キーすべて埋まる", () => {
    expect(VARIETY_CATALOG).toHaveLength(23);
    for (const cat of VARIETY_CATALOG) {
      expect(cat.loc, `カテゴリ「${cat.label}」に loc が無い`).toBeDefined();
      for (const key of ["en", "zh", "es"] as const) {
        expect(cat.loc![key], `カテゴリ「${cat.label}」の loc.${key} が無い`).toBeDefined();
      }
    }
  });

  // PR1（このPR）は属/品種に loc を populate しない（カテゴリ23 のみ多言語化）。
  // PR2 で属 222 に loc を入れたら、属についてのこの guard は緩める（品種は固有名詞なので据え置き想定）。
  it("属・品種には loc が無い（PR1 はカテゴリのみ・PR2 で属を入れたら緩める）", () => {
    for (const cat of VARIETY_CATALOG) {
      for (const genus of cat.genera) {
        expect(genus.loc, `属「${genus.name}」に loc がある（PR1 では未 populate のはず）`).toBeUndefined();
        for (const v of genus.varieties) {
          expect(v.loc, `品種「${v.name}」に loc がある（未 populate のはず）`).toBeUndefined();
        }
      }
    }
  });

  it("カテゴリ loc 値に空文字が無い", () => {
    for (const cat of VARIETY_CATALOG) {
      for (const value of Object.values(cat.loc ?? {})) {
        expect(value.trim().length, `カテゴリ「${cat.label}」の loc に空文字`).toBeGreaterThan(0);
      }
    }
  });

  it("カテゴリ loc 値が他カテゴリの ja label と衝突しない（訳語→別カテゴリの誤ヒット防止）", () => {
    const jaLabels = new Set(VARIETY_CATALOG.map((c) => c.label));
    for (const cat of VARIETY_CATALOG) {
      for (const value of Object.values(cat.loc ?? {})) {
        // 自カテゴリ label と同字（zh が ja と同じ等）は許容。他カテゴリの label と衝突したら誤ヒット源。
        if (value === cat.label) continue;
        expect(jaLabels.has(value), `カテゴリ「${cat.label}」の loc 値「${value}」が他カテゴリ label と衝突`).toBe(false);
      }
    }
  });
});
