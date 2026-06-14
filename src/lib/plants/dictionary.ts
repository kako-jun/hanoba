// 人気植物の初期辞書（#23 Phase 1）。
//
// 目的: 俗称・カナ・英・略でバラバラに書かれても、同じ植物として認識し、
//       学名（フォーマル）と「最も有名な表記」を並列表示してクリック検索に繋ぐ。
//       投稿（Nostr イベント）は不変なので、直すのは投稿でなく**この辞書を育てる**こと。
//
// 規律:
// - 学名は属名大文字始まり・種小名小文字（例 `Pachypodium rosulatum var. gracilius`）。
// - `aliases` は検出に使う追加表記（俗称/カナ/英/略）。`name`・`sci` 自体も検出対象。
// - 誤字（タイプミス）は対象外（表記ゆれ＝別名のみ吸収）。
// - 短すぎ/一般的すぎる別名は誤検出を招くため入れない（例: 「草」「葉」）。
// - 園芸品種（cultivar）の細かい修飾は Phase 2 で丸める。ここは属/種/著名種まで。

export interface PlantEntry {
  /** 正規 ID（slug）。集計・重複排除の鍵。 */
  id: string;
  /** 学名（フォーマル表記）。 */
  sci: string;
  /** 最も有名な表記（和名/流通名）。 */
  name: string;
  /** 俗称・カナ・英・略など、検出に使う追加表記。 */
  aliases: string[];
}

export const PLANTS: PlantEntry[] = [
  { id: "agave", sci: "Agave", name: "アガベ", aliases: ["agave", "アガヴェ", "竜舌蘭"] },
  { id: "agave-titanota", sci: "Agave titanota", name: "チタノタ", aliases: ["titanota"] },
  { id: "pachypodium", sci: "Pachypodium", name: "パキポディウム", aliases: ["pachypodium", "パキポ"] },
  {
    id: "pachypodium-gracilius",
    sci: "Pachypodium rosulatum var. gracilius",
    name: "グラキリス",
    aliases: ["gracilius", "gracilis"],
  },
  {
    id: "platycerium",
    sci: "Platycerium",
    name: "ビカクシダ",
    aliases: ["platycerium", "コウモリラン", "麋角羊歯", "ビカク"],
  },
  { id: "monstera", sci: "Monstera deliciosa", name: "モンステラ", aliases: ["monstera"] },
  { id: "alocasia", sci: "Alocasia", name: "アロカシア", aliases: ["alocasia"] },
  {
    id: "philodendron",
    sci: "Philodendron",
    name: "フィロデンドロン",
    aliases: ["philodendron", "フィロデン", "フィロ"],
  },
  {
    id: "sansevieria",
    sci: "Dracaena trifasciata",
    name: "サンスベリア",
    aliases: ["sansevieria", "sanseveria", "サンセベリア", "チトセラン", "トラノオ"],
  },
  { id: "ficus-microcarpa", sci: "Ficus microcarpa", name: "ガジュマル", aliases: ["gajumaru"] },
  { id: "euphorbia", sci: "Euphorbia", name: "ユーフォルビア", aliases: ["euphorbia", "ユーフォ"] },
  {
    id: "adenium",
    sci: "Adenium",
    name: "アデニウム",
    aliases: ["adenium", "砂漠のバラ", "砂漠の薔薇"],
  },
  { id: "hoya", sci: "Hoya", name: "ホヤ", aliases: ["hoya", "サクララン"] },
  { id: "echeveria", sci: "Echeveria", name: "エケベリア", aliases: ["echeveria", "エチェベリア"] },
  { id: "haworthia", sci: "Haworthia", name: "ハオルチア", aliases: ["haworthia", "ハオルシア"] },
  {
    id: "operculicarya-pachypus",
    sci: "Operculicarya pachypus",
    name: "パキプス",
    aliases: ["pachypus", "オペルクリカリア"],
  },
  {
    id: "dioscorea-elephantipes",
    sci: "Dioscorea elephantipes",
    name: "亀甲竜",
    aliases: ["elephantipes"],
  },
  { id: "anthurium", sci: "Anthurium", name: "アンスリウム", aliases: ["anthurium", "アンスリューム"] },
  {
    id: "caudex",
    sci: "Caudex",
    name: "塊根植物",
    aliases: ["コーデックス", "カウデックス", "caudex", "塊根"],
  },
  { id: "begonia", sci: "Begonia", name: "ベゴニア", aliases: ["begonia"] },
];
