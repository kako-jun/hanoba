// 品種タグ辞書（カテゴリ→属→品種・1,909件 / 222属 / 23カテゴリ・#143 / #168 / #214 / #216 / #217 / #218 / #220 / #223 / #409・ユッカ有名種追補）。
//
// 趣味家の通称表記を Web 調査で裏取りした参照データ（読み取り専用・キュレーション済み）。
// hanoba はバックエンドレス（DESIGN §6）なので DB は持たず、これは不変の `Def` データ。
// **TagPicker（#144）が開いた時に動的 import で code-split** されるよう、ここはデータ専用にする
// （静的 import で初期 composer バンドルに載せない）。検索/ドリルダウンは全てクライアントで回る。
//
// カテゴリは「今人気のものを前に出す（似たものはまとめる）」順（多肉→塊根→メセン→サボテン→着生→観葉→
// 食虫→蘭→和もの→シダ→コケ→水草→水生→花→球根→花木→食用→穀物→山菜野草）。基本種・別ジャンル（水草等）は #168 で補完した。
// 穀物は #214、熱帯果樹/芍薬牡丹/山菜野草/属取りこぼしは #216-#220、同名品種の属コンテキスト解決は #223。
// 値は「本文 # に入るタグ文字列」（空白は insertTag 側で _ に正規化）。表記揺れ（赤猫 ↔
// レッドキャットウィーズル 等）は調査が両形を別品種として持つため、そのまま両方を pickable に残す。

/**
 * 閲覧言語ごとの表示名（#409 P2 多言語）。ja は base（`label`/`name`）が原典なのでここには入れない。
 * 非対応言語名が無ければ base に graceful フォールバックする（`pickLoc`・plant-i18n.ts）。
 * **表示専用**＝本文に書き込むタグ・内部キーは常に ja 正準のまま（cross-language filter 要件・独自化禁止）。
 * カテゴリ23（PR1）・属222（PR2）を populate 済み。品種は大半が固有名詞カルティバなので入れない（ja のみ）。
 */
export type Loc = Partial<Record<"en" | "zh" | "es", string>>;

export interface Variety {
  /** 通称（本文 # に入るタグ文字列・ja 正準）。 */
  name: string;
  /** 学名（任意・#147 i18n）。 */
  sci?: string;
  /** 閲覧言語ごとの表示名（任意・#409・品種は固有名詞カルティバなので未 populate＝ja のみ）。英名は `loc.en` に畳む。 */
  loc?: Loc;
  /** 表記揺れ・別名（検索の横断ヒット用）。 */
  aliases?: string[];
}

export interface Genus {
  /** 属／グループ名（ja 正準）。 */
  name: string;
  /** 属名自体がタグになるか（その他/原種 等のグルーピング見出しは false）。 */
  pickable: boolean;
  /** 閲覧言語ごとの表示名（任意・#409・属222は PR2 で populate 済み・en/zh/es）。 */
  loc?: Loc;
  /** 属名の別名（スラッシュ表記・括弧注記の吸収。検索用）。 */
  aliases?: string[];
  varieties: Variety[];
}

export interface VarietyCategory {
  /** カテゴリ名（ja 正準・本文タグ/内部キー）。 */
  label: string;
  /** 閲覧言語ごとの表示名（#409 P2・カテゴリ23は本PRで populate 済み）。 */
  loc?: Loc;
  genera: Genus[];
}

export const VARIETY_CATALOG: VarietyCategory[] = [
  {
    label: "多肉植物",
    loc: { en: "Succulents", zh: "多肉植物", es: "Suculentas" },
    genera: [
      { name: "アガベ", pickable: true, loc: { en: "Agave", zh: "龙舌兰属", es: "Agave" }, varieties: [
        { name: "チタノタ", sci: "Agave titanota" }, { name: "オテロイ", sci: "Agave oteroi" }, { name: "白鯨", sci: "Agave titanota 'Hakugei'" }, { name: "黒鯨", sci: "Agave titanota 'Black Whale'" },
        { name: "福建白鯨", sci: "Agave titanota 'Fukken Hakugei'" }, { name: "大白鯊", sci: "Agave titanota 'Dabaisha'" }, { name: "金鯨", sci: "Agave titanota 'Kingei'" }, { name: "白犀牛", sci: "Agave titanota 'Baixiniu'" },
        { name: "海王", sci: "Agave titanota 'Kaiou'" }, { name: "レッドキャットウィーズル", sci: "Agave titanota 'Red Catweezle'" }, { name: "赤猫", sci: "Agave titanota 'Red Catweezle'" }, { name: "ゴリ猫", sci: "Agave titanota 'Gori Neko'" },
        { name: "地獄猫", sci: "Agave titanota 'Jigoku Neko'" }, { name: "姫厳竜", sci: "Agave titanota 'Hime Genryu'" }, { name: "シーザー", sci: "Agave titanota 'Caesar'" }, { name: "凱撒", sci: "Agave titanota 'Caesar'" },
        { name: "フィリグリー", sci: "Agave titanota 'Filigree'" }, { name: "圓葉拇指", sci: "Agave titanota 'Yuanye Muzhi'" }, { name: "ハデス", sci: "Agave titanota 'Hades'" }, { name: "黒帝斯", sci: "Agave titanota 'Hades'" },
        { name: "恐竜牙歯", sci: "Agave titanota 'Kyoryu Gashi'" }, { name: "ブラックアンドブルー", sci: "Agave titanota 'Black and Blue'" }, { name: "BB", sci: "Agave titanota 'Black and Blue'" }, { name: "白火焔", sci: "Agave titanota 'White Fire'" },
        { name: "ホワイトファイヤー", sci: "Agave titanota 'White Fire'" }, { name: "黒火焔", sci: "Agave titanota 'Black Fire'" }, { name: "ブラックファイヤー", sci: "Agave titanota 'Black Fire'" }, { name: "スナグルトゥース", sci: "Agave titanota 'Snaggletooth'" },
        { name: "烈焔", sci: "Agave titanota 'Lieyan'" }, { name: "ナンバーワン", sci: "Agave titanota 'No.1'" }, { name: "農大No.1", sci: "Agave titanota 'Nodai No.1'" }, { name: "狂刺夕映", sci: "Agave titanota 'Kyoshi Yubae'" },
        { name: "金剛", sci: "Agave titanota 'Kongo'" }, { name: "キングコング", sci: "Agave titanota 'King Kong'" }, { name: "魔丸", sci: "Agave titanota 'Mamaru'" }, { name: "螃蟹", sci: "Agave titanota 'Pangxie'" },
        { name: "追星", sci: "Agave titanota 'Oiboshi'" }, { name: "COK", sci: "Agave titanota 'COK'" }, { name: "清櫻", sci: "Agave titanota 'Seio'" }, { name: "セオ", sci: "Agave titanota 'Seo'" },
        { name: "皇冠", sci: "Agave titanota 'Crown'" }, { name: "クラウン", sci: "Agave titanota 'Crown'" }, { name: "SAD", sci: "Agave titanota 'SAD'" }, { name: "南アフリカダイヤモンド", sci: "Agave titanota 'South Africa Diamond'" },
        { name: "狼人", sci: "Agave titanota 'Langren'" }, { name: "覇王龍", sci: "Agave titanota 'Haouryu'" }, { name: "鳳凰", sci: "Agave titanota 'Hoou'" }, { name: "黒豹", sci: "Agave titanota 'Kurohyo'" },
        { name: "鬼爪", sci: "Agave titanota 'Onizume'" }, { name: "雪峰", sci: "Agave titanota 'Seppou'" }, { name: "柊月", sci: "Agave titanota 'Hiiragizuki'" }, { name: "悪魔くん", sci: "Agave titanota 'Akuma-kun'" },
        { name: "麻花龍", sci: "Agave titanota 'Mahanglong'" }, { name: "シャークソーイ", sci: "Agave titanota 'Shark Soei'" }, { name: "FO-076", sci: "Agave titanota 'FO-076'" }, { name: "笹の雪", sci: "Agave victoriae-reginae", aliases: ["ビクトリアレジーナ"] },
        { name: "吉祥天", sci: "Agave parryi var. truncata" }, { name: "パリー", sci: "Agave parryi" }, { name: "吉祥冠", sci: "Agave potatorum 'Kisshokan'" },
        { name: "雷神", sci: "Agave potatorum" }, { name: "王妃雷神", sci: "Agave potatorum 'Ouhi Raijin'" }, { name: "五色万代", sci: "Agave lophantha 'Quadricolor'" }, { name: "滝の白糸", sci: "Agave schidigera" },
        { name: "乱れ雪", sci: "Agave filifera 'Midaresetsu'" }, { name: "吹上", sci: "Agave stricta", aliases: ["ストリクタ"] }, { name: "アテナータ", sci: "Agave attenuata" },
        { name: "アメリカーナ", sci: "Agave americana" }, { name: "オバティフォリア", sci: "Agave ovatifolia" }, { name: "パラサナ", sci: "Agave parrasana" }, { name: "モンタナ", sci: "Agave montana" },
        { name: "サルミアナ", sci: "Agave salmiana" }, { name: "フェロックス", sci: "Agave salmiana var. ferox" }, { name: "ベネズエラ", sci: "Agave desmetiana 'Variegata'" },
      ] },
      { name: "ユーフォルビア", pickable: true, loc: { en: "Euphorbia", zh: "大戟属", es: "Euphorbia" }, varieties: [
        { name: "オベサ", sci: "Euphorbia obesa" }, { name: "バリダ", sci: "Euphorbia valida" }, { name: "鉄甲丸", sci: "Euphorbia bupleurifolia" }, { name: "ホリダ", sci: "Euphorbia horrida" },
        { name: "ラクテア", sci: "Euphorbia lactea" }, { name: "ホワイトゴースト", sci: "Euphorbia lactea 'White Ghost'" }, { name: "マハラジャ", sci: "Euphorbia lactea 'Cristata'" }, { name: "白樺キリン", sci: "Euphorbia mammillaris 'Variegata'" },
        { name: "瑠璃晃", sci: "Euphorbia suzannae", aliases: ["スザンナエ"] }, { name: "笹蟹丸", sci: "Euphorbia pulvinata" },
        { name: "飛竜", sci: "Euphorbia stellata", aliases: ["ステラータ"] }, { name: "ギラウミニアナ", sci: "Euphorbia guillauminiana" }, { name: "ポイゾニー", sci: "Euphorbia poissonii" }, { name: "デカリー", sci: "Euphorbia decaryi" },
        { name: "峨眉山", sci: "Euphorbia 'Gabizan'" }, { name: "グロボーサ", sci: "Euphorbia globosa", aliases: ["玉鱗宝"] }, { name: "ソテツキリン", sci: "Euphorbia bupleurifolia" },
        { name: "蓬莱島", sci: "Euphorbia bupleurifolia × susannae" }, { name: "奇怪ヶ島", sci: "Euphorbia squarrosa", aliases: ["スクアローサ"] }, { name: "鬼笑い", sci: "Euphorbia knuthii" }, { name: "エクロニー", sci: "Euphorbia ecklonii" },
        { name: "デシデュア", sci: "Euphorbia decidua" }, { name: "トゥレアレンシス", sci: "Euphorbia tulearensis" }, { name: "ブルアナ", sci: "Euphorbia bruynsii" },
        { name: "ダイヤモンドフロスト", sci: "Euphorbia hypericifolia 'Diamond Frost'" },
      ] },
      { name: "チレコドン", pickable: true, loc: { en: "Tylecodon", zh: "奇峰锦属", es: "Tylecodon" }, varieties: [
        { name: "万物想", sci: "Tylecodon reticulatus", aliases: ["レティキュラータス"] }, { name: "阿房宮", sci: "Tylecodon paniculatus", aliases: ["パニクラーツス"] }, { name: "奇峰錦", sci: "Tylecodon wallichii" }, { name: "砂夜叉姫", sci: "Tylecodon pearsonii" },
      ] },
      { name: "コチレドン", pickable: true, loc: { en: "Cotyledon", zh: "银波锦属", es: "Cotyledon" }, varieties: [
        { name: "熊童子", sci: "Cotyledon tomentosa subsp. ladismithiensis" }, { name: "熊童子錦", sci: "Cotyledon tomentosa subsp. ladismithiensis 'Variegata'" }, { name: "子猫の爪", sci: "Cotyledon tomentosa" }, { name: "福娘", sci: "Cotyledon orbiculata var. oophylla" },
        { name: "だるま福娘", sci: "Cotyledon orbiculata 'Daruma'" }, { name: "ふっくら娘", sci: "Cotyledon orbiculata 'Fukkura'" }, { name: "銀波錦", sci: "Cotyledon undulata" }, { name: "ペンデンス", sci: "Cotyledon pendens" },
        { name: "オルビキュラータ", sci: "Cotyledon orbiculata" }, { name: "エリサエ", sci: "Cotyledon elisae" }, { name: "白美人", sci: "Cotyledon orbiculata 'Hakubijin'" }, { name: "パピラリス", sci: "Cotyledon papillaris" },
        { name: "旭波の光", sci: "Cotyledon orbiculata 'Kyokuha no Hikari'" }, { name: "旭波錦", sci: "Cotyledon orbiculata 'Kyokuha Nishiki'" }, { name: "嫁入り娘", sci: "Cotyledon orbiculata 'Yomeiri Musume'" }, { name: "紅覆輪", sci: "Cotyledon orbiculata 'Beni Fukurin'" },
      ] },
      { name: "セネシオ", pickable: true, loc: { en: "Senecio", zh: "千里光属", es: "Senecio" }, varieties: [
        { name: "グリーンネックレス", sci: "Senecio rowleyanus" }, { name: "ドルフィンネックレス", sci: "Senecio peregrinus" }, { name: "ピーチネックレス", sci: "Senecio rowleyanus 'Peach'" }, { name: "ルビーネックレス", sci: "Othonna capensis" },
        { name: "三日月ネックレス", sci: "Senecio radicans" }, { name: "七宝樹", sci: "Senecio articulatus" }, { name: "万宝", sci: "Senecio kleinia" }, { name: "美空鉾", sci: "Senecio antandroi" },
        { name: "銀月", sci: "Senecio haworthii" }, { name: "京童子", sci: "Senecio herreanus" }, { name: "マサイの矢尻", sci: "Senecio kleiniiformis" }, { name: "新月", sci: "Senecio scaposus" },
        { name: "鉄錫杖", sci: "Senecio stapeliiformis" }, { name: "ヤコブセニー", sci: "Senecio jacobsenii" }, { name: "エンジェルティアーズ", sci: "Senecio herreanus 'Angel Tears'" }, { name: "ハリアヌス", sci: "Senecio harrianus" },
      ] },
      { name: "クラッスラ", pickable: true, loc: { en: "Crassula", zh: "青锁龙属", es: "Crassula" }, varieties: [
        { name: "火祭り", sci: "Crassula capitella 'Campfire'" }, { name: "銀盃", sci: "Crassula arborescens 'Blue Bird'" }, { name: "神刀", sci: "Crassula perfoliata var. falcata" }, { name: "茜の塔", sci: "Crassula corymbulosa" },
        { name: "星の王子", sci: "Crassula perforata" }, { name: "桜星", sci: "Crassula 'Sakura Boshi'" }, { name: "紅稚児", sci: "Crassula pubescens subsp. radicans" }, { name: "若緑", sci: "Crassula muscosa 'Pseudolycopodioides'" },
        { name: "数珠星", sci: "Crassula rupestris subsp. marnieriana" }, { name: "南十字星", sci: "Crassula perforata 'Variegata'" }, { name: "ゴーラム", sci: "Crassula ovata 'Gollum'" }, { name: "宇宙の木", sci: "Crassula ovata 'Hobbit'" },
        { name: "リトルミッシー", sci: "Crassula pellucida subsp. marginalis 'Little Missy'" }, { name: "マネーメーカー", sci: "Crassula ovata 'Money Maker'" }, { name: "玉椿", sci: "Crassula barklyi" }, { name: "呂千絵", sci: "Crassula 'Moonglow'" },
        { name: "舞乙女", sci: "Crassula rupestris subsp. marnieriana 'Hottentot'" }, { name: "緑塔", sci: "Crassula pyramidalis" }, { name: "ブロウメアナ", sci: "Crassula expansa subsp. fragilis" }, { name: "ムスコーサ", sci: "Crassula muscosa" },
      ] },
      { name: "カランコエ", pickable: true, loc: { en: "Kalanchoe", zh: "伽蓝菜属", es: "Kalanchoe" }, varieties: [
        { name: "月兎耳", sci: "Kalanchoe tomentosa" }, { name: "福兎耳", sci: "Kalanchoe eriophylla" }, { name: "黒兎耳", sci: "Kalanchoe tomentosa 'Chocolate Soldier'" }, { name: "唐印", sci: "Kalanchoe luciae" },
        { name: "デザートローズ", sci: "Kalanchoe thyrsiflora" }, { name: "仙女の舞", sci: "Kalanchoe beharensis", aliases: ["ベハレンシス"] }, { name: "胡蝶の舞", sci: "Kalanchoe laxiflora" }, { name: "白銀の舞", sci: "Kalanchoe pumila" },
        { name: "不死鳥", sci: "Kalanchoe daigremontiana × delagoensis" }, { name: "子宝草", sci: "Kalanchoe daigremontiana × delagoensis" }, { name: "朱蓮", sci: "Kalanchoe longiflora var. coccinea" }, { name: "ミロッティー", sci: "Kalanchoe millotii" },
        { name: "チョコレートソルジャー", sci: "Kalanchoe tomentosa 'Chocolate Soldier'" }, { name: "ファング", sci: "Kalanchoe beharensis 'Fang'" },
      ] },
      { name: "アロエ", pickable: true, loc: { en: "Aloe", zh: "芦荟属", es: "Aloe" }, varieties: [
        { name: "ディコトマ", sci: "Aloidendron dichotomum" }, { name: "ポリフィラ", sci: "Aloe polyphylla" }, { name: "不夜城", sci: "Aloe nobilis" }, { name: "千代田錦", sci: "Aloe variegata" },
        { name: "ハオルチオイデス", sci: "Aloe haworthioides" }, { name: "キダチアロエ", sci: "Aloe arborescens" }, { name: "羅紋錦", sci: "Aloe striata" }, { name: "鬼ヒトデ", sci: "Aloe humilis" },
        { name: "プリカティリス", sci: "Kumara plicatilis" }, { name: "アロエベラ", sci: "Aloe vera" }, { name: "ペグレラエ", sci: "Aloe peglerae" }, { name: "綾錦", sci: "Aloe aristata" },
        { name: "帝王錦", sci: "Aloe humilis 'Globosa'" },
      ] },
      { name: "ガステリア", pickable: true, loc: { en: "Gasteria", zh: "鲨鱼掌属", es: "Gasteria" }, varieties: [
        { name: "臥牛", sci: "Gasteria armstrongii" }, { name: "グロメラータ", sci: "Gasteria glomerata" }, { name: "バイリシアナ", sci: "Gasteria baylissiana" }, { name: "子宝錦", sci: "Gasteria gracilis var. minima 'Variegata'" },
      ] },
      { name: "ハオルチア", pickable: true, loc: { en: "Haworthia", zh: "十二卷属", es: "Haworthia" }, varieties: [
        { name: "オブツーサ", sci: "Haworthia cooperi var. truncata" }, { name: "ブラックオブツーサ", sci: "Haworthia cooperi 'Black Obtusa'" }, { name: "雫石", sci: "Haworthia cooperi var. truncata 'Shizukuishi'" }, { name: "レツーサ", sci: "Haworthia retusa", aliases: ["寿"] },
        { name: "コレクタ", sci: "Haworthia correcta" }, { name: "京の舞", sci: "Haworthia 'Kyo no Mai'" }, { name: "玉扇", sci: "Haworthia truncata" }, { name: "万象", sci: "Haworthia maughanii" },
        { name: "ピクタ", sci: "Haworthia picta" }, { name: "スプレンデンス", sci: "Haworthia splendens" }, { name: "クーペリー", sci: "Haworthia cooperi" },
        { name: "ベヌスタ", sci: "Haworthia cooperi var. venusta" }, { name: "ムチカ", sci: "Haworthia mutica" }, { name: "十二の巻", sci: "Haworthiopsis fasciata" }, { name: "竜鱗", sci: "Haworthiopsis tessellata" },
        { name: "宝草", sci: "Haworthia cuspidata" },
      ] },
      { name: "エケベリア", pickable: true, loc: { en: "Echeveria", zh: "拟石莲花属", es: "Echeveria" }, varieties: [
        { name: "ラウイ", sci: "Echeveria laui" }, { name: "七福神", sci: "Echeveria secunda 'Shichifukujin'" }, { name: "桃太郎", sci: "Echeveria 'Momotarou'" }, { name: "パールフォンニュルンベルク", sci: "Echeveria 'Perle von Nürnberg'" },
        { name: "高砂の翁", sci: "Echeveria 'Takasago no Okina'" }, { name: "ピンクザラゴーサ", sci: "Echeveria 'Pink Zaragosa'" }, { name: "ザラゴーサ", sci: "Echeveria 'Zaragosa'" }, { name: "アガボイデス", sci: "Echeveria agavoides" },
        { name: "リップスティック", sci: "Echeveria agavoides 'Lipstick'" }, { name: "静夜", sci: "Echeveria derenbergii" }, { name: "花うらら", sci: "Echeveria pulidonis" }, { name: "ローラ", sci: "Echeveria 'Lola'" },
        { name: "デレッセーナ", sci: "Echeveria 'Dereseana'" }, { name: "アフターグロー", sci: "Echeveria 'Afterglow'" }, { name: "トップシータービー", sci: "Echeveria runyonii 'Topsy Turvy'" }, { name: "沙羅姫牡丹", sci: "Echeveria 'Sarahime Botan'" },
        { name: "白鳳", sci: "Echeveria 'Hakuhou'" }, { name: "エレガンス", sci: "Echeveria elegans" }, { name: "シャビアナ", sci: "Echeveria shaviana" }, { name: "リラシナ", sci: "Echeveria lilacina" },
        { name: "ロメオ", sci: "Echeveria agavoides 'Romeo'" }, { name: "ロメオルビン", sci: "Echeveria agavoides 'Romeo Rubin'" }, { name: "ラウリンゼ", sci: "Echeveria 'Laulindsa'" }, { name: "ハムシー", sci: "Echeveria harmsii" },
        { name: "チワワエンシス", sci: "Echeveria chihuahuaensis" }, { name: "モンロー", sci: "Echeveria 'Monroe'" }, { name: "ブルードラゴン", sci: "Echeveria 'Blue Dragon'" }, { name: "スノーフェイス", sci: "Echeveria 'Snow Face'" },
        { name: "アイスローズ", sci: "Echeveria 'Ice Rose'" }, { name: "オンスロー", sci: "Echeveria 'Onslow'" }, { name: "コロラータ", sci: "Echeveria colorata" }, { name: "パープルクイーン", sci: "Echeveria 'Purple Queen'" },
        { name: "アイスバーグ", sci: "Echeveria 'Iceberg'" }, { name: "ルブラ", sci: "Echeveria agavoides 'Rubra'" }, { name: "レモンローズ", sci: "Echeveria 'Lemon Rose'" }, { name: "水蜜桃", sci: "Echeveria 'Suimitsutou'" },
        { name: "スポテッドディア", sci: "Echeveria 'Spotted Deer'" }, { name: "クリスマス", sci: "Echeveria agavoides 'Christmas'" }, { name: "エボニー", sci: "Echeveria agavoides 'Ebony'" }, { name: "ザラゴーサノヴァ", sci: "Echeveria 'Zaragosa Nova'" },
        { name: "メキシカンジャイアント", sci: "Echeveria 'Mexican Giant'" },
      ] },
      { name: "グラプトペタルム", pickable: true, loc: { en: "Graptopetalum", zh: "风车草属", es: "Graptopetalum" }, varieties: [
        { name: "朧月", sci: "Graptopetalum paraguayense", aliases: ["パラグアイエンセ"] }, { name: "姫秋麗", sci: "Graptopetalum mendozae" }, { name: "ブロンズ姫", sci: "Graptosedum 'Bronze'" }, { name: "銀天女", sci: "Graptopetalum rusbyi" },
        { name: "秋麗", sci: "Graptosedum 'Francesco Baldi'" }, { name: "ダルマ秋麗", sci: "Graptosedum 'Francesco Baldi Compactum'" }, { name: "淡雪", sci: "Graptopetalum 'Awayuki'" },
      ] },
      { name: "セダム", pickable: true, loc: { en: "Sedum", zh: "景天属", es: "Sedum" }, varieties: [
        { name: "虹の玉", sci: "Sedum × rubrotinctum" }, { name: "オーロラ", sci: "Sedum × rubrotinctum 'Aurora'" }, { name: "乙女心", sci: "Sedum pachyphyllum" }, { name: "玉つづり", sci: "Sedum morganianum" },
        { name: "銘月", sci: "Sedum adolphi" }, { name: "黄麗", sci: "Sedum adolphi 'Golden Glow'" }, { name: "春萌", sci: "Sedum 'Alice Evans'" }, { name: "万年草", sci: "Sedum mexicanum" },
        { name: "レッドベリー", sci: "Sedum rubrotinctum 'Redberry'" }, { name: "アトランティス", sci: "Sedum takesimense 'Atlantis'" }, { name: "リトルミッシー", sci: "Sedum 'Little Missy'" }, { name: "パープルヘイズ", sci: "Sedum dasyphyllum 'Purple Haze'" },
        { name: "新玉つづり", sci: "Sedum 'Little Gem'" }, { name: "ヒスパニクム", sci: "Sedum hispanicum" },
      ] },
      { name: "パキフィツム", pickable: true, loc: { en: "Pachyphytum", zh: "厚叶草属", es: "Pachyphytum" }, varieties: [
        { name: "桃美人", sci: "Pachyphytum 'Momobijin'" }, { name: "星美人", sci: "Pachyphytum oviferum" }, { name: "月美人", sci: "Pachyphytum 'Tsukibijin'" },
        { name: "ベビーフィンガー", sci: "Pachyphytum 'Baby Finger'" }, { name: "千代田の松", sci: "Pachyphytum compactum" }, { name: "京美人", sci: "Pachyphytum 'Kyobijin'" }, { name: "フーケリー", sci: "Pachyphytum hookeri", aliases: ["群雀"] },
      ] },
      { name: "アエオニウム", pickable: true, loc: { en: "Aeonium", zh: "莲花掌属", es: "Aeonium" }, varieties: [
        { name: "黒法師", sci: "Aeonium arboreum 'Atropurpureum'" }, { name: "サンバースト", sci: "Aeonium 'Sunburst'" }, { name: "夕映", sci: "Aeonium decorum f. variegata" }, { name: "愛染錦", sci: "Aeonium × domesticum 'Variegatum'" },
        { name: "カシミアバイオレット", sci: "Aeonium 'Cashmere Violet'" }, { name: "小人の祭り", sci: "Aeonium sedifolium" },
      ] },
      { name: "センペルビウム", pickable: true, loc: { en: "Sempervivum", zh: "长生草属", es: "Sempervivum" }, varieties: [
        { name: "巻絹", sci: "Sempervivum arachnoideum" }, { name: "オウレウム", sci: "Sempervivum tectorum 'Aureum'" }, { name: "ルビーハート", sci: "Sempervivum 'Ruby Heart'" },
      ] },
      { name: "グラプトベリア", pickable: true, loc: { en: "Graptoveria", zh: "风车石莲属", es: "Graptoveria" }, varieties: [
        { name: "デビー", sci: "×Graptoveria 'Debbie'" }, { name: "白牡丹", sci: "×Graptoveria 'Titubans'" }, { name: "ピンクプリティ", sci: "×Graptoveria 'Pink Pretty'" },
      ] },
      { name: "セデベリア", pickable: true, loc: { en: "Sedeveria", zh: "景天石莲属", es: "Sedeveria" }, varieties: [
        { name: "樹氷", sci: "×Sedeveria 'Juhyo'" }, { name: "レティジア", sci: "×Sedeveria 'Letizia'" },
      ] },
    ],
  },
  {
    label: "塊根植物",
    loc: { en: "Caudex Plants", zh: "块根植物", es: "Plantas Caudiciformes" },
    genera: [
      { name: "パキポディウム", pickable: true, loc: { en: "Pachypodium", zh: "棒锤树属", es: "Pachypodium" }, varieties: [
        { name: "グラキリス", sci: "Pachypodium rosulatum var. gracilius", aliases: ["象牙宮"] }, { name: "ブレビカウレ", sci: "Pachypodium brevicaule", aliases: ["恵比寿笑い"] },
        { name: "恵比寿大黒", sci: "Pachypodium 'Densicaule'" }, { name: "デンシフローラム", sci: "Pachypodium densiflorum" }, { name: "ウィンゾリー", sci: "Pachypodium windsorii" }, { name: "ラメリー", sci: "Pachypodium lamerei" },
        { name: "ゲアイー", sci: "Pachypodium geayi" }, { name: "ロスラーツム", sci: "Pachypodium rosulatum" }, { name: "カクチペス", sci: "Pachypodium rosulatum subsp. cactipes" }, { name: "レウコキサンツム", sci: "Pachypodium rosulatum subsp. leucoxanthum" },
        { name: "エブルネウム", sci: "Pachypodium eburneum" }, { name: "ホロンベンセ", sci: "Pachypodium horombense" }, { name: "イノピナツム", sci: "Pachypodium rosulatum subsp. inopinatum" }, { name: "マカイエンセ", sci: "Pachypodium makayense" },
        { name: "ラモスム", sci: "Pachypodium ramosum" }, { name: "フィヘレネンセ", sci: "Pachypodium lamerei var. fiherenense" }, { name: "デカリー", sci: "Pachypodium decaryi" }, { name: "ルーテンベルギアヌム", sci: "Pachypodium rutenbergianum" },
        { name: "アンボンゲンセ", sci: "Pachypodium ambongense" }, { name: "バロニー", sci: "Pachypodium baronii" }, { name: "サンデルシー", sci: "Pachypodium saundersii", aliases: ["白馬城"] },
        { name: "ビスピノーサム", sci: "Pachypodium bispinosum" }, { name: "サキュレンタム", sci: "Pachypodium succulentum" }, { name: "ナマクアナム", sci: "Pachypodium namaquanum", aliases: ["光堂"] },
        { name: "リーアリー", sci: "Pachypodium lealii" },
      ] },
      { name: "アデニウム", pickable: true, loc: { en: "Adenium", zh: "天宝花属", es: "Adenium" }, varieties: [
        { name: "オベスム", sci: "Adenium obesum", aliases: ["砂漠のバラ"] }, { name: "アラビカム", sci: "Adenium arabicum" }, { name: "ソコトラナム", sci: "Adenium socotranum" },
        { name: "ソマレンセ", sci: "Adenium somalense" },
      ] },
      { name: "オペルクリカリア", pickable: true, loc: { en: "Operculicarya", zh: "刘氏漆属", es: "Operculicarya" }, varieties: [
        { name: "パキプス", sci: "Operculicarya pachypus" }, { name: "デカリー", sci: "Operculicarya decaryi" },
      ] },
      { name: "ディオスコレア", pickable: true, loc: { en: "Dioscorea", zh: "薯蓣属", es: "Dioscorea" }, varieties: [
        { name: "亀甲竜", sci: "Dioscorea elephantipes", aliases: ["エレファンティペス"] }, { name: "アフリカ亀甲竜", sci: "Dioscorea sylvatica" },
      ] },
      { name: "ステファニア", pickable: true, loc: { en: "Stephania", zh: "千金藤属", es: "Stephania" }, varieties: [
        { name: "エレクタ", sci: "Stephania erecta" }, { name: "ピエレイ", sci: "Stephania pierrei" }, { name: "スベローサ", sci: "Stephania suberosa" },
      ] },
      { name: "アデニア", pickable: true, loc: { en: "Adenia", zh: "蒴莲属", es: "Adenia" }, varieties: [
        { name: "グラウカ", sci: "Adenia glauca" }, { name: "グロボーサ", sci: "Adenia globosa" }, { name: "スピノーサ", sci: "Adenia spinosa" },
      ] },
      { name: "ドルステニア", pickable: true, loc: { en: "Dorstenia", zh: "琉桑属", es: "Dorstenia" }, varieties: [
        { name: "ギガス", sci: "Dorstenia gigas" }, { name: "フォエチダ", sci: "Dorstenia foetida" },
      ] },
      { name: "ボスウェリア", pickable: true, loc: { en: "Boswellia", zh: "乳香属", es: "Boswellia" }, varieties: [
        { name: "サクラ", sci: "Boswellia sacra" }, { name: "ネアリー", sci: "Boswellia neglecta" },
      ] },
      { name: "ブルセラ", pickable: true, loc: { en: "Bursera", zh: "裂榄属", es: "Bursera" }, varieties: [
        { name: "ファガロイデス", sci: "Bursera fagaroides" }, { name: "ミクロフィラ", sci: "Bursera microphylla" },
      ] },
      { name: "フォークイエリア", pickable: true, loc: { en: "Fouquieria", zh: "福桂树属", es: "Fouquieria" }, varieties: [
        { name: "ファシクラータ", sci: "Fouquieria fasciculata" }, { name: "コルムナリス", sci: "Fouquieria columnaris" }, { name: "ディグエッティ", sci: "Fouquieria diguetii" }, { name: "プルプシー", sci: "Fouquieria purpusii" },
      ] },
      { name: "ペラルゴニウム", pickable: true, loc: { en: "Pelargonium", zh: "天竺葵属", es: "Pelargonium" }, aliases: ["塊根"], varieties: [
        { name: "アペンディクラツム", sci: "Pelargonium appendiculatum" }, { name: "ミラビレ", sci: "Pelargonium mirabile" }, { name: "カルノーサム", sci: "Pelargonium carnosum" },
      ] },
      { name: "その他塊根", pickable: false, loc: { en: "Other caudex plants", zh: "其他块根植物", es: "Otras plantas caudiciformes" }, varieties: [
        { name: "火星人", sci: "Fockea edulis", aliases: ["フォッケア"] }, { name: "モンソニア", sci: "Monsonia sp." }, { name: "サルコカウロン", sci: "Sarcocaulon sp." },
        { name: "オトンナ", sci: "Othonna sp." }, { name: "キフォステンマ", sci: "Cyphostemma juttae" }, { name: "フィカス ペティオラリス", sci: "Ficus petiolaris" }, { name: "ブーファン", sci: "Boophone disticha" },
        { name: "ウンカリーナ", sci: "Uncarina grandidieri" }, { name: "パキコルムス", sci: "Pachycormus discolor" }, { name: "ゲラルダンサス", sci: "Gerrardanthus macrorhizus" }, { name: "ヤトロファ", sci: "Jatropha sp." },
        { name: "センナ メリディオナリス", sci: "Senna meridionalis" }, { name: "サンセベリア", sci: "Sansevieria sp." }, { name: "スタッキー", sci: "Sansevieria stuckyi" },
      ] },
    ],
  },
  {
    label: "メセン",
    loc: { en: "Mesembs", zh: "女仙", es: "Mesembs" },
    genera: [
      { name: "コノフィツム", pickable: true, loc: { en: "Conophytum", zh: "肉锥花属", es: "Conophytum" }, varieties: [
        { name: "ウィッテベルゲンセ", sci: "Conophytum wittebergense" }, { name: "ブルゲリ", sci: "Conophytum burgeri" }, { name: "オペラローズ", sci: "Conophytum 'Opera Rose'" }, { name: "花園", sci: "Conophytum 'Hanazono'" },
        { name: "ペルシダム", sci: "Conophytum pellucidum" }, { name: "玉彦", sci: "Conophytum flavum" }, { name: "マウガニー", sci: "Conophytum maughanii" }, { name: "群碧玉", sci: "Conophytum minutum" },
        { name: "寂光", sci: "Conophytum frutescens" }, { name: "円空玉", sci: "Conophytum ectypum" },
      ] },
      { name: "リトープス", pickable: true, loc: { en: "Lithops", zh: "生石花属", es: "Lithops" }, varieties: [
        { name: "日輪玉", sci: "Lithops aucampiae" }, { name: "福来玉", sci: "Lithops julii subsp. fulleri" }, { name: "紫勲", sci: "Lithops lesliei" }, { name: "大津絵", sci: "Lithops otzeniana" },
        { name: "オリーブ玉", sci: "Lithops olivacea" }, { name: "麗虹玉", sci: "Lithops dorotheae" }, { name: "招福玉", sci: "Lithops bromfieldii" }, { name: "富貴玉", sci: "Lithops hookeri" },
        { name: "紅大内玉", sci: "Lithops optica 'Rubra'" }, { name: "巴里玉", sci: "Lithops hallii" }, { name: "花紋玉", sci: "Lithops karasmontana" }, { name: "李夫人", sci: "Lithops salicola" },
      ] },
      { name: "フェネストラリア", pickable: true, loc: { en: "Fenestraria", zh: "窗玉属", es: "Fenestraria" }, varieties: [
        { name: "五十鈴玉", sci: "Fenestraria rhopalophylla subsp. aurantiaca" }, { name: "群玉", sci: "Fenestraria rhopalophylla" },
      ] },
      { name: "プレイオスピロス", pickable: true, loc: { en: "Pleiospilos", zh: "对叶花属", es: "Pleiospilos" }, varieties: [
        { name: "帝玉", sci: "Pleiospilos nelii" }, { name: "紫帝玉", sci: "Pleiospilos nelii 'Royal Flush'" }, { name: "鳳卵", sci: "Pleiospilos bolusii" },
      ] },
      { name: "フォーカリア", pickable: true, loc: { en: "Faucaria", zh: "肉黄菊属", es: "Faucaria" }, varieties: [
        { name: "怒涛", sci: "Faucaria tuberculosa" }, { name: "四海波", sci: "Faucaria tigrina" }, { name: "雪波", sci: "Faucaria felina" },
      ] },
      { name: "チタノプシス", pickable: true, loc: { en: "Titanopsis", zh: "天女属", es: "Titanopsis" }, varieties: [
        { name: "天女", sci: "Titanopsis calcarea", aliases: ["カルカレア"] },
      ] },
      { name: "アルギロデルマ", pickable: true, loc: { en: "Argyroderma", zh: "妖玉属", es: "Argyroderma" }, varieties: [
        { name: "金鈴", sci: "Argyroderma delaetii" }, { name: "国宝玉", sci: "Argyroderma delaetii" },
      ] },
      { name: "ギバエウム", pickable: true, loc: { en: "Gibbaeum", zh: "藻玲玉属", es: "Gibbaeum" }, varieties: [
        { name: "無比玉", sci: "Gibbaeum velutinum" }, { name: "銀光玉", sci: "Gibbaeum heathii" },
      ] },
      { name: "ディンテランサス", pickable: true, loc: { en: "Dinteranthus", zh: "春桃玉属", es: "Dinteranthus" }, varieties: [
        { name: "南蛮玉", sci: "Dinteranthus vanzylii" }, { name: "幻玉", sci: "Dinteranthus wilmotianus" },
      ] },
      { name: "フリチア", pickable: true, loc: { en: "Frithia", zh: "光玉属", es: "Frithia" }, varieties: [
        { name: "光玉", sci: "Frithia pulchra" },
      ] },
    ],
  },
  {
    label: "サボテン",
    loc: { en: "Cacti", zh: "仙人掌", es: "Cactus" },
    genera: [
      { name: "マミラリア", pickable: true, loc: { en: "Mammillaria", zh: "乳突球属", es: "Mammillaria" }, varieties: [
        { name: "玉翁", sci: "Mammillaria hahniana" }, { name: "白星", sci: "Mammillaria plumosa" }, { name: "金洋丸", sci: "Mammillaria marksiana" }, { name: "高砂", sci: "Mammillaria bocasana" },
        { name: "ピコ", sci: "Mammillaria spinosissima 'Un Pico'" }, { name: "内裏玉", sci: "Mammillaria perezdelarosae" }, { name: "月影丸", sci: "Mammillaria zeilmanniana" }, { name: "明星", sci: "Mammillaria schiedeana" },
        { name: "豊明丸", sci: "Mammillaria bombycina" }, { name: "白鳥", sci: "Mammillaria herrerae" }, { name: "カルメナエ", sci: "Mammillaria carmenae" }, { name: "猩々丸", sci: "Mammillaria spinosissima" },
      ] },
      { name: "アストロフィツム", pickable: true, loc: { en: "Astrophytum", zh: "星球属", es: "Astrophytum" }, varieties: [
        { name: "兜", sci: "Astrophytum asterias", aliases: ["兜丸"] }, { name: "スーパー兜", sci: "Astrophytum asterias 'Super Kabuto'" }, { name: "ゼブラスーパー兜", sci: "Astrophytum asterias 'Zebra Super Kabuto'" },
        { name: "アロースーパー兜", sci: "Astrophytum asterias 'Arrow Super Kabuto'" }, { name: "V兜", sci: "Astrophytum asterias 'V Kabuto'" }, { name: "ランポー玉", sci: "Astrophytum myriostigma", aliases: ["鸞鳳玉"] },
        { name: "般若", sci: "Astrophytum ornatum" }, { name: "瑞鳳玉", sci: "Astrophytum capricorne" }, { name: "恩塚ランポー", sci: "Astrophytum myriostigma 'Onzuka'" }, { name: "ヘキラン", sci: "Astrophytum myriostigma var. nudum" },
        { name: "兜錦", sci: "Astrophytum asterias f. variegata" },
      ] },
      { name: "ギムノカリキウム", pickable: true, loc: { en: "Gymnocalycium", zh: "裸萼球属", es: "Gymnocalycium" }, varieties: [
        { name: "緋牡丹", sci: "Gymnocalycium mihanovichii 'Hibotan'" }, { name: "緋牡丹錦", sci: "Gymnocalycium mihanovichii f. variegata" }, { name: "牡丹玉", sci: "Gymnocalycium mihanovichii" }, { name: "LB2178", sci: "Gymnocalycium friedrichii 'LB2178'" },
        { name: "海王丸", sci: "Gymnocalycium denudatum 'Kaiomaru'" }, { name: "怪竜丸", sci: "Gymnocalycium bodenbenderianum" }, { name: "新天地", sci: "Gymnocalycium saglionis" }, { name: "天平丸", sci: "Gymnocalycium spegazzinii" },
        { name: "緋花玉", sci: "Gymnocalycium baldianum" }, { name: "翠晃冠", sci: "Gymnocalycium anisitsii" }, { name: "光琳玉", sci: "Gymnocalycium cardenasianum" }, { name: "麗蛇丸", sci: "Gymnocalycium damsii" },
      ] },
      { name: "エキノカクタス", pickable: true, loc: { en: "Echinocactus", zh: "金琥属", es: "Echinocactus" }, varieties: [
        { name: "金鯱", sci: "Echinocactus grusonii" }, { name: "太平丸", sci: "Echinocactus horizonthalonius" }, { name: "雷帝", sci: "Echinocactus horizonthalonius 'Raitei'" }, { name: "王冠竜", sci: "Echinocactus polycephalus" },
        { name: "春雷", sci: "Echinocactus horizonthalonius 'Shunrai'" }, { name: "尖光丸", sci: "Echinocactus horizonthalonius var. nicholii" },
      ] },
      { name: "ロフォフォラ", pickable: true, loc: { en: "Lophophora", zh: "乌羽玉属", es: "Lophophora" }, varieties: [
        { name: "烏羽玉", sci: "Lophophora williamsii" }, { name: "翠冠玉", sci: "Lophophora diffusa" }, { name: "銀冠玉", sci: "Lophophora williamsii var. decipiens" }, { name: "子吹烏羽玉", sci: "Lophophora williamsii f. caespitosa" },
      ] },
      { name: "フェロカクタス", pickable: true, loc: { en: "Ferocactus", zh: "强刺球属", es: "Ferocactus" }, varieties: [
        { name: "日の出丸", sci: "Ferocactus latispinus" }, { name: "江守玉", sci: "Ferocactus emoryi" }, { name: "金冠竜", sci: "Ferocactus chrysacanthus" }, { name: "太陽", sci: "Ferocactus echidne" },
        { name: "王虎", sci: "Ferocactus glaucescens" }, { name: "赤刺金冠竜", sci: "Ferocactus chrysacanthus f. rubrispinus" },
      ] },
      { name: "エキノプシス", pickable: true, loc: { en: "Echinopsis", zh: "仙人球属", es: "Echinopsis" }, varieties: [
        { name: "短毛丸", sci: "Echinopsis eyriesii" }, { name: "花盛丸", sci: "Echinopsis oxygona" }, { name: "世界の図", sci: "Echinopsis eyriesii f. variegata" },
      ] },
      { name: "パロディア", pickable: true, loc: { en: "Parodia", zh: "锦绣玉属", es: "Parodia" }, varieties: [
        { name: "獅子王丸", sci: "Parodia chrysacanthion" }, { name: "英冠玉", sci: "Parodia magnifica" }, { name: "金晃丸", sci: "Parodia leninghausii" }, { name: "青王丸", sci: "Parodia ottonis" },
      ] },
      { name: "ツルビニカルプス", pickable: true, loc: { en: "Turbinicarpus", zh: "姣丽球属", es: "Turbinicarpus" }, varieties: [
        { name: "烏城丸", sci: "Turbinicarpus schmiedickeanus subsp. flaviflorus" }, { name: "精巧丸", sci: "Turbinicarpus pseudopectinatus" }, { name: "昇竜丸", sci: "Turbinicarpus schmiedickeanus" }, { name: "牙城丸", sci: "Turbinicarpus macrochele" },
        { name: "ミニマ", sci: "Turbinicarpus pseudomacrochele subsp. minimus" }, { name: "長城丸", sci: "Turbinicarpus schmiedickeanus subsp. klinkerianus" },
      ] },
      { name: "テロカクタス", pickable: true, loc: { en: "Thelocactus", zh: "天晃玉属", es: "Thelocactus" }, varieties: [
        { name: "緋冠竜", sci: "Thelocactus hexaedrophorus var. fossulatus" }, { name: "大統領", sci: "Thelocactus bicolor" }, { name: "天晃", sci: "Thelocactus hexaedrophorus" },
      ] },
      { name: "アリオカルプス", pickable: true, loc: { en: "Ariocarpus", zh: "岩牡丹属", es: "Ariocarpus" }, varieties: [
        { name: "岩牡丹", sci: "Ariocarpus retusus" }, { name: "亀甲牡丹", sci: "Ariocarpus fissuratus" }, { name: "玉牡丹", sci: "Ariocarpus retusus f. pectinatus" }, { name: "黒牡丹", sci: "Ariocarpus kotschoubeyanus" },
        { name: "花牡丹", sci: "Ariocarpus furfuraceus" }, { name: "象牙牡丹", sci: "Ariocarpus furfuraceus 'Magnificum'" }, { name: "三角牡丹", sci: "Ariocarpus trigonus" }, { name: "連山", sci: "Ariocarpus fissuratus var. lloydii" },
        { name: "亀甲牡丹ゴジラ", sci: "Ariocarpus fissuratus 'Godzilla'" },
      ] },
      { name: "その他", pickable: false, loc: { en: "Others", zh: "其他", es: "Otros" }, varieties: [
        { name: "月世界", sci: "Epithelantha micromeris" }, { name: "小人の帽子", sci: "Epithelantha bokei" }, { name: "鬼面角", sci: "Cereus repandus" }, { name: "残雪の峰", sci: "Cereus spegazzinii" },
        { name: "山影丸", sci: "Gymnocalycium quehlianum" },
      ] },
    ],
  },
  {
    label: "ビカクシダ",
    loc: { en: "Staghorn Ferns", zh: "鹿角蕨", es: "Helechos Cuerno de Alce" },
    genera: [
      { name: "原種", pickable: false, loc: { en: "Wild species", zh: "原种", es: "Especies silvestres" }, varieties: [
        { name: "リドレイ", sci: "Platycerium ridleyi" }, { name: "ウィリンキー", sci: "Platycerium willinckii" },
        { name: "グランデ", sci: "Platycerium grande" }, { name: "コロナリウム", sci: "Platycerium coronarium" }, { name: "ビフルカツム", sci: "Platycerium bifurcatum" }, { name: "エレファントティス", sci: "Platycerium elephantotis" },
        { name: "ベイチー", sci: "Platycerium veitchii", aliases: ["ヴェイチー"] }, { name: "ステマリア", sci: "Platycerium stemaria" }, { name: "ヒリー", sci: "Platycerium hillii" },
        { name: "スパーバム", sci: "Platycerium superbum" }, { name: "マダガスカリエンセ", sci: "Platycerium madagascariense" }, { name: "ワンダエ", sci: "Platycerium wandae" }, { name: "アルシコルネ", sci: "Platycerium alcicorne" },
        { name: "ホルタミー", sci: "Platycerium holttumii" }, { name: "ワリチー", sci: "Platycerium wallichii" }, { name: "エリシー", sci: "Platycerium ellisii" }, { name: "クアドリディコトマム", sci: "Platycerium quadridichotomum" },
        { name: "アンゴレンセ", sci: "Platycerium angolense" }, { name: "アンディナム", sci: "Platycerium andinum" }, { name: "ヴァッセイ", sci: "Platycerium vassei" },
      ] },
      { name: "交配・園芸品種", pickable: false, loc: { en: "Hybrids & cultivars", zh: "杂交与园艺品种", es: "Híbridos y cultivares" }, varieties: [
        { name: "ネザーランド", sci: "Platycerium bifurcatum 'Netherlands'" }, { name: "ネザーランズ", sci: "Platycerium bifurcatum 'Netherlands'" }, { name: "グリフィン", sci: "Platycerium 'Griffin'" }, { name: "キッチャクード", sci: "Platycerium 'Kitshakood'" },
        { name: "ホワイトホーク", sci: "Platycerium 'White Hawk'" }, { name: "ペドロ", sci: "Platycerium 'Pedro'" }, { name: "ドラゴン", sci: "Platycerium 'Dragon'" }, { name: "キリン", sci: "Platycerium 'Kirin'" },
        { name: "ギンガ", sci: "Platycerium 'Ginga'" }, { name: "スザク", sci: "Platycerium 'Suzaku'" }, { name: "ジェイドガール", sci: "Platycerium 'Jade Girl'" }, { name: "ペガサス", sci: "Platycerium 'Pegasus'" },
      ] },
    ],
  },
  {
    label: "エアプランツ",
    loc: { en: "Air Plants", zh: "空气凤梨", es: "Plantas de Aire" },
    genera: [
      { name: "チランジア", pickable: true, loc: { en: "Tillandsia", zh: "铁兰属", es: "Tillandsia" }, varieties: [
        { name: "エアプランツ", sci: "Tillandsia" }, { name: "イオナンタ", sci: "Tillandsia ionantha" }, { name: "ウスネオイデス", sci: "Tillandsia usneoides" }, { name: "キセログラフィカ", sci: "Tillandsia xerographica" },
        { name: "ストレプトフィラ", sci: "Tillandsia streptophylla" }, { name: "カピタータ", sci: "Tillandsia capitata" }, { name: "ブルボーサ", sci: "Tillandsia bulbosa" },
        { name: "フクシー", sci: "Tillandsia fuchsii", aliases: ["フックシー"] }, { name: "テクトラム", sci: "Tillandsia tectorum" }, { name: "ハリシー", sci: "Tillandsia harrisii" }, { name: "コットンキャンディ", sci: "Tillandsia 'Cotton Candy'" },
        { name: "ジュンセア", sci: "Tillandsia juncea" }, { name: "カプトメドゥーサエ", sci: "Tillandsia caput-medusae" }, { name: "ブラキカウロス", sci: "Tillandsia brachycaulos" }, { name: "ベルゲリ", sci: "Tillandsia bergeri" },
        { name: "ドゥラティ", sci: "Tillandsia duratii" }, { name: "パウシフォリア", sci: "Tillandsia paucifolia" }, { name: "セレリアナ", sci: "Tillandsia seleriana" }, { name: "ファシクラータ", sci: "Tillandsia fasciculata" },
        { name: "ストリクタ", sci: "Tillandsia stricta" }, { name: "レクルビフォリア", sci: "Tillandsia recurvifolia" },
      ] },
    ],
  },
  {
    label: "観葉植物",
    loc: { en: "Foliage Plants", zh: "观叶植物", es: "Plantas de Follaje" },
    genera: [
      { name: "モンステラ", pickable: true, loc: { en: "Monstera", zh: "龟背竹属", es: "Monstera" }, varieties: [
        { name: "デリシオーサ", sci: "Monstera deliciosa", aliases: ["デリシオサ"] }, { name: "アダンソニー", sci: "Monstera adansonii" }, { name: "ヒメモンステラ", sci: "Rhaphidophora tetrasperma" },
        { name: "ボルシギアナ", sci: "Monstera deliciosa var. borsigiana" }, { name: "ジェイドシャトルコック", sci: "Monstera deliciosa 'Jade Shuttlecock'" }, { name: "スタンドレヤナ", sci: "Monstera standleyana" }, { name: "ドゥビア", sci: "Monstera dubia" },
        { name: "オブリクア", sci: "Monstera obliqua" }, { name: "レクレリアナ", sci: "Monstera lechleriana" }, { name: "ペルー", sci: "Monstera karstenianum" }, { name: "ピナッティパルティタ", sci: "Monstera pinnatipartita" },
        { name: "タイコンステレーション", sci: "Monstera deliciosa 'Thai Constellation'" }, { name: "ホワイトタイガー", sci: "Monstera deliciosa 'White Tiger'" }, { name: "アルボ", sci: "Monstera deliciosa 'Albo Variegata'" }, { name: "アルボバリエガータ", sci: "Monstera deliciosa 'Albo Variegata'" },
        { name: "ハーフムーン", sci: "Monstera deliciosa 'Half Moon'" }, { name: "フルムーン", sci: "Monstera deliciosa 'Full Moon'" }, { name: "オーレア", sci: "Monstera deliciosa 'Aurea'" }, { name: "ミントバリエガータ", sci: "Monstera deliciosa 'Mint Variegata'" },
        { name: "白斑モンステラ", sci: "Monstera deliciosa 'Variegata'" },
      ] },
      { name: "フィロデンドロン", pickable: true, loc: { en: "Philodendron", zh: "喜林芋属", es: "Filodendro" }, varieties: [
        { name: "バーキン", sci: "Philodendron 'Birkin'" }, { name: "ピンクプリンセス", sci: "Philodendron erubescens 'Pink Princess'" }, { name: "ホワイトナイト", sci: "Philodendron erubescens 'White Knight'" }, { name: "ホワイトウィザード", sci: "Philodendron erubescens 'White Wizard'" },
        { name: "セローム", sci: "Philodendron bipinnatifidum" }, { name: "ザナドゥ", sci: "Philodendron xanadu" }, { name: "クッカバラ", sci: "Philodendron 'Kookaburra'" }, { name: "グロリオスム", sci: "Philodendron gloriosum" },
        { name: "メラノクリサム", sci: "Philodendron melanochrysum" }, { name: "マイカンス", sci: "Philodendron micans" }, { name: "ブラジル", sci: "Philodendron hederaceum 'Brasil'" }, { name: "オキシカルジウム", sci: "Philodendron hederaceum var. oxycardium" },
        { name: "シルバーメタル", sci: "Philodendron hastatum 'Silver Sword'" }, { name: "エルベセンス", sci: "Philodendron erubescens" }, { name: "パライソベルディ", sci: "Philodendron 'Paraiso Verde'" },
      ] },
      { name: "アロカシア", pickable: true, loc: { en: "Alocasia", zh: "海芋属", es: "Alocasia" }, varieties: [
        { name: "アマゾニカ", sci: "Alocasia × amazonica" }, { name: "ザンラベシカ", sci: "Alocasia zebrina 'Reticulata'" }, { name: "バンビーノ", sci: "Alocasia × amazonica 'Bambino'" }, { name: "ブラックベルベット", sci: "Alocasia reginula 'Black Velvet'" },
        { name: "クプレア", sci: "Alocasia cuprea" }, { name: "ドラゴンスケール", sci: "Alocasia baginda 'Dragon Scale'" }, { name: "シルバードラゴン", sci: "Alocasia baginda 'Silver Dragon'" }, { name: "スティングレイ", sci: "Alocasia macrorrhizos 'Stingray'" },
        { name: "グリーンベルベット", sci: "Alocasia micholitziana 'Green Velvet'" }, { name: "レガリスシルバー", sci: "Alocasia reginae 'Silver'" }, { name: "マハラニ", sci: "Alocasia 'Maharani'" }, { name: "ゼブリナ", sci: "Alocasia zebrina" },
        { name: "ワトソニアナ", sci: "Alocasia watsoniana" }, { name: "スカルプラム", sci: "Alocasia scalprum" }, { name: "レッドシークレット", sci: "Alocasia cuprea 'Red Secret'" },
      ] },
      { name: "アンスリウム", pickable: true, loc: { en: "Anthurium", zh: "花烛属", es: "Anturio" }, varieties: [
        { name: "クラリネルビウム", sci: "Anthurium clarinervium" }, { name: "クリスタリナム", sci: "Anthurium crystallinum" }, { name: "フーケリー", sci: "Anthurium hookeri" },
        { name: "ベイチー", sci: "Anthurium veitchii" }, { name: "ワロクアナム", sci: "Anthurium warocqueanum", aliases: ["ウォロケウシー"] }, { name: "マグニフィカム", sci: "Anthurium magnificum" }, { name: "シロシマウチワ", sci: "Anthurium andraeanum" },
      ] },
      { name: "ホヤ", pickable: true, loc: { en: "Hoya", zh: "球兰属", es: "Hoya" }, varieties: [
        { name: "サクララン", sci: "Hoya carnosa", aliases: ["カルノーサ"] }, { name: "ケリー", sci: "Hoya kerrii" }, { name: "リネアリス", sci: "Hoya linearis" },
        { name: "プビカリクス", sci: "Hoya pubicalyx" }, { name: "クミンギアナ", sci: "Hoya cumingiana" }, { name: "マクロフィラ", sci: "Hoya macrophylla" }, { name: "カウダータ", sci: "Hoya caudata" },
        { name: "ベラ", sci: "Hoya lanceolata subsp. bella" }, { name: "オボバタ", sci: "Hoya obovata" }, { name: "リップカラー", sci: "Hoya wayetii" },
      ] },
      { name: "ベゴニア", pickable: true, loc: { en: "Begonia", zh: "秋海棠属", es: "Begonia" }, varieties: [
        { name: "マクラータ", sci: "Begonia maculata" }, { name: "レックス", sci: "Begonia rex" }, { name: "マゾニアナ", sci: "Begonia masoniana" }, { name: "木立性ベゴニア", sci: "Begonia" },
        { name: "根茎性ベゴニア", sci: "Begonia" }, { name: "球根性ベゴニア", sci: "Begonia" },
      ] },
      { name: "カラテア", pickable: true, loc: { en: "Calathea", zh: "肖竹芋属", es: "Calathea" }, varieties: [
        { name: "マコヤナ", sci: "Goeppertia makoyana" }, { name: "オルナータ", sci: "Goeppertia ornata" }, { name: "ホワイトスター", sci: "Goeppertia majestica 'White Star'" }, { name: "ランキフォリア", sci: "Goeppertia lancifolia", aliases: ["インシグニス"] },
        { name: "ゼブリナ", sci: "Goeppertia zebrina" }, { name: "ムサイカ", sci: "Goeppertia bella" }, { name: "ロゼオピクタ", sci: "Goeppertia roseopicta" },
      ] },
      { name: "シンゴニウム", pickable: true, loc: { en: "Syngonium", zh: "合果芋属", es: "Singonio" }, varieties: [
        { name: "ピンク", sci: "Syngonium podophyllum 'Pink'" }, { name: "ネオン", sci: "Syngonium podophyllum 'Neon Robusta'" }, { name: "アルボ", sci: "Syngonium podophyllum 'Albo Variegatum'" }, { name: "パンサー", sci: "Syngonium podophyllum 'Panther'" },
        { name: "レッドスポット", sci: "Syngonium podophyllum 'Red Spot'" }, { name: "ミルクコンフェッティ", sci: "Syngonium podophyllum 'Milk Confetti'" }, { name: "マーブル", sci: "Syngonium podophyllum 'Marble'" },
      ] },
      { name: "ポトス", pickable: true, loc: { en: "Pothos", zh: "绿萝", es: "Poto" }, aliases: ["エピプレムナム"], varieties: [
        { name: "エピプレムナム", sci: "Epipremnum aureum" }, { name: "ピンナタム", sci: "Epipremnum pinnatum" }, { name: "ゴールデン", sci: "Epipremnum aureum 'Golden Pothos'" }, { name: "マーブルクイーン", sci: "Epipremnum aureum 'Marble Queen'" },
        { name: "ライム", sci: "Epipremnum aureum 'Lime'" }, { name: "エンジョイ", sci: "Epipremnum aureum 'N'Joy'" }, { name: "グローバルグリーン", sci: "Epipremnum aureum 'Global Green'" }, { name: "ハーレクイン", sci: "Epipremnum aureum 'Harlequin'" },
        { name: "セブブルー", sci: "Epipremnum pinnatum 'Cebu Blue'" }, { name: "シンダプサス", sci: "Scindapsus pictus" }, { name: "トリカラー", sci: "Epipremnum pinnatum 'Tricolor'" },
      ] },
      { name: "フィカス", pickable: true, loc: { en: "Ficus", zh: "榕属", es: "Ficus" }, aliases: ["ゴムの木"], varieties: [
        { name: "ウンベラータ", sci: "Ficus umbellata" }, { name: "ベンガレンシス", sci: "Ficus benghalensis" }, { name: "アルテシマ", sci: "Ficus altissima" }, { name: "バーガンディ", sci: "Ficus elastica 'Burgundy'" },
        { name: "ベンジャミン", sci: "Ficus benjamina", aliases: ["ベンジャミナ"] }, { name: "ガジュマル", sci: "Ficus microcarpa" }, { name: "ティネケ", sci: "Ficus elastica 'Tineke'" },
        { name: "ルビギノーサ", sci: "Ficus rubiginosa" }, { name: "ペティオラリス", sci: "Ficus petiolaris" }, { name: "リラータ", sci: "Ficus lyrata" }, { name: "プミラ", sci: "Ficus pumila" },
      ] },
      { name: "ドラセナ", pickable: true, loc: { en: "Dracaena", zh: "龙血树属", es: "Dracaena" }, varieties: [
        { name: "幸福の木", sci: "Dracaena fragrans" }, { name: "マッサンゲアナ", sci: "Dracaena fragrans 'Massangeana'" }, { name: "コンシンネ", sci: "Dracaena marginata", aliases: ["マジナータ"] },
        { name: "ソング・オブ・インディア", sci: "Dracaena reflexa 'Song of India'" }, { name: "ソング・オブ・ジャマイカ", sci: "Dracaena reflexa 'Song of Jamaica'" }, { name: "コンパクタ", sci: "Dracaena fragrans 'Compacta'" }, { name: "レモンライム", sci: "Dracaena fragrans 'Lemon Lime'" },
        { name: "ワーネッキー", sci: "Dracaena fragrans 'Warneckei'" }, { name: "ドラド", sci: "Dracaena fragrans 'Dorado'" }, { name: "デレメンシス", sci: "Dracaena fragrans 'Deremensis'" },
      ] },
      { name: "パキラ", pickable: true, loc: { en: "Pachira", zh: "瓜栗属", es: "Pachira" }, aliases: ["発財樹"], varieties: [
        { name: "グラブラ", sci: "Pachira glabra" }, { name: "アクアティカ", sci: "Pachira aquatica" }, { name: "ミルキーウェイ", sci: "Pachira aquatica 'Milky Way'" },
      ] },
      { name: "アイビー", pickable: true, loc: { en: "Ivy", zh: "常春藤", es: "Hiedra" }, aliases: ["ヘデラ"], varieties: [
        { name: "ヘデラ", sci: "Hedera helix", aliases: ["ヘリックス"] }, { name: "グレーシャー", sci: "Hedera helix 'Glacier'" }, { name: "ゴールドチャイルド", sci: "Hedera helix 'Goldchild'" },
        { name: "ホワイトワンダー", sci: "Hedera helix 'White Wonder'" }, { name: "ピッツバーグ", sci: "Hedera helix 'Pittsburgh'" }, { name: "カナリエンシス", sci: "Hedera canariensis" }, { name: "雪の妖精", sci: "Hedera helix 'Yuki no Yosei'" },
      ] },
      { name: "シェフレラ", pickable: true, loc: { en: "Schefflera", zh: "鹅掌柴属", es: "Schefflera" }, aliases: ["カポック"], varieties: [
        { name: "アンガスティフォリア", sci: "Schefflera arboricola 'Angustifolia'" }, { name: "コンパクタ", sci: "Schefflera arboricola 'Compacta'" }, { name: "ホンコン", sci: "Schefflera arboricola 'Hong Kong'" }, { name: "アルボリコラ", sci: "Schefflera arboricola" },
        { name: "レナータ", sci: "Schefflera arboricola 'Renata'" }, { name: "アマテ", sci: "Schefflera actinophylla 'Amate'" },
      ] },
      { name: "ユッカ", pickable: true, loc: { en: "Yucca", zh: "丝兰属", es: "Yuca" }, aliases: ["Yucca"], varieties: [
        { name: "エレファンティペス", sci: "Yucca gigantea", aliases: ["青年の木"] }, { name: "ロストラータ", sci: "Yucca rostrata" }, { name: "リギダ", sci: "Yucca rigida", aliases: ["ユッカリギダ"] }, { name: "トンプソニアナ", sci: "Yucca thompsoniana" }, { name: "リネアリフォリア", sci: "Yucca linearifolia" }, { name: "ケレタロエンシス", sci: "Yucca queretaroensis" },
        { name: "デスメティアナ", sci: "Yucca desmetiana" }, { name: "アロイフォリア", sci: "Yucca aloifolia" }, { name: "グロリオサ", sci: "Yucca gloriosa" }, { name: "フィラメントーサ", sci: "Yucca filamentosa", aliases: ["イトラン", "糸蘭"] }, { name: "バッカタ", sci: "Yucca baccata" }, { name: "フィリフェラ", sci: "Yucca filifera" }, { name: "ブレビフォリア", sci: "Yucca brevifolia", aliases: ["ジョシュアツリー"] },
      ] },
      { name: "その他観葉", pickable: false, loc: { en: "Other foliage plants", zh: "其他观叶植物", es: "Otras plantas de follaje" }, varieties: [
        { name: "ディフェンバキア", sci: "Dieffenbachia seguine" }, { name: "クワズイモ", sci: "Alocasia odora" }, { name: "アグラオネマ", sci: "Aglaonema" }, { name: "ザミオクルカス", sci: "Zamioculcas zamiifolia" },
        { name: "ペペロミア", sci: "Peperomia" }, { name: "ストレリチア", sci: "Strelitzia reginae" }, { name: "エバーフレッシュ", sci: "Cojoba arborea var. angustifolia" }, { name: "ストロマンテ", sci: "Stromanthe sanguinea" },
        { name: "クテナンテ", sci: "Ctenanthe oppenheimiana" }, { name: "ディスキディア", sci: "Dischidia" }, { name: "サンスベリア", sci: "Dracaena trifasciata" },
      ] },
    ],
  },
  {
    label: "食虫植物",
    loc: { en: "Carnivorous Plants", zh: "食虫植物", es: "Plantas Carnívoras" },
    genera: [
      { name: "ハエトリソウ", pickable: true, loc: { en: "Venus flytrap", zh: "捕蝇草", es: "Venus atrapamoscas" }, varieties: [
        { name: "ハエトリグサ", sci: "Dionaea muscipula", aliases: ["ディオネア", "マスシプラ"] }, { name: "B52", sci: "Dionaea muscipula 'B52'" },
        { name: "レッドピラニア", sci: "Dionaea muscipula 'Red Piranha'" }, { name: "シャークティース", sci: "Dionaea muscipula 'Shark Teeth'" }, { name: "レッドドラゴン", sci: "Dionaea muscipula 'Akai Ryu'" }, { name: "ホエール", sci: "Dionaea muscipula 'Whale'" },
        { name: "ビッグマウス", sci: "Dionaea muscipula 'Big Mouth'" }, { name: "ピンクビーナス", sci: "Dionaea muscipula 'Pink Venus'" }, { name: "カップトラップ", sci: "Dionaea muscipula 'Cupped Trap'" }, { name: "エイリアン", sci: "Dionaea muscipula 'Alien'" },
        { name: "ジョーズ", sci: "Dionaea muscipula 'Jaws'" }, { name: "ダーウィンレッドピラニア", sci: "Dionaea muscipula 'Darwin Red Piranha'" },
      ] },
      { name: "ネペンテス", pickable: true, loc: { en: "Nepenthes", zh: "猪笼草", es: "Nepenthes" }, varieties: [
        { name: "ウツボカズラ", sci: "Nepenthes" }, { name: "アラータ", sci: "Nepenthes alata" }, { name: "ベントリコーサ", sci: "Nepenthes ventricosa" }, { name: "ベントラータ", sci: "Nepenthes × ventrata" },
        { name: "アンプラリア", sci: "Nepenthes ampullaria" }, { name: "ラフレシアナ", sci: "Nepenthes rafflesiana" }, { name: "トランカータ", sci: "Nepenthes truncata" }, { name: "アルボマギナタ", sci: "Nepenthes albomarginata" },
        { name: "マキシマ", sci: "Nepenthes maxima" }, { name: "ラジャ", sci: "Nepenthes rajah" }, { name: "ハマタ", sci: "Nepenthes hamata" }, { name: "ローウィー", sci: "Nepenthes lowii" },
        { name: "ビーチー", sci: "Nepenthes veitchii" }, { name: "アッテンボロギ", sci: "Nepenthes attenboroughii" }, { name: "シンガラナ", sci: "Nepenthes singalana" }, { name: "グラシリス", sci: "Nepenthes gracilis" },
        { name: "スペクタビリス", sci: "Nepenthes spectabilis" }, { name: "エドワードシアナ", sci: "Nepenthes edwardsiana" }, { name: "ミランダ", sci: "Nepenthes 'Miranda'" }, { name: "レディラック", sci: "Nepenthes 'Lady Luck'" },
        { name: "ダイエリアナ", sci: "Nepenthes × dyeriana" }, { name: "ガヤ", sci: "Nepenthes × 'St. Gaya'" }, { name: "ミクスタ", sci: "Nepenthes × mixta" }, { name: "ルイーザ", sci: "Nepenthes 'Louisa'" },
      ] },
      { name: "サラセニア", pickable: true, loc: { en: "Sarracenia", zh: "瓶子草", es: "Sarracenia" }, varieties: [
        { name: "ヘイシソウ", sci: "Sarracenia" }, { name: "レウコフィラ", sci: "Sarracenia leucophylla" }, { name: "プルプレア", sci: "Sarracenia purpurea" }, { name: "フラバ", sci: "Sarracenia flava" },
        { name: "プシタシナ", sci: "Sarracenia psittacina" }, { name: "アラタ", sci: "Sarracenia alata" }, { name: "ミノール", sci: "Sarracenia minor" }, { name: "ルブラ", sci: "Sarracenia rubra" },
        { name: "オレオフィラ", sci: "Sarracenia oreophila" }, { name: "コーティ", sci: "Sarracenia × courtii" }, { name: "エクセレンス", sci: "Sarracenia 'Excellens'" }, { name: "スカーレットベル", sci: "Sarracenia 'Scarlet Belle'" },
        { name: "レッドチューブ", sci: "Sarracenia 'Red Tube'" },
      ] },
      { name: "ドロセラ", pickable: true, loc: { en: "Drosera", zh: "茅膏菜", es: "Drosera" }, varieties: [
        { name: "モウセンゴケ", sci: "Drosera rotundifolia" }, { name: "カペンシス", sci: "Drosera capensis" }, { name: "カペンシスレッド", sci: "Drosera capensis 'Red'" }, { name: "カペンシスアルバ", sci: "Drosera capensis 'Alba'" },
        { name: "アデラエ", sci: "Drosera adelae" }, { name: "ビナータ", sci: "Drosera binata" }, { name: "ブルマニー", sci: "Drosera burmannii" },
        { name: "フィリフォルミス", sci: "Drosera filiformis" }, { name: "マダガスカリエンシス", sci: "Drosera madagascariensis" }, { name: "トウカイエンシス", sci: "Drosera × tokaiensis" }, { name: "ピグミードロセラ", sci: "Drosera" },
        { name: "塊根ドロセラ", sci: "Drosera" }, { name: "コモウセンゴケ", sci: "Drosera spatulata", aliases: ["スパチュラータ"] }, { name: "ナガバノモウセンゴケ", sci: "Drosera anglica" },
      ] },
      { name: "ピンギキュラ", pickable: true, loc: { en: "Pinguicula", zh: "捕虫堇", es: "Pinguicula" }, varieties: [
        { name: "ムシトリスミレ", sci: "Pinguicula" }, { name: "エセリアナ", sci: "Pinguicula esseriana" }, { name: "モラネンシス", sci: "Pinguicula moranensis" }, { name: "ギガンテア", sci: "Pinguicula gigantea" },
        { name: "アグナタ", sci: "Pinguicula agnata" }, { name: "モクテズマエ", sci: "Pinguicula moctezumae" }, { name: "レクティフォリア", sci: "Pinguicula rectifolia" }, { name: "シクロセクタ", sci: "Pinguicula cyclosecta" },
        { name: "グラシリス", sci: "Pinguicula gracilis" }, { name: "プリムリフローラ", sci: "Pinguicula primuliflora" }, { name: "プラニフォリア", sci: "Pinguicula planifolia" }, { name: "ティナ", sci: "Pinguicula 'Tina'" },
        { name: "アフロディーテ", sci: "Pinguicula 'Aphrodite'" }, { name: "コウシンソウ", sci: "Pinguicula ramosa" },
      ] },
      { name: "その他", pickable: false, loc: { en: "Others", zh: "其他", es: "Otros" }, varieties: [
        { name: "セファロタス", sci: "Cephalotus follicularis", aliases: ["フクロユキノシタ"] }, { name: "ヘリアンフォラ", sci: "Heliamphora" }, { name: "ゲンリセア", sci: "Genlisea" },
        { name: "ウトリクラリア", sci: "Utricularia" }, { name: "ミミカキグサ", sci: "Utricularia bifida" }, { name: "タヌキモ", sci: "Utricularia australis" },
      ] },
    ],
  },
  {
    label: "蘭",
    loc: { en: "Orchids", zh: "兰花", es: "Orquídeas" },
    genera: [
      { name: "胡蝶蘭", pickable: true, loc: { en: "Phalaenopsis", zh: "蝴蝶兰", es: "Phalaenopsis" }, varieties: [
        { name: "コチョウラン", sci: "Phalaenopsis", aliases: ["ファレノプシス"] }, { name: "ミディ胡蝶蘭", sci: "Phalaenopsis" }, { name: "アマビリス", sci: "Phalaenopsis amabilis" },
        { name: "シレリアナ", sci: "Phalaenopsis schilleriana" }, { name: "アフロディーテ", sci: "Phalaenopsis aphrodite" },
      ] },
      { name: "カトレア", pickable: true, loc: { en: "Cattleya", zh: "卡特兰", es: "Cattleya" }, varieties: [
        { name: "カトレヤ", sci: "Cattleya" }, { name: "ミニカトレア", sci: "Cattleya" }, { name: "ワルケリアナ", sci: "Cattleya walkeriana" }, { name: "ラビアタ", sci: "Cattleya labiata" },
        { name: "パープラータ", sci: "Cattleya purpurata" }, { name: "マキシマ", sci: "Cattleya maxima" }, { name: "ルデマニアナ", sci: "Cattleya lueddemanniana" }, { name: "インターメディア", sci: "Cattleya intermedia" },
      ] },
      { name: "デンドロビウム", pickable: true, loc: { en: "Dendrobium", zh: "石斛兰", es: "Dendrobium" }, varieties: [
        { name: "デンドロ", sci: "Dendrobium" }, { name: "ノビル", sci: "Dendrobium nobile" }, { name: "デンファレ", sci: "Dendrobium phalaenopsis" }, { name: "キンギアナム", sci: "Dendrobium kingianum" },
        { name: "シルコッキー", sci: "Dendrobium kingianum var. silcockii" }, { name: "カリスタ系", sci: "Dendrobium" },
      ] },
      { name: "パフィオペディルム", pickable: true, loc: { en: "Paphiopedilum", zh: "兜兰", es: "Paphiopedilum" }, varieties: [
        { name: "パフィオ", sci: "Paphiopedilum" }, { name: "ロスチャイルディアナム", sci: "Paphiopedilum rothschildianum" }, { name: "デレナティ", sci: "Paphiopedilum delenatii" }, { name: "多花性パフィオ", sci: "Paphiopedilum" },
      ] },
      { name: "富貴蘭", pickable: true, loc: { en: "Neofinetia (Wind orchid)", zh: "风兰", es: "Neofinetia" }, varieties: [
        { name: "フウラン", sci: "Vanda falcata", aliases: ["風蘭"] }, { name: "建国殿", sci: "Vanda falcata 'Kenkokuden'" }, { name: "富貴殿", sci: "Vanda falcata 'Fukiden'" },
        { name: "金兜", sci: "Vanda falcata 'Kinkabuto'" }, { name: "羽衣", sci: "Vanda falcata 'Hagoromo'" }, { name: "御城覆輪", sci: "Vanda falcata 'Gojofukurin'" }, { name: "金牡丹", sci: "Vanda falcata 'Kinbotan'" },
        { name: "朝日殿", sci: "Vanda falcata 'Asahiden'" }, { name: "西出都", sci: "Vanda falcata 'Nishidemiyako'" }, { name: "豊明殿", sci: "Vanda falcata 'Houmeiden'" }, { name: "青海", sci: "Vanda falcata 'Seikai'" },
        { name: "金孔雀", sci: "Vanda falcata 'Kinkujaku'" }, { name: "翡翠", sci: "Vanda falcata 'Hisui'" }, { name: "羆", sci: "Vanda falcata 'Higuma'" }, { name: "紅扇", sci: "Vanda falcata 'Beniogi'" },
        { name: "湖東覆輪", sci: "Vanda falcata 'Kotofukurin'" },
      ] },
      { name: "セッコク", pickable: true, loc: { en: "Dendrobium moniliforme", zh: "石斛", es: "Dendrobium moniliforme" }, varieties: [
        { name: "石斛", sci: "Dendrobium moniliforme" }, { name: "長生蘭", sci: "Dendrobium moniliforme" }, { name: "金鶏閣", sci: "Dendrobium moniliforme 'Kinkeikaku'" }, { name: "銀雪", sci: "Dendrobium moniliforme 'Ginsetsu'" },
        { name: "紅苑", sci: "Dendrobium moniliforme 'Kouen'" }, { name: "黄金丸", sci: "Dendrobium moniliforme 'Koganemaru'" }, { name: "金剛石", sci: "Dendrobium moniliforme 'Kongoseki'" }, { name: "紅小町", sci: "Dendrobium moniliforme 'Benikomachi'" },
        { name: "雷山", sci: "Dendrobium moniliforme 'Raizan'" }, { name: "龍田", sci: "Dendrobium moniliforme 'Tatsuta'" }, { name: "燈麗", sci: "Dendrobium moniliforme 'Tourei'" },
      ] },
      { name: "エビネ", pickable: true, loc: { en: "Calanthe", zh: "虾脊兰", es: "Calanthe" }, varieties: [
        { name: "カランセ", sci: "Calanthe" }, { name: "ジエビネ", sci: "Calanthe discolor" }, { name: "キエビネ", sci: "Calanthe sieboldii" }, { name: "ニオイエビネ", sci: "Calanthe izu-insularis" },
        { name: "サルメンエビネ", sci: "Calanthe tricarinata" }, { name: "キリシマエビネ", sci: "Calanthe aristulifera" },
      ] },
      { name: "その他の蘭", pickable: false, loc: { en: "Other orchids", zh: "其他兰花", es: "Otras orquídeas" }, varieties: [
        { name: "シンビジウム", sci: "Cymbidium" }, { name: "オンシジウム", sci: "Oncidium" }, { name: "バンダ", sci: "Vanda" }, { name: "デンドロキラム", sci: "Dendrochilum" },
        { name: "リカステ", sci: "Lycaste" }, { name: "ミルトニア", sci: "Miltonia" }, { name: "マスデバリア", sci: "Masdevallia" }, { name: "アングレカム", sci: "Angraecum" },
      ] },
      { name: "野生ラン", pickable: false, loc: { en: "Wild orchids", zh: "野生兰", es: "Orquídeas silvestres" }, varieties: [
        { name: "ウチョウラン", sci: "Ponerorchis graminifolia" }, { name: "クマガイソウ", sci: "Cypripedium japonicum" }, { name: "アツモリソウ", sci: "Cypripedium macranthos" }, { name: "サギソウ", sci: "Pecteilis radiata" },
        { name: "ネジバナ", sci: "Spiranthes australis" }, { name: "シラン", sci: "Bletilla striata" }, { name: "シプリペディウム", sci: "Cypripedium" },
      ] },
    ],
  },
  {
    label: "山野草",
    loc: { en: "Native Wildflowers", zh: "山野草", es: "Plantas Silvestres Ornamentales" },
    genera: [
      { name: "山野草", pickable: true, loc: { en: "Wildflowers / Alpine plants", zh: "山野草", es: "Plantas silvestres y alpinas" }, varieties: [
        { name: "雪割草", sci: "Hepatica nobilis var. japonica" }, { name: "福寿草", sci: "Adonis ramosa" }, { name: "イワヒバ", sci: "Selaginella tamariscina" }, { name: "春蘭", sci: "Cymbidium goeringii" },
        { name: "寒蘭", sci: "Cymbidium kanran" }, { name: "イワチドリ", sci: "Ponerorchis keiskei" }, { name: "ホトトギス", sci: "Tricyrtis hirta" }, { name: "日本桜草", sci: "Primula sieboldii" },
        { name: "ダイモンジソウ", sci: "Saxifraga fortunei" }, { name: "イワタバコ", sci: "Conandron ramondioides" }, { name: "高山植物" }, { name: "斑入り山野草" },
      ] },
    ],
  },
  {
    label: "シダ",
    loc: { en: "Ferns", zh: "蕨类", es: "Helechos" },
    genera: [
      { name: "アジアンタム", pickable: true, loc: { en: "Adiantum (Maidenhair fern)", zh: "铁线蕨", es: "Adiantum (Culantrillo)" }, varieties: [
        { name: "ラディアナム", sci: "Adiantum raddianum" }, { name: "フリッツルーシー", sci: "Adiantum raddianum 'Fritz Luthii'" }, { name: "ペルビアナム", sci: "Adiantum peruvianum" }, { name: "ホウライシダ", sci: "Adiantum capillus-veneris" },
      ] },
      { name: "プテリス", pickable: true, loc: { en: "Pteris (Brake fern)", zh: "凤尾蕨", es: "Pteris" }, varieties: [
        { name: "クレティカ", sci: "Pteris cretica" }, { name: "アルボリネアタ", sci: "Pteris cretica var. albolineata" }, { name: "イノキシマ", sci: "Pteris" },
      ] },
      { name: "ネフロレピス", pickable: true, loc: { en: "Nephrolepis (Sword fern)", zh: "肾蕨", es: "Nephrolepis (Helecho espada)" }, aliases: ["タマシダ"], varieties: [
        { name: "ツデー", sci: "Nephrolepis exaltata 'Teddy Junior'" }, { name: "ボストンファーン", sci: "Nephrolepis exaltata 'Bostoniensis'" }, { name: "スコッチ", sci: "Nephrolepis exaltata 'Scottii'" }, { name: "ダフィー", sci: "Nephrolepis exaltata 'Duffii'" },
      ] },
      { name: "ダバリア", pickable: true, loc: { en: "Davallia (Rabbit's foot fern)", zh: "骨碎补", es: "Davallia" }, aliases: ["シノブ"], varieties: [
        { name: "トキワシノブ", sci: "Davallia mariesii" }, { name: "玉シダ", sci: "Davallia" },
      ] },
      { name: "アスプレニウム", pickable: true, loc: { en: "Asplenium", zh: "铁角蕨", es: "Asplenium" }, aliases: ["タニワタリ"], varieties: [
        { name: "オオタニワタリ", sci: "Asplenium antiquum" }, { name: "コブラ", sci: "Asplenium nidus 'Cobra'" }, { name: "エメラルドウェーブ", sci: "Asplenium nidus 'Emerald Wave'" }, { name: "アビス", sci: "Asplenium nidus 'Avis'" },
      ] },
      { name: "その他シダ", pickable: false, loc: { en: "Other ferns", zh: "其他蕨类", es: "Otros helechos" }, aliases: ["シダ"], varieties: [
        { name: "シダ" }, { name: "リュウビンタイ", sci: "Angiopteris lygodiifolia" }, { name: "ヒノキシダ", sci: "Asplenium prolongatum" }, { name: "クサソテツ", sci: "Matteuccia struthiopteris", aliases: ["コゴミ"] },
        { name: "ゼンマイ", sci: "Osmunda japonica" }, { name: "ワラビ", sci: "Pteridium aquilinum" }, { name: "イノモトソウ", sci: "Pteris multifida" },
        { name: "トキワシダ" }, { name: "ブレクナム", sci: "Blechnum" }, { name: "ヘミオニティス", sci: "Hemionitis" }, { name: "イワヒバ", sci: "Selaginella tamariscina" },
      ] },
    ],
  },
  {
    label: "コケ",
    loc: { en: "Mosses", zh: "苔藓", es: "Musgos" },
    genera: [
      { name: "コケ各種", pickable: false, loc: { en: "Mosses (various)", zh: "各种苔藓", es: "Musgos (varios)" }, aliases: ["苔", "コケ", "モス"], varieties: [
        { name: "苔" }, { name: "コケ" }, { name: "ホソバオキナゴケ", sci: "Leucobryum juniperoideum", aliases: ["山苔"] }, { name: "ハイゴケ", sci: "Hypnum plumaeforme" },
        { name: "スナゴケ", sci: "Racomitrium japonicum" }, { name: "タマゴケ", sci: "Bartramia pomiformis" }, { name: "ヒノキゴケ", sci: "Pyrrhobryum dozyanum" }, { name: "シノブゴケ", sci: "Thuidium" },
        { name: "ホウオウゴケ", sci: "Fissidens nobilis" }, { name: "コツボゴケ", sci: "Plagiomnium acutum" }, { name: "スギゴケ", sci: "Polytrichum" }, { name: "ゼニゴケ", sci: "Marchantia polymorpha" },
        { name: "苔テラリウム" }, { name: "苔玉" },
      ] },
    ],
  },
  {
    label: "水草",
    loc: { en: "Aquatic Plants", zh: "水草", es: "Plantas Acuáticas" },
    genera: [
      { name: "アヌビアス", pickable: true, loc: { en: "Anubias", zh: "水榕", es: "Anubias" }, varieties: [
        { name: "ナナ", sci: "Anubias barteri var. nana" }, { name: "ナナプチ", sci: "Anubias barteri var. nana 'Petite'" }, { name: "コーヒーフォリア", sci: "Anubias barteri var. coffeefolia" }, { name: "バルテリー", sci: "Anubias barteri" },
        { name: "ナナゴールデン", sci: "Anubias barteri var. nana 'Golden'" }, { name: "ナンギ", sci: "Anubias barteri var. nana 'Nangi'" },
      ] },
      { name: "ミクロソリウム", pickable: true, loc: { en: "Microsorum (Java fern)", zh: "星蕨", es: "Microsorum (Helecho de Java)" }, varieties: [
        { name: "プテロプス", sci: "Microsorum pteropus" }, { name: "ナローリーフ", sci: "Microsorum pteropus 'Narrow'" }, { name: "本ナロー", sci: "Microsorum pteropus 'Narrow'" }, { name: "トライデント", sci: "Microsorum pteropus 'Trident'" },
        { name: "ウェンディロフ", sci: "Microsorum pteropus 'Windeløv'" }, { name: "セミナロー", sci: "Microsorum pteropus 'Semi-Narrow'" },
      ] },
      { name: "ウィローモス", pickable: true, loc: { en: "Java moss", zh: "爪哇莫斯", es: "Musgo de Java" }, aliases: ["モス"], varieties: [
        { name: "南米ウィローモス", sci: "Vesicularia montagnei" }, { name: "ウィーピングモス", sci: "Vesicularia ferriei" }, { name: "プレミアムモス", sci: "Taxiphyllum" }, { name: "クリスマスモス", sci: "Vesicularia montagnei 'Christmas'" },
        { name: "フレイムモス", sci: "Taxiphyllum 'Flame'" }, { name: "リシア", sci: "Riccia fluitans" },
      ] },
      { name: "クリプトコリネ", pickable: true, loc: { en: "Cryptocoryne", zh: "隐棒花", es: "Cryptocoryne" }, varieties: [
        { name: "ウェンティ", sci: "Cryptocoryne wendtii" }, { name: "ベケッティ", sci: "Cryptocoryne beckettii" }, { name: "バランサエ", sci: "Cryptocoryne crispatula var. balansae" }, { name: "ルテア", sci: "Cryptocoryne wendtii 'Lutea'" },
        { name: "ペッチー", sci: "Cryptocoryne beckettii 'Petchii'" }, { name: "ウェンティグリーン", sci: "Cryptocoryne wendtii 'Green'" }, { name: "パルバ", sci: "Cryptocoryne parva" },
      ] },
      { name: "ロタラ", pickable: true, loc: { en: "Rotala", zh: "节节菜", es: "Rotala" }, varieties: [
        { name: "ロトンディフォリア", sci: "Rotala rotundifolia" }, { name: "グリーン", sci: "Rotala rotundifolia 'Green'" }, { name: "ハイグロフィラ赤", sci: "Rotala rotundifolia 'Red'" }, { name: "インディカ", sci: "Rotala indica" },
        { name: "ナンセアン", sci: "Rotala sp. 'Nanjenshan'" }, { name: "ワリッキー", sci: "Rotala wallichii" }, { name: "ベトナム", sci: "Rotala rotundifolia 'Vietnam'" },
      ] },
      { name: "ブセファランドラ", pickable: true, loc: { en: "Bucephalandra", zh: "辣椒榕", es: "Bucephalandra" }, aliases: ["ブセ"], varieties: [
        { name: "クダガン", sci: "Bucephalandra 'Kedagang'" }, { name: "クアラクアヤン", sci: "Bucephalandra 'Kualakuayan'" }, { name: "ブラウニー", sci: "Bucephalandra 'Brownie'" }, { name: "シンタン", sci: "Bucephalandra 'Sintang'" },
        { name: "デフォルメ", sci: "Bucephalandra 'Deform'" },
      ] },
      { name: "エキノドルス", pickable: true, loc: { en: "Echinodorus (Amazon sword)", zh: "皇冠草", es: "Echinodorus (Espada amazónica)" }, aliases: ["アマゾンソード"], varieties: [
        { name: "アマゾンソード", sci: "Echinodorus bleheri" }, { name: "オゼロット", sci: "Echinodorus 'Ozelot'" }, { name: "ルビン", sci: "Echinodorus 'Rubin'" }, { name: "テネルス", sci: "Helanthium tenellum" },
      ] },
      { name: "ハイグロフィラ", pickable: true, loc: { en: "Hygrophila", zh: "水蓑衣", es: "Hygrophila" }, varieties: [
        { name: "ポリスペルマ", sci: "Hygrophila polysperma" }, { name: "ピンナティフィダ", sci: "Hygrophila pinnatifida" }, { name: "ロザエネルビス", sci: "Hygrophila polysperma 'Rosanervig'" }, { name: "ギニア", sci: "Hygrophila sp. 'Guinea'" },
      ] },
      { name: "前景草・その他水草", pickable: false, loc: { en: "Foreground & other aquatic plants", zh: "前景草及其他水草", es: "Plantas de primer plano y otras acuáticas" }, varieties: [
        { name: "グロッソスティグマ", sci: "Glossostigma elatinoides" }, { name: "ニューラージパールグラス", sci: "Micranthemum tweediei" }, { name: "ヘアーグラス", sci: "Eleocharis acicularis" }, { name: "キューバパールグラス", sci: "Hemianthus callitrichoides" },
        { name: "バリスネリア", sci: "Vallisneria" }, { name: "ピグミーチェーンサジタリア", sci: "Sagittaria subulata" }, { name: "マツモ", sci: "Ceratophyllum demersum" }, { name: "アナカリス", sci: "Egeria densa" },
        { name: "ウォータースプライト", sci: "Ceratopteris thalictroides" }, { name: "ニードルリーフルドウィジア", sci: "Ludwigia arcuata" }, { name: "ブリクサ", sci: "Blyxa japonica" }, { name: "ヘテランテラ", sci: "Heteranthera zosterifolia" },
        { name: "テネルス", sci: "Helanthium tenellum" }, { name: "ウォーターローン", sci: "Utricularia graminifolia" },
      ] },
    ],
  },
  {
    label: "水生・ビオトープ",
    loc: { en: "Aquatic & Biotope", zh: "水生植物", es: "Plantas Acuáticas y Biotopo" },
    genera: [
      { name: "スイレン", pickable: true, loc: { en: "Water lily", zh: "睡莲", es: "Nenúfar" }, aliases: ["睡蓮"], varieties: [
        { name: "温帯性スイレン", sci: "Nymphaea" }, { name: "熱帯性スイレン", sci: "Nymphaea" }, { name: "姫スイレン", sci: "Nymphaea tetragona" }, { name: "ヒツジグサ", sci: "Nymphaea tetragona" },
      ] },
      { name: "ハス", pickable: true, loc: { en: "Lotus", zh: "莲", es: "Loto" }, aliases: ["蓮"], varieties: [
        { name: "茶碗蓮", sci: "Nelumbo nucifera", aliases: ["ミニ蓮"] }, { name: "大賀蓮", sci: "Nelumbo nucifera 'Oga'" }, { name: "舞妃蓮", sci: "Nelumbo 'Maihiren'" },
      ] },
      { name: "水生植物各種", pickable: false, loc: { en: "Aquatic plants (various)", zh: "各种水生植物", es: "Plantas acuáticas (varias)" }, varieties: [
        { name: "ホテイアオイ", sci: "Eichhornia crassipes" }, { name: "アサザ", sci: "Nymphoides peltata" }, { name: "ウォーターマッシュルーム", sci: "Hydrocotyle verticillata" }, { name: "ナガバオモダカ", sci: "Sagittaria graminea" },
        { name: "オモダカ", sci: "Sagittaria trifolia" }, { name: "ウォーターポピー", sci: "Hydrocleys nymphoides" }, { name: "ウォーターバコパ", sci: "Bacopa caroliniana" }, { name: "ミズトクサ", sci: "Equisetum hyemale" },
        { name: "カキツバタ", sci: "Iris laevigata" }, { name: "ガマ", sci: "Typha latifolia" }, { name: "コウホネ", sci: "Nuphar japonica" }, { name: "ミズユキノシタ", sci: "Ludwigia ovalis" },
        { name: "デンジソウ", sci: "Marsilea quadrifolia" }, { name: "サンショウモ", sci: "Salvinia natans" }, { name: "アマゾンフロッグビット", sci: "Limnobium laevigatum" },
      ] },
    ],
  },
  {
    label: "バラ",
    loc: { en: "Roses", zh: "月季", es: "Rosas" },
    genera: [
      { name: "バラ", pickable: true, loc: { en: "Rose", zh: "月季", es: "Rosa" }, varieties: [
        { name: "ピエールドゥロンサール", sci: "Rosa 'Pierre de Ronsard'" }, { name: "ブランピエールドゥロンサール", sci: "Rosa 'Blanc Pierre de Ronsard'" }, { name: "ルージュピエールドゥロンサール", sci: "Rosa 'Rouge Pierre de Ronsard'" }, { name: "アイスバーグ", sci: "Rosa 'Iceberg'" },
        { name: "つるアイスバーグ", sci: "Rosa 'Climbing Iceberg'" }, { name: "クイーンエリザベス", sci: "Rosa 'Queen Elizabeth'" }, { name: "ナエマ", sci: "Rosa 'Nahema'" }, { name: "グラハムトーマス", sci: "Rosa 'Graham Thomas'" },
        { name: "ジュードジオブスキュア", sci: "Rosa 'Jude the Obscure'" }, { name: "ボレロ", sci: "Rosa 'Bolero'" }, { name: "アブラハムダービー", sci: "Rosa 'Abraham Darby'" }, { name: "レディオブシャーロット", sci: "Rosa 'Lady of Shalott'" },
        { name: "ジュビリーセレブレーション", sci: "Rosa 'Jubilee Celebration'" }, { name: "マンステッドウッド", sci: "Rosa 'Munstead Wood'" }, { name: "シェエラザード", sci: "Rosa 'Scheherazade'" }, { name: "オデュッセイア", sci: "Rosa 'Odysseia'" },
        { name: "アンナプルナ", sci: "Rosa 'Annapurna'" }, { name: "ラフランス", sci: "Rosa 'La France'" }, { name: "クロードモネ", sci: "Rosa 'Claude Monet'" }, { name: "ローズポンパドゥール", sci: "Rosa 'Rose Pompadour'" },
        { name: "ガブリエル", sci: "Rosa 'Gabriel'" }, { name: "オールドローズ", sci: "Rosa" }, { name: "つるバラ", sci: "Rosa" }, { name: "ミニバラ", sci: "Rosa" },
        { name: "イングリッシュローズ", sci: "Rosa" }, { name: "河本バラ", sci: "Rosa" }, { name: "和ばら", sci: "Rosa" },
        { name: "アンブリッジローズ", sci: "Rosa 'Ambridge Rose'" }, { name: "クイーンオブスウェーデン", sci: "Rosa 'Queen of Sweden'" }, { name: "ガブリエルオーク", sci: "Rosa 'Gabriel Oak'" }, { name: "オリビアローズオースチン", sci: "Rosa 'Olivia Rose Austin'" },
        { name: "ガートルードジェキル", sci: "Rosa 'Gertrude Jekyll'" }, { name: "クラウンプリンセスマルガリータ", sci: "Rosa 'Crown Princess Margareta'" }, { name: "レディエマハミルトン", sci: "Rosa 'Lady Emma Hamilton'" }, { name: "ウォラトンオールドホール", sci: "Rosa 'Wollerton Old Hall'" },
      ] },
    ],
  },
  {
    label: "草花",
    loc: { en: "Flowering Plants", zh: "草花", es: "Plantas Florales" },
    genera: [
      { name: "クレマチス", pickable: true, loc: { en: "Clematis", zh: "铁线莲", es: "Clematis" }, varieties: [
        { name: "モンタナ", sci: "Clematis montana" }, { name: "モンタナルーベンス", sci: "Clematis montana var. rubens" }, { name: "ジャックマニー", sci: "Clematis 'Jackmanii'" }, { name: "テキセンシス", sci: "Clematis texensis" },
        { name: "ヴィチセラ", sci: "Clematis viticella" }, { name: "インテグリフォリア", sci: "Clematis integrifolia" }, { name: "ニオベ", sci: "Clematis 'Niobe'" }, { name: "ドクターラッペル", sci: "Clematis 'Doctor Ruppel'" },
        { name: "篭口", sci: "Clematis 'Rōguchi'" }, { name: "テッセン", sci: "Clematis florida" }, { name: "アーマンディ", sci: "Clematis armandii" },
      ] },
      { name: "アジサイ", pickable: true, loc: { en: "Hydrangea", zh: "绣球花", es: "Hortensia" }, varieties: [
        { name: "アナベル", sci: "Hydrangea arborescens 'Annabelle'" }, { name: "ダンスパーティー", sci: "Hydrangea serrata 'Dance Party'" }, { name: "隅田の花火", sci: "Hydrangea macrophylla 'Sumida-no-hanabi'" }, { name: "墨田の花火", sci: "Hydrangea macrophylla 'Sumida-no-hanabi'" },
        { name: "万華鏡", sci: "Hydrangea macrophylla 'Mangekyo'" }, { name: "ハイドランジア", sci: "Hydrangea macrophylla" }, { name: "ガクアジサイ", sci: "Hydrangea macrophylla f. normalis" }, { name: "ヤマアジサイ", sci: "Hydrangea serrata" },
        { name: "カシワバアジサイ", sci: "Hydrangea quercifolia" }, { name: "ノリウツギ", sci: "Hydrangea paniculata" },
        { name: "こんぺいとう", sci: "Hydrangea 'Konpeito'" }, { name: "ありがとう", sci: "Hydrangea serrata 'Arigato'" }, { name: "コットンキャンディー", sci: "Hydrangea macrophylla 'Cotton Candy'" }, { name: "ひな祭り", sci: "Hydrangea 'Hinamatsuri'" },
        { name: "伊予獅子てまり", sci: "Hydrangea serrata 'Iyo Shishi Temari'" }, { name: "城ヶ崎", sci: "Hydrangea macrophylla f. normalis 'Jogasaki'" },
      ] },
      { name: "ゼラニウム", pickable: true, loc: { en: "Geranium (Pelargonium)", zh: "天竺葵", es: "Geranio" }, aliases: ["ペラルゴニウム"], varieties: [
        { name: "パンジーゼラニウム", sci: "Pelargonium × domesticum" }, { name: "アイビーゼラニウム", sci: "Pelargonium peltatum" }, { name: "ニオイゼラニウム", sci: "Pelargonium", aliases: ["センテッドゼラニウム"] },
        { name: "八重咲きゼラニウム", sci: "Pelargonium" },
      ] },
      { name: "原種シクラメン", pickable: true, loc: { en: "Species cyclamen", zh: "原种仙客来", es: "Ciclamen botánico" }, varieties: [
        { name: "コウム", sci: "Cyclamen coum" }, { name: "ヘデリフォリウム", sci: "Cyclamen hederifolium" }, { name: "プルプラセンス", sci: "Cyclamen purpurascens" }, { name: "ミラビレ", sci: "Cyclamen mirabile" },
        { name: "シリシアム", sci: "Cyclamen cilicium" }, { name: "アルピナム", sci: "Cyclamen alpinum" },
      ] },
      { name: "クリスマスローズ", pickable: true, loc: { en: "Hellebore (Christmas rose)", zh: "铁筷子", es: "Eléboro (Rosa de Navidad)" }, varieties: [
        { name: "ヘレボルス", sci: "Helleborus" }, { name: "ニゲル", sci: "Helleborus niger" }, { name: "ヒブリドゥス", sci: "Helleborus × hybridus" }, { name: "オリエンタリス", sci: "Helleborus orientalis" },
        { name: "シングル", sci: "Helleborus × hybridus" }, { name: "セミダブル", sci: "Helleborus × hybridus" }, { name: "ダブル", sci: "Helleborus × hybridus" }, { name: "ピコティ", sci: "Helleborus × hybridus" },
        { name: "ダークネクタリー", sci: "Helleborus × hybridus" },
      ] },
      { name: "ヒマワリ", pickable: true, loc: { en: "Sunflower", zh: "向日葵", es: "Girasol" }, aliases: ["ひまわり", "向日葵", "サンフラワー", "sunflower"], varieties: [
        { name: "サンリッチ", sci: "Helianthus annuus 'Sunrich'" }, { name: "ビンセント", sci: "Helianthus annuus 'Vincent'" }, { name: "テディベア", sci: "Helianthus annuus 'Teddy Bear'" }, { name: "東北八重", sci: "Helianthus annuus 'Tohoku-yae'" },
        { name: "モネのひまわり", sci: "Helianthus annuus" }, { name: "ゴッホのひまわり", sci: "Helianthus annuus 'Van Gogh'" }, { name: "ムーランルージュ", sci: "Helianthus annuus 'Moulin Rouge'" }, { name: "ロシアひまわり", sci: "Helianthus annuus 'Russian Giant'" },
      ] },
      { name: "アサガオ", pickable: true, loc: { en: "Morning glory", zh: "牵牛花", es: "Ipomoea (Gloria de la mañana)" }, aliases: ["朝顔", "あさがお"], varieties: [
        { name: "団十郎", sci: "Ipomoea nil 'Danjuro'" }, { name: "ヘブンリーブルー", sci: "Ipomoea tricolor 'Heavenly Blue'" }, { name: "西洋朝顔", sci: "Ipomoea tricolor" }, { name: "曜白朝顔", sci: "Ipomoea nil" },
        { name: "変化朝顔", sci: "Ipomoea nil" }, { name: "大輪朝顔", sci: "Ipomoea nil" },
      ] },
      { name: "コスモス", pickable: true, loc: { en: "Cosmos", zh: "波斯菊", es: "Cosmos" }, varieties: [
        { name: "センセーション", sci: "Cosmos bipinnatus 'Sensation'" }, { name: "イエローキャンパス", sci: "Cosmos bipinnatus 'Yellow Campus'" }, { name: "シーシェル", sci: "Cosmos bipinnatus 'Seashells'" }, { name: "ダブルクリック", sci: "Cosmos bipinnatus 'Double Click'" },
        { name: "キバナコスモス", sci: "Cosmos sulphureus" }, { name: "チョコレートコスモス", sci: "Cosmos atrosanguineus" },
      ] },
      { name: "ペチュニア", pickable: true, loc: { en: "Petunia", zh: "矮牵牛", es: "Petunia" }, varieties: [
        { name: "サフィニア", sci: "Petunia 'Surfinia'" }, { name: "サフィニアアート", sci: "Petunia 'Surfinia Art'" }, { name: "スーパーチュニア", sci: "Petunia 'Supertunia'" }, { name: "バカラ", sci: "Petunia 'Baccarat'" },
        { name: "ナイトスカイ", sci: "Petunia 'Night Sky'" }, { name: "ブリエッタ", sci: "Petunia 'Brietta'" }, { name: "カリブラコア", sci: "Calibrachoa" },
      ] },
      { name: "マリーゴールド", pickable: true, loc: { en: "Marigold", zh: "万寿菊", es: "Tagete (Maravilla)" }, varieties: [
        { name: "フレンチマリーゴールド", sci: "Tagetes patula" }, { name: "アフリカンマリーゴールド", sci: "Tagetes erecta" }, { name: "ストロベリーブロンド", sci: "Tagetes 'Strawberry Blonde'" }, { name: "ボナンザ", sci: "Tagetes patula 'Bonanza'" },
      ] },
      { name: "サルビア", pickable: true, loc: { en: "Salvia", zh: "鼠尾草", es: "Salvia" }, aliases: ["セージ"], varieties: [
        { name: "スプレンデンス", sci: "Salvia splendens" }, { name: "ブルーサルビア", sci: "Salvia farinacea", aliases: ["ファリナセア"] }, { name: "ガラニチカ", sci: "Salvia guaranitica" },
        { name: "メキシカンセージ", sci: "Salvia leucantha", aliases: ["レウカンサ"] }, { name: "ネモローサ", sci: "Salvia nemorosa" },
      ] },
      { name: "ガーベラ", pickable: true, loc: { en: "Gerbera", zh: "非洲菊", es: "Gerbera" }, varieties: [
        { name: "ガービー", sci: "Gerbera 'Gerbie'" }, { name: "スパイダー咲き", sci: "Gerbera" }, { name: "ミニガーベラ", sci: "Gerbera" }, { name: "パスタ", sci: "Gerbera 'Pasta'" },
      ] },
      { name: "キク", pickable: true, loc: { en: "Chrysanthemum", zh: "菊花", es: "Crisantemo" }, aliases: ["菊", "マム"], varieties: [
        { name: "ポットマム", sci: "Chrysanthemum × morifolium" }, { name: "スプレーマム", sci: "Chrysanthemum × morifolium" }, { name: "ガーデンマム", sci: "Chrysanthemum × morifolium" }, { name: "クッションマム", sci: "Chrysanthemum × morifolium" },
        { name: "古典菊", sci: "Chrysanthemum × morifolium" }, { name: "嵯峨菊", sci: "Chrysanthemum × morifolium 'Saga'" }, { name: "江戸菊", sci: "Chrysanthemum × morifolium 'Edo'" }, { name: "肥後菊", sci: "Chrysanthemum × morifolium 'Higo'" },
        { name: "厚物", sci: "Chrysanthemum × morifolium" }, { name: "管物", sci: "Chrysanthemum × morifolium" }, { name: "イソギク", sci: "Chrysanthemum pacificum" },
      ] },
      { name: "ナデシコ", pickable: true, loc: { en: "Dianthus (Pink)", zh: "石竹", es: "Clavelina (Dianthus)" }, aliases: ["ダイアンサス"], varieties: [
        { name: "カワラナデシコ", sci: "Dianthus superbus var. longicalycinus" }, { name: "なでしこ", sci: "Dianthus" }, { name: "テルスター", sci: "Dianthus 'Telstar'" }, { name: "ビジョナデシコ", sci: "Dianthus barbatus", aliases: ["アメリカナデシコ"] },
      ] },
      { name: "ジニア", pickable: true, loc: { en: "Zinnia", zh: "百日草", es: "Zinnia" }, aliases: ["百日草", "ヒャクニチソウ"], varieties: [
        { name: "プロフュージョン", sci: "Zinnia 'Profusion'" }, { name: "ジニアリネアリス", sci: "Zinnia angustifolia" }, { name: "ザハラ", sci: "Zinnia 'Zahara'" }, { name: "クイーンライム", sci: "Zinnia elegans 'Queen Lime'" },
      ] },
      { name: "パンジー", pickable: true, loc: { en: "Pansy", zh: "三色堇", es: "Pensamiento" }, aliases: ["ビオラ"], varieties: [
        { name: "ビオラ", sci: "Viola" }, { name: "よく咲くスミレ", sci: "Viola 'Yoku-saku-sumire'" }, { name: "ヌーヴェルヴァーグ", sci: "Viola 'Nouvelle Vague'" }, { name: "ムーランフリル", sci: "Viola 'Moulin Frill'" },
        { name: "フリズルシズル", sci: "Viola × wittrockiana 'Frizzle Sizzle'" }, { name: "見元ビオラ", sci: "Viola" }, { name: "ローブドアンティーク", sci: "Viola 'Robe d'Antique'" },
      ] },
      { name: "キンセンカ", pickable: true, loc: { en: "Calendula (Pot marigold)", zh: "金盏花", es: "Caléndula" }, aliases: ["カレンデュラ"], varieties: [
        { name: "冬知らず", sci: "Calendula arvensis 'Fuyu-shirazu'" }, { name: "コーヒークリーム", sci: "Calendula officinalis 'Coffee Cream'" }, { name: "オレンジキング", sci: "Calendula officinalis 'Orange King'" },
      ] },
      { name: "ケイトウ", pickable: true, loc: { en: "Celosia (Cockscomb)", zh: "鸡冠花", es: "Celosia (Cresta de gallo)" }, aliases: ["セロシア"], varieties: [
        { name: "久留米ケイトウ", sci: "Celosia argentea var. cristata" }, { name: "ノゲイトウ", sci: "Celosia argentea" }, { name: "羽毛ケイトウ", sci: "Celosia argentea var. plumosa" }, { name: "ヤリゲイトウ", sci: "Celosia argentea var. spicata" },
      ] },
      { name: "シャクヤク", pickable: true, loc: { en: "Peony (Chinese peony)", zh: "芍药", es: "Peonía" }, aliases: ["芍薬", "しゃくやく"], varieties: [
        { name: "サラ・ベルナール", sci: "Paeonia lactiflora 'Sarah Bernhardt'" }, { name: "滝の粧", sci: "Paeonia lactiflora 'Taki-no-yosooi'" }, { name: "夕映", sci: "Paeonia lactiflora 'Yubae'" }, { name: "春の粧", sci: "Paeonia lactiflora 'Haru-no-yosooi'" },
        { name: "コーラルチャーム", sci: "Paeonia 'Coral Charm'" }, { name: "火祭", sci: "Paeonia lactiflora 'Himatsuri'" }, { name: "バロネスシュローダー", sci: "Paeonia lactiflora 'Baroness Schroeder'" },
      ] },
      { name: "コキア", pickable: true, loc: { en: "Kochia (Summer cypress)", zh: "地肤", es: "Kochia" }, varieties: [
        { name: "ホウキギ", sci: "Bassia scoparia", aliases: ["ホウキグサ"] },
      ] },
      { name: "その他人気草花", pickable: false, loc: { en: "Other popular flowers", zh: "其他人气草花", es: "Otras flores populares" }, varieties: [
        { name: "プリムラ", sci: "Primula" }, { name: "多年草" }, { name: "宿根草" }, { name: "原種チューリップ", sci: "Tulipa" },
        { name: "ダリア", sci: "Dahlia" }, { name: "花菖蒲", sci: "Iris ensata var. ensata" }, { name: "君子蘭", sci: "Clivia miniata" },
      ] },
    ],
  },
  {
    label: "球根",
    loc: { en: "Bulbs", zh: "球根植物", es: "Bulbos" },
    genera: [
      { name: "チューリップ", pickable: true, loc: { en: "Tulip", zh: "郁金香", es: "Tulipán" }, varieties: [
        { name: "アンジェリケ", sci: "Tulipa 'Angelique'" }, { name: "ブルーダイヤモンド", sci: "Tulipa 'Blue Diamond'" }, { name: "クイーンオブナイト", sci: "Tulipa 'Queen of Night'" }, { name: "アプリコットビューティー", sci: "Tulipa 'Apricot Beauty'" },
        { name: "原種チューリップ", sci: "Tulipa" }, { name: "パーロット咲き", sci: "Tulipa" }, { name: "フリンジ咲き", sci: "Tulipa" }, { name: "ユリ咲き", sci: "Tulipa" },
        { name: "八重咲きチューリップ", sci: "Tulipa" },
      ] },
      { name: "スイセン", pickable: true, loc: { en: "Daffodil", zh: "水仙", es: "Narciso" }, aliases: ["水仙", "ナルシサス"], varieties: [
        { name: "日本水仙", sci: "Narcissus tazetta var. chinensis" }, { name: "ラッパスイセン", sci: "Narcissus pseudonarcissus" }, { name: "テタテート", sci: "Narcissus 'Tête-à-Tête'" }, { name: "ペーパーホワイト", sci: "Narcissus papyraceus" },
        { name: "口紅水仙", sci: "Narcissus poeticus" }, { name: "八重咲きスイセン", sci: "Narcissus" },
      ] },
      { name: "ヒヤシンス", pickable: true, loc: { en: "Hyacinth", zh: "风信子", es: "Jacinto" }, varieties: [
        { name: "デルフトブルー", sci: "Hyacinthus orientalis 'Delft Blue'" }, { name: "ピンクパール", sci: "Hyacinthus orientalis 'Pink Pearl'" }, { name: "ジャンボス", sci: "Hyacinthus orientalis 'Jan Bos'" }, { name: "カーネギー", sci: "Hyacinthus orientalis 'Carnegie'" },
        { name: "ローマンヒヤシンス", sci: "Hyacinthus orientalis var. albulus" },
      ] },
      { name: "ユリ", pickable: true, loc: { en: "Lily", zh: "百合", es: "Lirio" }, aliases: ["リリー", "百合"], varieties: [
        { name: "カサブランカ", sci: "Lilium 'Casa Blanca'" }, { name: "オリエンタルリリー", sci: "Lilium" }, { name: "テッポウユリ", sci: "Lilium longiflorum" }, { name: "スカシユリ", sci: "Lilium maculatum" },
        { name: "ヤマユリ", sci: "Lilium auratum" }, { name: "カノコユリ", sci: "Lilium speciosum" }, { name: "オニユリ", sci: "Lilium lancifolium" }, { name: "LAハイブリッド", sci: "Lilium" },
      ] },
      { name: "クロッカス", pickable: true, loc: { en: "Crocus", zh: "番红花", es: "Croco" }, varieties: [
        { name: "ジャンヌダルク", sci: "Crocus vernus 'Jeanne d'Arc'" }, { name: "クリームビューティー", sci: "Crocus chrysanthus 'Cream Beauty'" }, { name: "サフラン", sci: "Crocus sativus" }, { name: "原種クロッカス", sci: "Crocus" },
      ] },
      { name: "アマリリス", pickable: true, loc: { en: "Amaryllis", zh: "朱顶红", es: "Amarilis" }, aliases: ["ヒッペアストルム"], varieties: [
        { name: "アップルブロッサム", sci: "Hippeastrum 'Apple Blossom'" }, { name: "レッドライオン", sci: "Hippeastrum 'Red Lion'" }, { name: "ダブルドリーム", sci: "Hippeastrum 'Double Dream'" }, { name: "パピリオ", sci: "Hippeastrum papilio" },
      ] },
      { name: "グラジオラス", pickable: true, loc: { en: "Gladiolus", zh: "唐菖蒲", es: "Gladiolo" }, varieties: [
        { name: "夏咲きグラジオラス", sci: "Gladiolus × grandiflorus" }, { name: "春咲きグラジオラス", sci: "Gladiolus" },
      ] },
      { name: "ムスカリ", pickable: true, loc: { en: "Muscari", zh: "葡萄风信子", es: "Muscari" }, varieties: [
        { name: "アルメニアカム", sci: "Muscari armeniacum" }, { name: "ホワイトマジック", sci: "Muscari 'White Magic'" }, { name: "ラティフォリウム", sci: "Muscari latifolium" }, { name: "オーシャンマジック", sci: "Muscari 'Ocean Magic'" },
      ] },
      { name: "カンナ", pickable: true, loc: { en: "Canna", zh: "美人蕉", es: "Canna" }, varieties: [
        { name: "トロピカンナ", sci: "Canna 'Phasion'" }, { name: "クレオパトラ", sci: "Canna 'Cleopatra'" }, { name: "ベンガルタイガー", sci: "Canna 'Bengal Tiger'" }, { name: "イエローキングフンベルト", sci: "Canna 'Yellow King Humbert'" },
      ] },
      { name: "アガパンサス", pickable: true, loc: { en: "Agapanthus", zh: "百子莲", es: "Agapanto" }, varieties: [
        { name: "アフリカヌス", sci: "Agapanthus africanus" }, { name: "プラエコクス", sci: "Agapanthus praecox" }, { name: "ヘッドボーンハイブリッド", sci: "Agapanthus Headbourne Hybrids" }, { name: "ピーターパン", sci: "Agapanthus 'Peter Pan'" },
      ] },
      { name: "グロリオサ", pickable: true, loc: { en: "Gloriosa", zh: "嘉兰", es: "Gloriosa" }, varieties: [
        { name: "ロスチャイルディアナ", sci: "Gloriosa superba 'Rothschildiana'" },
      ] },
      { name: "その他球根", pickable: false, loc: { en: "Other bulbs", zh: "其他球根", es: "Otros bulbos" }, varieties: [
        { name: "スノードロップ", sci: "Galanthus nivalis" }, { name: "スノーフレーク", sci: "Leucojum aestivum" }, { name: "アネモネ", sci: "Anemone coronaria" }, { name: "ラナンキュラス", sci: "Ranunculus asiaticus" },
        { name: "フリージア", sci: "Freesia" }, { name: "チオノドクサ", sci: "Scilla forbesii" }, { name: "ハナニラ", sci: "Ipheion uniflorum", aliases: ["イフェイオン"] },
        { name: "アリウム", sci: "Allium" }, { name: "コルチカム", sci: "Colchicum autumnale" }, { name: "ネリネ", sci: "Nerine" }, { name: "ダッチアイリス", sci: "Iris × hollandica" },
      ] },
    ],
  },
  {
    label: "花木・庭木",
    loc: { en: "Flowering Trees & Shrubs", zh: "花木", es: "Árboles y Arbustos Ornamentales" },
    genera: [
      { name: "ツツジ", pickable: true, loc: { en: "Azalea", zh: "杜鹃花", es: "Azalea" }, aliases: ["躑躅"], varieties: [
        { name: "クルメツツジ", sci: "Rhododendron × obtusum" }, { name: "ヒラドツツジ", sci: "Rhododendron × pulchrum" }, { name: "オオムラサキ", sci: "Rhododendron × pulchrum 'Oomurasaki'" }, { name: "ミツバツツジ", sci: "Rhododendron dilatatum" },
        { name: "ヤマツツジ", sci: "Rhododendron kaempferi" }, { name: "レンゲツツジ", sci: "Rhododendron japonicum" }, { name: "シャクナゲ", sci: "Rhododendron" },
      ] },
      { name: "サツキ", pickable: true, loc: { en: "Satsuki Azalea", zh: "皋月杜鹃", es: "Azalea satsuki" }, aliases: ["皐月", "さつき盆栽"], varieties: [
        { name: "大盃", sci: "Rhododendron indicum 'Oosakazuki'" }, { name: "日光", sci: "Rhododendron indicum 'Nikko'" }, { name: "鹿沼", sci: "Rhododendron indicum 'Kanuma'" }, { name: "暁天", sci: "Rhododendron indicum 'Gyoten'" },
        { name: "晃山", sci: "Rhododendron indicum 'Kozan'" }, { name: "月光", sci: "Rhododendron indicum 'Gekko'" }, { name: "白光", sci: "Rhododendron indicum 'Hakko'" }, { name: "松鏡", sci: "Rhododendron indicum 'Matsukagami'" }, { name: "長寿宝", sci: "Rhododendron indicum 'Chojuho'" },
      ] },
      { name: "ツバキ", pickable: true, loc: { en: "Camellia", zh: "山茶", es: "Camelia" }, aliases: ["椿", "カメリア"], varieties: [
        { name: "侘助", sci: "Camellia 'Wabisuke'" }, { name: "乙女椿", sci: "Camellia japonica 'Otome'" }, { name: "数寄屋侘助", sci: "Camellia 'Sukiya'" }, { name: "卜伴", sci: "Camellia japonica 'Bokuhan'" },
        { name: "玉之浦", sci: "Camellia japonica 'Tama-no-ura'" }, { name: "ヤブツバキ", sci: "Camellia japonica" }, { name: "肥後椿", sci: "Camellia japonica 'Higo'" },
      ] },
      { name: "サザンカ", pickable: true, loc: { en: "Sasanqua Camellia", zh: "茶梅", es: "Camelia sasanqua" }, aliases: ["山茶花"], varieties: [
        { name: "朝倉", sci: "Camellia sasanqua 'Asakura'" }, { name: "勘次郎", sci: "Camellia sasanqua 'Kanjiro'" }, { name: "富士の峰", sci: "Camellia sasanqua 'Fuji-no-mine'" }, { name: "獅子頭", sci: "Camellia sasanqua 'Shishigashira'" },
      ] },
      { name: "アジサイ以外の花木", pickable: false, loc: { en: "Flowering trees (other than Hydrangea)", zh: "绣球花以外的花木", es: "Árboles con flor (excepto hortensia)" }, varieties: [
        { name: "キンモクセイ", sci: "Osmanthus fragrans var. aurantiacus", aliases: ["金木犀"] }, { name: "ギンモクセイ", sci: "Osmanthus fragrans", aliases: ["銀木犀"] }, { name: "ジンチョウゲ", sci: "Daphne odora", aliases: ["沈丁花"] }, { name: "クチナシ", sci: "Gardenia jasminoides" },
        { name: "ハナミズキ", sci: "Cornus florida" }, { name: "ヤマボウシ", sci: "Cornus kousa" }, { name: "モクレン", sci: "Magnolia liliiflora" }, { name: "コブシ", sci: "Magnolia kobus" },
        { name: "サルスベリ", sci: "Lagerstroemia indica", aliases: ["百日紅"] }, { name: "ライラック", sci: "Syringa vulgaris" }, { name: "ユキヤナギ", sci: "Spiraea thunbergii" }, { name: "レンギョウ", sci: "Forsythia suspensa" },
        { name: "ボケ", sci: "Chaenomeles speciosa" }, { name: "コデマリ", sci: "Spiraea cantoniensis" }, { name: "ナンテン", sci: "Nandina domestica", aliases: ["南天"] }, { name: "センリョウ", sci: "Sarcandra glabra" },
        { name: "マンリョウ", sci: "Ardisia crenata" }, { name: "ムクゲ", sci: "Hibiscus syriacus" }, { name: "フヨウ", sci: "Hibiscus mutabilis" }, { name: "キョウチクトウ", sci: "Nerium oleander" },
        { name: "ロウバイ", sci: "Chimonanthus praecox", aliases: ["蝋梅"] }, { name: "ピラカンサ", sci: "Pyracantha" }, { name: "ウメモドキ", sci: "Ilex serrata" }, { name: "ロウヤガキ", sci: "Diospyros rhombifolia", aliases: ["老爺柿"] },
      ] },
      { name: "モミジ", pickable: true, loc: { en: "Japanese Maple", zh: "红叶", es: "Arce japonés" }, aliases: ["紅葉", "カエデ", "もみじ", "楓"], varieties: [
        { name: "イロハモミジ", sci: "Acer palmatum" }, { name: "ヤマモミジ", sci: "Acer palmatum subsp. matsumurae", aliases: ["山もみじ"] }, { name: "デショウジョウ", sci: "Acer palmatum 'Deshojo'", aliases: ["出猩々"] }, { name: "野村もみじ", sci: "Acer palmatum 'Nomura'" },
        { name: "獅子頭", sci: "Acer palmatum 'Shishigashira'" }, { name: "青枝垂れ", sci: "Acer palmatum 'Ao-shidare'" }, { name: "トウカエデ", sci: "Acer buergerianum", aliases: ["唐楓"] },
      ] },
      { name: "ウメ", pickable: true, loc: { en: "Japanese Apricot", zh: "梅", es: "Ciruelo japonés" }, aliases: ["梅"], varieties: [
        { name: "南高", sci: "Prunus mume 'Nankou'" }, { name: "白加賀", sci: "Prunus mume 'Shirakaga'" }, { name: "豊後", sci: "Prunus mume 'Bungo'" }, { name: "鶯宿", sci: "Prunus mume 'Ōshuku'" },
        { name: "枝垂れ梅", sci: "Prunus mume f. pendula" }, { name: "思いのまま", sci: "Prunus mume 'Omoi-no-mama'" }, { name: "長寿梅", sci: "Chaenomeles japonica 'Chojubai'" },
      ] },
      { name: "サクラ", pickable: true, loc: { en: "Cherry Blossom", zh: "樱花", es: "Cerezo" }, aliases: ["桜"], varieties: [
        { name: "ソメイヨシノ", sci: "Cerasus × yedoensis 'Somei-yoshino'" }, { name: "枝垂れ桜", sci: "Cerasus spachiana" }, { name: "八重桜", sci: "Cerasus serrulata 'Sekiyama'" }, { name: "河津桜", sci: "Cerasus 'Kawazu-zakura'" },
        { name: "陽光", sci: "Cerasus 'Yoko'" }, { name: "旭山桜", sci: "Cerasus serrulata 'Asahiyama'" }, { name: "富士桜", sci: "Cerasus incisa" }, { name: "ヤマザクラ", sci: "Cerasus jamasakura" },
      ] },
      { name: "ボタン", pickable: true, loc: { en: "Tree Peony", zh: "牡丹", es: "Peonía arbórea" }, aliases: ["牡丹", "ぼたん"], varieties: [
        { name: "島大臣", sci: "Paeonia suffruticosa 'Shima-daijin'" }, { name: "八千代椿", sci: "Paeonia suffruticosa 'Yachiyo-tsubaki'" }, { name: "新国色", sci: "Paeonia suffruticosa 'Shin-kokushoku'" }, { name: "花競", sci: "Paeonia suffruticosa 'Hanakurabe'" },
        { name: "鎌田藤", sci: "Paeonia suffruticosa 'Kamada-fuji'" }, { name: "鎌田錦", sci: "Paeonia suffruticosa 'Kamada-nishiki'" }, { name: "ハイヌーン", sci: "Paeonia × 'High Noon'" },
        { name: "太陽", sci: "Paeonia suffruticosa 'Taiyo'" },
      ] },
      // #409 P-dissolve: 旧「盆栽」カテゴリ解体。針葉樹（松柏類・園芸コニファー）は「庭木」＝ここに一本化する
      // （花を咲かせない裸子植物だが「花木・庭木」の庭木側に属する＝kako-jun）。今後の針葉樹も全てここ＝特別扱いしない。
      // 松柏（盆栽の松/真柏…）と園芸コニファー（ゴールドクレスト…）は性格が違うので2属に分けるが、どちらも aliases に
      // 「針葉樹」を持たせ "針葉樹" 検索で1か所に揃う。
      { name: "松柏類", pickable: false, loc: { en: "Conifers", zh: "松柏类", es: "Coníferas" }, aliases: ["針葉樹", "松柏"], varieties: [
        { name: "黒松", sci: "Pinus thunbergii" }, { name: "五葉松", sci: "Pinus parviflora" }, { name: "赤松", sci: "Pinus densiflora" }, { name: "錦松", sci: "Pinus thunbergii 'Nishikimatsu'" },
        { name: "真柏", sci: "Juniperus chinensis var. sargentii" }, { name: "糸魚川真柏", sci: "Juniperus chinensis var. sargentii" }, { name: "杜松", sci: "Juniperus rigida" }, { name: "蝦夷松", sci: "Picea jezoensis" },
        { name: "唐松", sci: "Larix kaempferi" }, { name: "杉", sci: "Cryptomeria japonica" }, { name: "桧", sci: "Chamaecyparis obtusa" }, { name: "石化檜", sci: "Chamaecyparis obtusa" },
        { name: "一位", sci: "Taxus cuspidata" },
      ] },
      { name: "雑木", pickable: true, loc: { en: "Deciduous trees", zh: "杂木", es: "Árboles caducifolios" }, aliases: ["落葉樹", "雑木盆栽"], varieties: [
        { name: "ケヤキ", sci: "Zelkova serrata", aliases: ["欅"] }, { name: "ブナ", sci: "Fagus crenata" },
      ] },
      { name: "コニファー", pickable: true, loc: { en: "Conifer", zh: "针叶树", es: "Conífera" }, aliases: ["針葉樹"], varieties: [
        { name: "ゴールドクレスト", sci: "Cupressus macrocarpa 'Goldcrest'" }, { name: "エメラルドグリーン", sci: "Thuja occidentalis 'Smaragd'" }, { name: "ブルーアイス", sci: "Cupressus arizonica 'Blue Ice'" }, { name: "ブルーヘブン", sci: "Juniperus scopulorum 'Blue Heaven'" },
        { name: "カイヅカイブキ", sci: "Juniperus chinensis 'Kaizuka'" },
      ] },
    ],
  },
  {
    label: "野菜",
    loc: { en: "Vegetables", zh: "蔬菜", es: "Hortalizas" },
    genera: [
      { name: "トマト", pickable: true, loc: { en: "Tomato", zh: "番茄", es: "Tomate" }, varieties: [
        { name: "桃太郎", sci: "Solanum lycopersicum 'Momotaro'" }, { name: "ホーム桃太郎", sci: "Solanum lycopersicum 'Home Momotaro'" }, { name: "麗夏", sci: "Solanum lycopersicum 'Reika'" }, { name: "りんか409", sci: "Solanum lycopersicum 'Rinka 409'" },
        { name: "大玉トマト", sci: "Solanum lycopersicum" }, { name: "フルティカ", sci: "Solanum lycopersicum 'Frutica'" }, { name: "レッドオーレ", sci: "Solanum lycopersicum 'Red Ole'" }, { name: "中玉トマト", sci: "Solanum lycopersicum" },
        { name: "シシリアンルージュ", sci: "Solanum lycopersicum 'Sicilian Rouge'" }, { name: "アイコ", sci: "Solanum lycopersicum 'Aiko'" }, { name: "イエローアイコ", sci: "Solanum lycopersicum 'Yellow Aiko'" }, { name: "オレンジアイコ", sci: "Solanum lycopersicum 'Orange Aiko'" },
        { name: "千果", sci: "Solanum lycopersicum 'Senka'" }, { name: "ステラミニトマト", sci: "Solanum lycopersicum 'Stella'" }, { name: "ミニトマト", sci: "Solanum lycopersicum var. cerasiforme" }, { name: "サンマルツァーノ", sci: "Solanum lycopersicum 'San Marzano'" },
        { name: "ピンキー", sci: "Solanum lycopersicum 'Pinky'" }, { name: "プチぷよ", sci: "Solanum lycopersicum 'Petit Puyo'" }, { name: "トマトベリー", sci: "Solanum lycopersicum 'Tomato Berry'" }, { name: "純あま", sci: "Solanum lycopersicum 'Jun-ama'" },
      ] },
      { name: "ナス", pickable: true, loc: { en: "Eggplant", zh: "茄子", es: "Berenjena" }, varieties: [
        { name: "千両", sci: "Solanum melongena 'Senryo'" }, { name: "千両二号", sci: "Solanum melongena 'Senryo No.2'" }, { name: "庄屋大長", sci: "Solanum melongena 'Shoya Onaga'" }, { name: "賀茂なす", sci: "Solanum melongena 'Kamo Nasu'" },
        { name: "水なす", sci: "Solanum melongena 'Mizu Nasu'" }, { name: "米なす", sci: "Solanum melongena 'Beinasu'" }, { name: "白なす", sci: "Solanum melongena 'Shiro Nasu'" }, { name: "ヴィオレッタ", sci: "Solanum melongena 'Violetta'" },
        { name: "筑陽", sci: "Solanum melongena 'Chikuyo'" }, { name: "中長なす", sci: "Solanum melongena 'Chunaga'" }, { name: "仙台長なす", sci: "Solanum melongena 'Sendai Naganasu'" }, { name: "翡翠なす", sci: "Solanum melongena 'Hisui Nasu'" },
        { name: "丸なす", sci: "Solanum melongena 'Marunasu'" },
      ] },
      { name: "きゅうり", pickable: true, loc: { en: "Cucumber", zh: "黄瓜", es: "Pepino" }, varieties: [
        { name: "夏すずみ", sci: "Cucumis sativus 'Natsusuzumi'" }, { name: "四葉", sci: "Cucumis sativus 'Suyo'" }, { name: "スーヨー", sci: "Cucumis sativus 'Suyo'" }, { name: "Vロード", sci: "Cucumis sativus 'V Road'" },
        { name: "北進", sci: "Cucumis sativus 'Hokushin'" }, { name: "ときわ", sci: "Cucumis sativus 'Tokiwa'" }, { name: "加賀太きゅうり", sci: "Cucumis sativus 'Kaga Futo'" }, { name: "地這きゅうり", sci: "Cucumis sativus 'Jibai'" },
        { name: "ラリーノ", sci: "Cucumis sativus 'Larino'" },
      ] },
      { name: "ピーマン・唐辛子", pickable: false, loc: { en: "Peppers & Chili", zh: "甜椒·辣椒", es: "Pimientos y chiles" }, varieties: [
        { name: "京みどり", sci: "Capsicum annuum 'Kyo Midori'" }, { name: "こどもピーマン", sci: "Capsicum annuum 'Kodomo Piman'" }, { name: "ピー太郎", sci: "Capsicum annuum 'Pii-taro'" }, { name: "甘とう美人", sci: "Capsicum annuum 'Amato Bijin'" },
        { name: "パプリカ", sci: "Capsicum annuum 'Paprika'" }, { name: "万願寺とうがらし", sci: "Capsicum annuum 'Manganji'" }, { name: "伏見甘長", sci: "Capsicum annuum 'Fushimi Amanaga'" }, { name: "ししとう", sci: "Capsicum annuum 'Shishito'" },
        { name: "鷹の爪", sci: "Capsicum annuum 'Takanotsume'" }, { name: "ハバネロ", sci: "Capsicum chinense 'Habanero'" }, { name: "ブートジョロキア", sci: "Capsicum chinense 'Bhut Jolokia'" },
      ] },
      { name: "枝豆", pickable: true, loc: { en: "Edamame", zh: "毛豆", es: "Edamame" }, varieties: [
        { name: "湯あがり娘", sci: "Glycine max 'Yuagari Musume'" }, { name: "快豆黒頭巾", sci: "Glycine max 'Kaito Kurozukin'" }, { name: "だだちゃ豆", sci: "Glycine max 'Dadacha-mame'" }, { name: "黒豆", sci: "Glycine max 'Kuromame'" },
        { name: "丹波黒", sci: "Glycine max 'Tamba Kuro'" }, { name: "茶豆", sci: "Glycine max 'Chamame'" }, { name: "秘伝", sci: "Glycine max 'Hiden'" }, { name: "サヤムスメ", sci: "Glycine max 'Saya Musume'" },
        { name: "くろさき茶豆", sci: "Glycine max 'Kurosaki Chamame'" },
      ] },
      { name: "とうもろこし", pickable: true, loc: { en: "Corn", zh: "玉米", es: "Maíz" }, varieties: [
        { name: "ゴールドラッシュ", sci: "Zea mays 'Gold Rush'" }, { name: "味来", sci: "Zea mays 'Mirai'" }, { name: "ピュアホワイト", sci: "Zea mays 'Pure White'" }, { name: "ハニーバンタム", sci: "Zea mays 'Honey Bantam'" },
        { name: "恵味", sci: "Zea mays 'Megumi'" }, { name: "ドルチェドリーム", sci: "Zea mays 'Dolce Dream'" }, { name: "甘々娘", sci: "Zea mays 'Kankan Musume'" }, { name: "おおもの", sci: "Zea mays 'Omono'" },
        { name: "ピーターコーン", sci: "Zea mays 'Peter Corn'" }, { name: "ミルキースイーツ", sci: "Zea mays 'Milky Sweets'" },
      ] },
      { name: "かぼちゃ", pickable: true, loc: { en: "Pumpkin", zh: "南瓜", es: "Calabaza" }, varieties: [
        { name: "坊っちゃん", sci: "Cucurbita maxima 'Bocchan'" }, { name: "バターナッツ", sci: "Cucurbita moschata 'Butternut'" }, { name: "雪化粧", sci: "Cucurbita maxima 'Yukigesho'" }, { name: "えびす", sci: "Cucurbita maxima 'Ebisu'" },
        { name: "ロロン", sci: "Cucurbita maxima 'Roron'" }, { name: "栗マロン", sci: "Cucurbita maxima 'Kuri Maron'" }, { name: "みやこ", sci: "Cucurbita maxima 'Miyako'" }, { name: "九重栗", sci: "Cucurbita maxima 'Kokonoe Guri'" },
        { name: "コリンキー", sci: "Cucurbita pepo 'Korinky'" }, { name: "打木赤皮甘栗", sci: "Cucurbita maxima 'Utsugi Akagawa Amaguri'" }, { name: "宿儺かぼちゃ", sci: "Cucurbita moschata 'Sukuna'" }, { name: "金糸瓜", sci: "Cucurbita pepo 'Kinshi-uri'" },
        { name: "万次郎かぼちゃ", sci: "Cucurbita moschata × maxima 'Manjiro'" }, { name: "プッチーニ", sci: "Cucurbita pepo 'Puccini'" },
      ] },
      { name: "さつまいも", pickable: true, loc: { en: "Sweet Potato", zh: "红薯", es: "Boniato" }, varieties: [
        { name: "紅はるか", sci: "Ipomoea batatas 'Beni Haruka'" }, { name: "シルクスイート", sci: "Ipomoea batatas 'Silk Sweet'" }, { name: "安納芋", sci: "Ipomoea batatas 'Anno Imo'" }, { name: "鳴門金時", sci: "Ipomoea batatas 'Naruto Kintoki'" },
        { name: "紅あずま", sci: "Ipomoea batatas 'Beni Azuma'" }, { name: "高系14号", sci: "Ipomoea batatas 'Kokei No.14'" }, { name: "五郎島金時", sci: "Ipomoea batatas 'Gorojima Kintoki'" }, { name: "クイックスイート", sci: "Ipomoea batatas 'Quick Sweet'" },
        { name: "パープルスイートロード", sci: "Ipomoea batatas 'Purple Sweet Road'" }, { name: "紅天使", sci: "Ipomoea batatas 'Beni Tenshi'" }, { name: "甘太くん", sci: "Ipomoea batatas 'Kanta-kun'" },
      ] },
      { name: "じゃがいも", pickable: true, loc: { en: "Potato", zh: "马铃薯", es: "Patata" }, varieties: [
        { name: "キタアカリ", sci: "Solanum tuberosum 'Kita Akari'" }, { name: "男爵", sci: "Solanum tuberosum 'Danshaku'" }, { name: "メークイン", sci: "Solanum tuberosum 'May Queen'" }, { name: "インカのめざめ", sci: "Solanum tuberosum 'Inca no Mezame'" },
        { name: "アンデスレッド", sci: "Solanum tuberosum 'Andes Red'" }, { name: "デストロイヤー", sci: "Solanum tuberosum 'Destroyer'" }, { name: "グラウンドペチカ", sci: "Solanum tuberosum 'Ground Petika'" }, { name: "とうや", sci: "Solanum tuberosum 'Toya'" },
        { name: "ノーザンルビー", sci: "Solanum tuberosum 'Northern Ruby'" }, { name: "シャドークイーン", sci: "Solanum tuberosum 'Shadow Queen'" }, { name: "きたかむい", sci: "Solanum tuberosum 'Kitakamui'" }, { name: "レッドムーン", sci: "Solanum tuberosum 'Red Moon'" },
      ] },
      { name: "いちご", pickable: true, loc: { en: "Strawberry", zh: "草莓", es: "Fresa" }, varieties: [
        { name: "章姫", sci: "Fragaria × ananassa 'Akihime'" }, { name: "紅ほっぺ", sci: "Fragaria × ananassa 'Beni Hoppe'" }, { name: "とちおとめ", sci: "Fragaria × ananassa 'Tochiotome'" }, { name: "あまおう", sci: "Fragaria × ananassa 'Amaou'" },
        { name: "よつぼし", sci: "Fragaria × ananassa 'Yotsuboshi'" }, { name: "宝交早生", sci: "Fragaria × ananassa 'Hoko Wase'" }, { name: "さがほのか", sci: "Fragaria × ananassa 'Sagahonoka'" }, { name: "ゆうべに", sci: "Fragaria × ananassa 'Yubeni'" },
        { name: "桃薫", sci: "Fragaria × ananassa 'Tokun'" }, { name: "女峰", sci: "Fragaria × ananassa 'Nyoho'" }, { name: "淡雪", sci: "Fragaria × ananassa 'Awayuki'" }, { name: "越後姫", sci: "Fragaria × ananassa 'Echigo Hime'" },
        { name: "やよいひめ", sci: "Fragaria × ananassa 'Yayoi Hime'" }, { name: "スカイベリー", sci: "Fragaria × ananassa 'Skyberry'" }, { name: "かおり野", sci: "Fragaria × ananassa 'Kaorino'" }, { name: "とちあいか", sci: "Fragaria × ananassa 'Tochiaika'" },
        { name: "古都華", sci: "Fragaria × ananassa 'Kotoka'" }, { name: "あまりん", sci: "Fragaria × ananassa 'Amarin'" }, { name: "いちごさん", sci: "Fragaria × ananassa 'Ichigo-san'" }, { name: "四季なりイチゴ", sci: "Fragaria × ananassa" },
      ] },
      { name: "オクラ", pickable: true, loc: { en: "Okra", zh: "秋葵", es: "Okra" }, varieties: [
        { name: "アーリーファイブ", sci: "Abelmoschus esculentus 'Early Five'" }, { name: "グリーンソード", sci: "Abelmoschus esculentus 'Green Sword'" }, { name: "ヘルシエ", sci: "Abelmoschus esculentus 'Helsie'" }, { name: "まるみちゃん", sci: "Abelmoschus esculentus 'Marumi-chan'" },
        { name: "ダビデの星", sci: "Abelmoschus esculentus 'Star of David'" }, { name: "平城グリーン", sci: "Abelmoschus esculentus 'Heijo Green'" }, { name: "丸オクラ", sci: "Abelmoschus esculentus 'Maru Okra'" }, { name: "島オクラ", sci: "Abelmoschus esculentus 'Shima Okra'" },
        { name: "八丈オクラ", sci: "Abelmoschus esculentus 'Hachijo Okra'" }, { name: "ミニオクラ", sci: "Abelmoschus esculentus 'Mini Okra'" }, { name: "赤オクラ", sci: "Abelmoschus esculentus 'Aka Okra'" }, { name: "白オクラ", sci: "Abelmoschus esculentus 'Shiro Okra'" },
        { name: "花オクラ", sci: "Abelmoschus manihot" },
      ] },
      { name: "ズッキーニ", pickable: true, loc: { en: "Zucchini", zh: "西葫芦", es: "Calabacín" }, varieties: [
        { name: "ダイナー", sci: "Cucurbita pepo 'Diner'" }, { name: "ブラックトスカ", sci: "Cucurbita pepo 'Black Tosca'" }, { name: "グリーンボート2号", sci: "Cucurbita pepo 'Green Boat No.2'" }, { name: "ゼルダネロ", sci: "Cucurbita pepo 'Zelda Nero'" },
        { name: "オーラム", sci: "Cucurbita pepo 'Aurum'" }, { name: "イエローボート", sci: "Cucurbita pepo 'Yellow Boat'" }, { name: "グリーンエッグ", sci: "Cucurbita pepo 'Green Egg'" }, { name: "UFOズッキーニ", sci: "Cucurbita pepo 'UFO'" },
        { name: "カスタードホワイト", sci: "Cucurbita pepo 'Custard White'" }, { name: "パティパン", sci: "Cucurbita pepo 'Pattypan'" },
      ] },
      { name: "ゴーヤ", pickable: true, loc: { en: "Bitter Melon", zh: "苦瓜", es: "Melón amargo" }, varieties: [
        { name: "あばしゴーヤ", sci: "Momordica charantia 'Abashi'" }, { name: "純白ゴーヤ", sci: "Momordica charantia 'Junpaku'" }, { name: "白ゴーヤ", sci: "Momordica charantia 'Shiro Goya'" }, { name: "願寿ゴーヤ", sci: "Momordica charantia 'Ganju'" },
        { name: "中長ゴーヤ", sci: "Momordica charantia 'Chunaga'" }, { name: "さつま大長れいし", sci: "Momordica charantia 'Satsuma Onaga Reishi'" }, { name: "汐風", sci: "Momordica charantia 'Shiokaze'" }, { name: "島さんご", sci: "Momordica charantia 'Shima Sango'" },
        { name: "節成ゴーヤ", sci: "Momordica charantia 'Fushinari'" },
      ] },
      { name: "大根", pickable: true, loc: { en: "Daikon Radish", zh: "白萝卜", es: "Daikon" }, varieties: [
        { name: "青首大根", sci: "Raphanus sativus 'Aokubi'" }, { name: "耐病総太り", sci: "Raphanus sativus 'Taibyo Sobutori'" }, { name: "宮重大根", sci: "Raphanus sativus 'Miyashige'" }, { name: "三浦大根", sci: "Raphanus sativus 'Miura'" },
        { name: "聖護院大根", sci: "Raphanus sativus 'Shogoin'" }, { name: "桜島大根", sci: "Raphanus sativus 'Sakurajima'" }, { name: "守口大根", sci: "Raphanus sativus 'Moriguchi'" }, { name: "源助大根", sci: "Raphanus sativus 'Gensuke'" },
        { name: "紅芯大根", sci: "Raphanus sativus 'Koshin'" }, { name: "紅くるり大根", sci: "Raphanus sativus 'Beni Kururi'" }, { name: "ビタミン大根", sci: "Raphanus sativus 'Vitamin'" }, { name: "ねずみ大根", sci: "Raphanus sativus 'Nezumi'" },
        { name: "黒大根", sci: "Raphanus sativus 'Kuro Daikon'" }, { name: "辛味大根", sci: "Raphanus sativus 'Karami'" }, { name: "二十日大根", sci: "Raphanus sativus var. sativus", aliases: ["ラディッシュ"] },
      ] },
      { name: "人参", pickable: true, loc: { en: "Carrot", zh: "胡萝卜", es: "Zanahoria" }, varieties: [
        { name: "向陽二号", sci: "Daucus carota 'Koyo No.2'" }, { name: "ベーターリッチ", sci: "Daucus carota 'Beta Rich'" }, { name: "黒田五寸", sci: "Daucus carota 'Kuroda Gosun'" }, { name: "ひとみ五寸", sci: "Daucus carota 'Hitomi Gosun'" },
        { name: "五寸人参", sci: "Daucus carota 'Gosun'" }, { name: "京くれない", sci: "Daucus carota 'Kyo Kurenai'" }, { name: "金時人参", sci: "Daucus carota 'Kintoki'" }, { name: "島人参", sci: "Daucus carota 'Shima Ninjin'" },
        { name: "アロマレッド", sci: "Daucus carota 'Aroma Red'" }, { name: "彩誉", sci: "Daucus carota 'Ayahomare'" }, { name: "国分鮮紅大長", sci: "Daucus carota 'Kokubu Senko Onaga'" }, { name: "パープルヘイズ", sci: "Daucus carota 'Purple Haze'" },
        { name: "紫人参", sci: "Daucus carota 'Murasaki Ninjin'" }, { name: "黒人参", sci: "Daucus carota 'Kuro Ninjin'" }, { name: "スノースティック", sci: "Daucus carota 'Snow Stick'" }, { name: "金美人参", sci: "Daucus carota 'Kinbi Ninjin'" },
      ] },
      { name: "玉ねぎ", pickable: true, loc: { en: "Onion", zh: "洋葱", es: "Cebolla" }, varieties: [
        { name: "泉州黄", sci: "Allium cepa 'Senshu Ki'" }, { name: "猩々赤", sci: "Allium cepa 'Shojo Aka'" }, { name: "ソニック", sci: "Allium cepa 'Sonic'" }, { name: "ネオアース", sci: "Allium cepa 'Neo Earth'" },
        { name: "もみじ3号", sci: "Allium cepa 'Momiji No.3'" }, { name: "ケルたま", sci: "Allium cepa 'Keru Tama'" }, { name: "札幌黄", sci: "Allium cepa 'Sapporo Ki'" }, { name: "湘南レッド", sci: "Allium cepa 'Shonan Red'" },
        { name: "赤玉ねぎ", sci: "Allium cepa 'Aka Tamanegi'" }, { name: "サラダ玉ねぎ", sci: "Allium cepa 'Salad Tamanegi'" }, { name: "ペコロス", sci: "Allium cepa 'Pecoros'" },
      ] },
      { name: "白菜", pickable: true, loc: { en: "Napa Cabbage", zh: "白菜", es: "Col china" }, varieties: [
        { name: "黄ごころ85", sci: "Brassica rapa var. pekinensis 'Kigokoro 85'" }, { name: "黄芯白菜", sci: "Brassica rapa var. pekinensis 'Kishin'" }, { name: "オレンジクイン", sci: "Brassica rapa var. pekinensis 'Orange Queen'" }, { name: "京都三号", sci: "Brassica rapa var. pekinensis 'Kyoto No.3'" },
        { name: "無双", sci: "Brassica rapa var. pekinensis 'Muso'" }, { name: "冬月90", sci: "Brassica rapa var. pekinensis 'Togetsu 90'" }, { name: "娃々菜", sci: "Brassica rapa var. pekinensis 'Wawasai'" }, { name: "ミニ白菜", sci: "Brassica rapa var. pekinensis 'Mini Hakusai'" },
      ] },
      { name: "キャベツ", pickable: true, loc: { en: "Cabbage", zh: "卷心菜", es: "Repollo" }, varieties: [
        { name: "金系201号", sci: "Brassica oleracea var. capitata 'Kinkei No.201'" }, { name: "YR春空", sci: "Brassica oleracea var. capitata 'YR Haruzora'" }, { name: "四季穫", sci: "Brassica oleracea var. capitata 'Shikidori'" }, { name: "初秋", sci: "Brassica oleracea var. capitata 'Shoshu'" },
        { name: "新藍", sci: "Brassica oleracea var. capitata 'Shinran'" }, { name: "富士早生", sci: "Brassica oleracea var. capitata 'Fuji Wase'" }, { name: "札幌大球", sci: "Brassica oleracea var. capitata 'Sapporo Daikyu'" }, { name: "グリーンボール", sci: "Brassica oleracea var. capitata 'Green Ball'" },
        { name: "サボイキャベツ", sci: "Brassica oleracea var. sabauda" }, { name: "紫キャベツ", sci: "Brassica oleracea var. capitata f. rubra" }, { name: "みさき", sci: "Brassica oleracea var. capitata 'Misaki'" },
      ] },
      { name: "ブロッコリー", pickable: true, loc: { en: "Broccoli", zh: "西兰花", es: "Brócoli" }, varieties: [
        { name: "緑嶺", sci: "Brassica oleracea var. italica 'Ryokurei'" }, { name: "ピクセル", sci: "Brassica oleracea var. italica 'Pixel'" }, { name: "スティックセニョール", sci: "Brassica oleracea var. italica 'Stick Senor'" }, { name: "茎ブロッコリー", sci: "Brassica oleracea var. italica" },
        { name: "おはよう", sci: "Brassica oleracea var. italica 'Ohayo'" }, { name: "ハイツSP", sci: "Brassica oleracea var. italica 'Heights SP'" }, { name: "ドシコ", sci: "Brassica oleracea var. italica 'Doshiko'" }, { name: "夢ひびき", sci: "Brassica oleracea var. italica 'Yume Hibiki'" },
      ] },
      { name: "カリフラワー", pickable: true, loc: { en: "Cauliflower", zh: "花椰菜", es: "Coliflor" }, varieties: [
        { name: "スノークラウン", sci: "Brassica oleracea var. botrytis 'Snow Crown'" }, { name: "オレンジ美星", sci: "Brassica oleracea var. botrytis 'Orange Bisei'" }, { name: "パープルフラワー", sci: "Brassica oleracea var. botrytis 'Purple Flower'" }, { name: "紫カリフラワー", sci: "Brassica oleracea var. botrytis 'Murasaki Cauliflower'" },
        { name: "バイオレットクイン", sci: "Brassica oleracea var. botrytis 'Violet Queen'" },
      ] },
      { name: "ロマネスコ", pickable: true, loc: { en: "Romanesco", zh: "宝塔花菜", es: "Romanesco" }, varieties: [
        { name: "うずまき", sci: "Brassica oleracea var. botrytis 'Uzumaki'" }, { name: "ダ・ヴィンチ", sci: "Brassica oleracea var. botrytis 'Da Vinci'" }, { name: "ミナレット", sci: "Brassica oleracea var. botrytis 'Minaret'" }, { name: "カリッコリー", sci: "Brassica oleracea var. botrytis 'Caliccori'" },
        { name: "サンゴショウ", sci: "Brassica oleracea var. botrytis 'Sangosho'" },
      ] },
      { name: "アーティチョーク", pickable: true, loc: { en: "Artichoke", zh: "朝鲜蓟", es: "Alcachofa" }, varieties: [
        { name: "アーティチョーク", sci: "Cynara cardunculus var. scolymus" },
      ] },
      { name: "葉物・その他", pickable: false, loc: { en: "Leafy greens & others", zh: "叶菜·其他", es: "Verduras de hoja y otros" }, varieties: [
        { name: "ほうれん草", sci: "Spinacia oleracea" }, { name: "サラダほうれん草", sci: "Spinacia oleracea 'Salad'" }, { name: "ちぢみほうれん草", sci: "Spinacia oleracea 'Chijimi'" }, { name: "次郎丸ほうれん草", sci: "Spinacia oleracea 'Jiromaru'" },
        { name: "小松菜", sci: "Brassica rapa var. perviridis" }, { name: "レタス", sci: "Lactuca sativa" }, { name: "サニーレタス", sci: "Lactuca sativa var. crispa 'Sunny'" }, { name: "サンチュ", sci: "Lactuca sativa var. angustana" },
        { name: "ロメインレタス", sci: "Lactuca sativa var. longifolia" }, { name: "リーフレタス", sci: "Lactuca sativa var. crispa" }, { name: "フリルレタス", sci: "Lactuca sativa var. crispa 'Frill'" }, { name: "玉レタス", sci: "Lactuca sativa var. capitata" },
        { name: "サラダ菜", sci: "Lactuca sativa var. capitata" }, { name: "グリーンカール", sci: "Lactuca sativa var. crispa 'Green Curl'" }, { name: "春菊", sci: "Glebionis coronaria" }, { name: "水菜", sci: "Brassica rapa var. nipposinica" },
        { name: "ルッコラ", sci: "Eruca vesicaria" }, { name: "パクチー", sci: "Coriandrum sativum", aliases: ["コリアンダー"] }, { name: "大葉", sci: "Perilla frutescens var. crispa" },
        { name: "青じそ", sci: "Perilla frutescens var. crispa f. viridis" }, { name: "赤じそ", sci: "Perilla frutescens var. crispa f. purpurea" }, { name: "ケール", sci: "Brassica oleracea var. acephala" }, { name: "カーボロネロ", sci: "Brassica oleracea var. acephala 'Cavolo Nero'" },
        { name: "カリーノケール", sci: "Brassica oleracea var. acephala 'Carino'" }, { name: "ふだん草", sci: "Beta vulgaris var. cicla", aliases: ["スイスチャード"] },
      ] },
      { name: "豆類・その他", pickable: false, loc: { en: "Legumes & others", zh: "豆类·其他", es: "Legumbres y otros" }, varieties: [
        { name: "そら豆", sci: "Vicia faba" }, { name: "一寸そら豆", sci: "Vicia faba 'Issun'" }, { name: "スナップエンドウ", sci: "Pisum sativum var. macrocarpon" }, { name: "さやいんげん", sci: "Phaseolus vulgaris" },
        { name: "つるありインゲン", sci: "Phaseolus vulgaris" }, { name: "モロッコいんげん", sci: "Phaseolus vulgaris 'Morocco'" }, { name: "ケンタッキーワンダー", sci: "Phaseolus vulgaris 'Kentucky Wonder'" }, { name: "落花生", sci: "Arachis hypogaea" },
        { name: "おおまさり", sci: "Arachis hypogaea 'Omasari'" }, { name: "千葉半立", sci: "Arachis hypogaea 'Chiba Handachi'" }, { name: "里芋", sci: "Colocasia esculenta", aliases: ["さといも"] },
        { name: "土垂", sci: "Colocasia esculenta 'Dodare'" }, { name: "石川早生", sci: "Colocasia esculenta 'Ishikawa Wase'" }, { name: "セレベス", sci: "Colocasia esculenta 'Celebes'" }, { name: "八つ頭", sci: "Colocasia esculenta 'Yatsugashira'" },
        { name: "海老芋", sci: "Colocasia esculenta 'Ebi Imo'" }, { name: "ニンニク", sci: "Allium sativum" }, { name: "ホワイト六片", sci: "Allium sativum 'White Roppen'" }, { name: "ジャンボニンニク", sci: "Allium ampeloprasum" },
        { name: "食用ほおずき", sci: "Physalis pruinosa", aliases: ["ストロベリートマト"] },
      ] },
    ],
  },
  {
    label: "ハーブ",
    loc: { en: "Herbs", zh: "香草", es: "Hierbas Aromáticas" },
    genera: [
      { name: "バジル", pickable: true, loc: { en: "Basil", zh: "罗勒", es: "Albahaca" }, varieties: [
        { name: "スイートバジル", sci: "Ocimum basilicum" }, { name: "ホーリーバジル", sci: "Ocimum tenuiflorum" }, { name: "レモンバジル", sci: "Ocimum × africanum" }, { name: "ジェノベーゼ", sci: "Ocimum basilicum 'Genovese'" },
        { name: "ダークオパール", sci: "Ocimum basilicum 'Dark Opal'" }, { name: "ブッシュバジル", sci: "Ocimum basilicum var. minimum" }, { name: "シナモンバジル", sci: "Ocimum basilicum 'Cinnamon'" },
      ] },
      { name: "ミント", pickable: true, loc: { en: "Mint", zh: "薄荷", es: "Menta" }, varieties: [
        { name: "スペアミント", sci: "Mentha spicata" }, { name: "ペパーミント", sci: "Mentha × piperita" }, { name: "アップルミント", sci: "Mentha suaveolens" }, { name: "パイナップルミント", sci: "Mentha suaveolens 'Variegata'" },
        { name: "モロッカンミント", sci: "Mentha spicata 'Moroccan'" }, { name: "オーデコロンミント", sci: "Mentha × piperita 'Citrata'" }, { name: "ブラックペパーミント", sci: "Mentha × piperita 'Black'" },
      ] },
      { name: "ローズマリー", pickable: true, loc: { en: "Rosemary", zh: "迷迭香", es: "Romero" }, varieties: [
        { name: "立性ローズマリー", sci: "Salvia rosmarinus" }, { name: "匍匐性ローズマリー", sci: "Salvia rosmarinus 'Prostratus'" }, { name: "トスカナブルー", sci: "Salvia rosmarinus 'Tuscan Blue'" }, { name: "マリンブルー", sci: "Salvia rosmarinus 'Marine Blue'" },
        { name: "モーツァルトブルー", sci: "Salvia rosmarinus 'Mozart Blue'" }, { name: "プロストラータス", sci: "Salvia rosmarinus 'Prostratus'" },
      ] },
      { name: "タイム", pickable: true, loc: { en: "Thyme", zh: "百里香", es: "Tomillo" }, varieties: [
        { name: "コモンタイム", sci: "Thymus vulgaris" }, { name: "レモンタイム", sci: "Thymus citriodorus" }, { name: "クリーピングタイム", sci: "Thymus serpyllum" }, { name: "シルバータイム", sci: "Thymus vulgaris 'Silver Queen'" },
      ] },
      { name: "セージ", pickable: true, loc: { en: "Sage", zh: "鼠尾草", es: "Salvia" }, varieties: [
        { name: "コモンセージ", sci: "Salvia officinalis" }, { name: "パイナップルセージ", sci: "Salvia elegans" }, { name: "チェリーセージ", sci: "Salvia microphylla" }, { name: "ホワイトセージ", sci: "Salvia apiana" },
        { name: "ゴールデンセージ", sci: "Salvia officinalis 'Aurea'" }, { name: "パープルセージ", sci: "Salvia officinalis 'Purpurascens'" },
      ] },
      { name: "ラベンダー", pickable: true, loc: { en: "Lavender", zh: "薰衣草", es: "Lavanda" }, varieties: [
        { name: "イングリッシュラベンダー", sci: "Lavandula angustifolia" }, { name: "フレンチラベンダー", sci: "Lavandula stoechas", aliases: ["ストエカス"] }, { name: "グロッソ", sci: "Lavandula × intermedia 'Grosso'" }, { name: "ラバンディン", sci: "Lavandula × intermedia" },
        { name: "デンタータ", sci: "Lavandula dentata" },
      ] },
      { name: "カモミール", pickable: true, loc: { en: "Chamomile", zh: "洋甘菊", es: "Manzanilla" }, varieties: [
        { name: "ジャーマンカモミール", sci: "Matricaria chamomilla" }, { name: "ローマンカモミール", sci: "Chamaemelum nobile" },
      ] },
      { name: "オレガノ", pickable: true, loc: { en: "Oregano", zh: "牛至", es: "Orégano" }, varieties: [
        { name: "ケントビューティー", sci: "Origanum 'Kent Beauty'" }, { name: "コモンオレガノ", sci: "Origanum vulgare" }, { name: "ゴールデンオレガノ", sci: "Origanum vulgare 'Aureum'" }, { name: "マジョラム", sci: "Origanum majorana" },
      ] },
      { name: "パセリ", pickable: true, loc: { en: "Parsley", zh: "欧芹", es: "Perejil" }, varieties: [
        { name: "イタリアンパセリ", sci: "Petroselinum crispum var. neapolitanum" }, { name: "カーリーパセリ", sci: "Petroselinum crispum var. crispum" }, { name: "モスカールドパセリ", sci: "Petroselinum crispum 'Moss Curled'" },
      ] },
      { name: "シソ", pickable: true, loc: { en: "Perilla", zh: "紫苏", es: "Perilla" }, aliases: ["大葉", "紫蘇"], varieties: [
        { name: "青じそ", sci: "Perilla frutescens var. crispa f. viridis" }, { name: "赤じそ", sci: "Perilla frutescens var. crispa f. purpurea" }, { name: "ちりめんじそ", sci: "Perilla frutescens var. crispa f. crispa" }, { name: "穂じそ", sci: "Perilla frutescens var. crispa" },
      ] },
      { name: "パクチー", pickable: true, loc: { en: "Coriander", zh: "香菜", es: "Cilantro" }, aliases: ["コリアンダー", "香菜", "シャンツァイ"], varieties: [
        { name: "コリアンダー", sci: "Coriandrum sativum" }, { name: "サイゴンパクチー", sci: "Coriandrum sativum 'Saigon'" },
      ] },
      { name: "その他ハーブ", pickable: false, loc: { en: "Other herbs", zh: "其他香草", es: "Otras hierbas" }, varieties: [
        { name: "レモングラス", sci: "Cymbopogon citratus" }, { name: "レモンバーム", sci: "Melissa officinalis" }, { name: "ディル", sci: "Anethum graveolens" }, { name: "チャイブ", sci: "Allium schoenoprasum" },
        { name: "タラゴン", sci: "Artemisia dracunculus" }, { name: "フェンネル", sci: "Foeniculum vulgare" }, { name: "チャービル", sci: "Anthriscus cerefolium" }, { name: "ルッコラ", sci: "Eruca vesicaria" },
        { name: "ステビア", sci: "Stevia rebaudiana" }, { name: "ナスタチウム", sci: "Tropaeolum majus" }, { name: "ボリジ", sci: "Borago officinalis" }, { name: "ヒソップ", sci: "Hyssopus officinalis" },
        { name: "コモンマロウ", sci: "Malva sylvestris" }, { name: "キャットニップ", sci: "Nepeta cataria" }, { name: "ワイルドストロベリー", sci: "Fragaria vesca" },
      ] },
    ],
  },
  {
    label: "果樹",
    loc: { en: "Fruit Trees", zh: "果树", es: "Árboles Frutales" },
    genera: [
      { name: "ブルーベリー", pickable: true, loc: { en: "Blueberry", zh: "蓝莓", es: "Arándano" }, varieties: [
        { name: "ティフブルー", sci: "Vaccinium virgatum 'Tifblue'" }, { name: "ホームベル", sci: "Vaccinium virgatum 'Homebell'" }, { name: "ブライトウェル", sci: "Vaccinium virgatum 'Brightwell'" }, { name: "パウダーブルー", sci: "Vaccinium virgatum 'Powderblue'" },
        { name: "オンスロー", sci: "Vaccinium virgatum 'Onslow'" }, { name: "クライマックス", sci: "Vaccinium virgatum 'Climax'" }, { name: "ウッダード", sci: "Vaccinium virgatum 'Woodard'" }, { name: "チャンドラー", sci: "Vaccinium corymbosum 'Chandler'" },
        { name: "ブルークロップ", sci: "Vaccinium corymbosum 'Bluecrop'" }, { name: "スパルタン", sci: "Vaccinium corymbosum 'Spartan'" }, { name: "オニール", sci: "Vaccinium corymbosum 'O'Neal'" }, { name: "サンシャインブルー", sci: "Vaccinium corymbosum 'Sunshine Blue'" },
        { name: "ピンクレモネード", sci: "Vaccinium corymbosum 'Pink Lemonade'" }, { name: "ブリジッタ", sci: "Vaccinium corymbosum 'Brigitta'" }, { name: "ブリギッタ", sci: "Vaccinium corymbosum 'Brigitta'" }, { name: "デューク", sci: "Vaccinium corymbosum 'Duke'" },
        { name: "レガシー", sci: "Vaccinium corymbosum 'Legacy'" }, { name: "リバティ", sci: "Vaccinium corymbosum 'Liberty'" }, { name: "サザンハイブッシュ", sci: "Vaccinium corymbosum" }, { name: "ラビットアイ", sci: "Vaccinium virgatum" },
        { name: "ハイブッシュ", sci: "Vaccinium corymbosum" },
      ] },
      { name: "イチジク", pickable: true, loc: { en: "Fig", zh: "无花果", es: "Higo" }, varieties: [
        { name: "ドーフィン", sci: "Ficus carica 'Dauphine'" }, { name: "桝井ドーフィン", sci: "Ficus carica 'Masui Dauphine'" }, { name: "ホワイトゼノア", sci: "Ficus carica 'White Genoa'" }, { name: "ビオレソリエス", sci: "Ficus carica 'Violette de Solliès'" },
        { name: "ロングドゥート", sci: "Ficus carica 'Longue d'Août'" }, { name: "バナーネ", sci: "Ficus carica 'Banane'" }, { name: "ザ・キング", sci: "Ficus carica 'The King'" }, { name: "ブラウンターキー", sci: "Ficus carica 'Brown Turkey'" },
        { name: "ヌアールドカロン", sci: "Ficus carica 'Noire de Caromb'" }, { name: "セレステ", sci: "Ficus carica 'Celeste'" }, { name: "ダルマティ", sci: "Ficus carica 'Dalmatie'" }, { name: "ホワイトイスキア", sci: "Ficus carica 'White Ischia'" },
        { name: "とよみつひめ", sci: "Ficus carica 'Toyomitsuhime'" }, { name: "蓬莱柿", sci: "Ficus carica 'Horaishi'" },
      ] },
      { name: "柑橘", pickable: true, loc: { en: "Citrus", zh: "柑橘", es: "Cítricos" }, varieties: [
        { name: "レモン", sci: "Citrus limon" }, { name: "リスボン", sci: "Citrus limon 'Lisbon'" }, { name: "マイヤー", sci: "Citrus × meyeri" }, { name: "ユーレカ", sci: "Citrus limon 'Eureka'" },
        { name: "温州みかん", sci: "Citrus unshiu" }, { name: "デコポン", sci: "Citrus 'Shiranuhi'" }, { name: "不知火", sci: "Citrus 'Shiranuhi'" }, { name: "金柑", sci: "Citrus japonica" },
        { name: "ライム", sci: "Citrus aurantiifolia" }, { name: "タヒチライム", sci: "Citrus × latifolia" }, { name: "すだち", sci: "Citrus sudachi" }, { name: "かぼす", sci: "Citrus sphaerocarpa" },
        { name: "ゆず", sci: "Citrus junos" }, { name: "八朔", sci: "Citrus hassaku" }, { name: "甘夏", sci: "Citrus natsudaidai" }, { name: "ブラッドオレンジ", sci: "Citrus × sinensis 'Blood Orange'" },
        { name: "タロッコ", sci: "Citrus × sinensis 'Tarocco'" }, { name: "河内晩柑", sci: "Citrus 'Kawachi Bankan'" }, { name: "フィンガーライム", sci: "Citrus australasica" }, { name: "せとか", sci: "Citrus 'Setoka'" },
        { name: "清見", sci: "Citrus 'Kiyomi'" }, { name: "はるみ", sci: "Citrus 'Harumi'" }, { name: "日向夏", sci: "Citrus tamurana" },
      ] },
      { name: "ぶどう", pickable: true, loc: { en: "Grape", zh: "葡萄", es: "Uva" }, varieties: [
        { name: "シャインマスカット", sci: "Vitis 'Shine Muscat'" }, { name: "巨峰", sci: "Vitis 'Kyoho'" }, { name: "ピオーネ", sci: "Vitis 'Pione'" }, { name: "デラウェア", sci: "Vitis 'Delaware'" },
        { name: "ナガノパープル", sci: "Vitis 'Nagano Purple'" }, { name: "マスカットベーリーA", sci: "Vitis 'Muscat Bailey A'" }, { name: "ベリーA", sci: "Vitis 'Muscat Bailey A'" }, { name: "クイーンニーナ", sci: "Vitis 'Queen Nina'" },
        { name: "藤稔", sci: "Vitis 'Fujiminori'" }, { name: "安芸クイーン", sci: "Vitis 'Aki Queen'" }, { name: "サニードルチェ", sci: "Vitis 'Sunny Dolce'" },
        { name: "甲州", sci: "Vitis vinifera 'Koshu'" }, { name: "マスカット・オブ・アレキサンドリア", sci: "Vitis vinifera 'Muscat of Alexandria'" }, { name: "瀬戸ジャイアンツ", sci: "Vitis vinifera 'Seto Giants'", aliases: ["桃太郎ぶどう"] }, { name: "ロザリオビアンコ", sci: "Vitis vinifera 'Rosario Bianco'" },
        { name: "甲斐路", sci: "Vitis vinifera 'Kaiji'" }, { name: "クイーンルージュ", sci: "Vitis vinifera 'Queen Rouge'" }, { name: "スチューベン", sci: "Vitis 'Steuben'" }, { name: "キャンベルアーリー", sci: "Vitis × labruscana 'Campbell Early'" },
        { name: "ナイアガラ", sci: "Vitis labrusca 'Niagara'" },
      ] },
      { name: "柿", pickable: true, loc: { en: "Persimmon", zh: "柿子", es: "Caqui" }, varieties: [
        { name: "富有", sci: "Diospyros kaki 'Fuyu'" }, { name: "次郎", sci: "Diospyros kaki 'Jiro'" }, { name: "太秋", sci: "Diospyros kaki 'Taishu'" }, { name: "早秋", sci: "Diospyros kaki 'Soshu'" },
        { name: "西村早生", sci: "Diospyros kaki 'Nishimura Wase'" }, { name: "蜂屋", sci: "Diospyros kaki 'Hachiya'" }, { name: "平核無", sci: "Diospyros kaki 'Hiratanenashi'" }, { name: "甘百目", sci: "Diospyros kaki 'Amahyakume'" },
        { name: "松本早生富有", sci: "Diospyros kaki 'Matsumoto Wase Fuyu'" },
      ] },
      { name: "りんご", pickable: true, loc: { en: "Apple", zh: "苹果", es: "Manzana" }, varieties: [
        { name: "ふじ", sci: "Malus domestica 'Fuji'" }, { name: "姫りんご", sci: "Malus prunifolia" }, { name: "アルプス乙女", sci: "Malus domestica 'Alps Otome'" }, { name: "つがる", sci: "Malus domestica 'Tsugaru'" },
        { name: "王林", sci: "Malus domestica 'Orin'" }, { name: "シナノゴールド", sci: "Malus domestica 'Shinano Gold'" }, { name: "ジョナゴールド", sci: "Malus domestica 'Jonagold'" },
      ] },
      { name: "桃・さくらんぼ・梅・すもも", pickable: false, loc: { en: "Peach / Cherry / Plum", zh: "桃·樱桃·梅·李", es: "Melocotón / Cereza / Ciruela" }, varieties: [
        { name: "桃", sci: "Prunus persica" }, { name: "佐藤錦", sci: "Prunus avium 'Sato Nishiki'" }, { name: "紅秀峰", sci: "Prunus avium 'Beni Shuho'" }, { name: "高砂", sci: "Prunus avium 'Takasago'" },
        { name: "ナポレオン", sci: "Prunus avium 'Napoleon'" }, { name: "紅さやか", sci: "Prunus avium 'Beni Sayaka'" }, { name: "南高梅", sci: "Prunus mume 'Nanko'" }, { name: "白加賀", sci: "Prunus mume 'Shirakaga'" },
        { name: "豊後", sci: "Prunus mume 'Bungo'" }, { name: "小梅", sci: "Prunus mume 'Koume'" }, { name: "古城", sci: "Prunus mume 'Gojiro'" }, { name: "鶯宿", sci: "Prunus mume 'Osuku'" },
        { name: "ソルダム", sci: "Prunus salicina 'Soldam'" }, { name: "大石早生", sci: "Prunus salicina 'Oishi Wase'" }, { name: "太陽", sci: "Prunus salicina 'Taiyo'" }, { name: "サンタローザ", sci: "Prunus salicina 'Santa Rosa'" },
        { name: "プラム", sci: "Prunus salicina" },
      ] },
      { name: "キウイ", pickable: true, loc: { en: "Kiwi", zh: "猕猴桃", es: "Kiwi" }, varieties: [
        { name: "ヘイワード", sci: "Actinidia deliciosa 'Hayward'" }, { name: "紅妃", sci: "Actinidia chinensis 'Hongfei'" }, { name: "香緑", sci: "Actinidia deliciosa 'Koryoku'" }, { name: "アップルキウイ", sci: "Actinidia deliciosa 'Apple'" },
        { name: "ゴールデンキウイ", sci: "Actinidia chinensis 'Golden'" }, { name: "ゴールドキウイ", sci: "Actinidia chinensis 'Gold'" },
      ] },
      { name: "オリーブ", pickable: true, loc: { en: "Olive", zh: "橄榄", es: "Olivo" }, varieties: [
        { name: "ミッション", sci: "Olea europaea 'Mission'" }, { name: "ネバディロブランコ", sci: "Olea europaea 'Nevadillo Blanco'" }, { name: "ルッカ", sci: "Olea europaea 'Lucca'" }, { name: "アルベキナ", sci: "Olea europaea 'Arbequina'" },
        { name: "フラントイオ", sci: "Olea europaea 'Frantoio'" }, { name: "コロネイキ", sci: "Olea europaea 'Koroneiki'" }, { name: "マンザニロ", sci: "Olea europaea 'Manzanillo'" }, { name: "シプレッシーノ", sci: "Olea europaea 'Cipressino'" },
        { name: "ピクアル", sci: "Olea europaea 'Picual'" },
      ] },
      { name: "マンゴー", pickable: true, loc: { en: "Mango", zh: "芒果", es: "Mango" }, varieties: [
        { name: "アーウィン", sci: "Mangifera indica 'Irwin'", aliases: ["アップルマンゴー"] }, { name: "キーツ", sci: "Mangifera indica 'Keitt'" }, { name: "ナンドクマイ", sci: "Mangifera indica 'Nam Dok Mai'" }, { name: "金煌", sci: "Mangifera indica 'Jin Huang'" },
        { name: "太陽のタマゴ", sci: "Mangifera indica 'Irwin'" }, { name: "玉文", sci: "Mangifera indica 'Yu Wen'" },
      ] },
      { name: "アボカド", pickable: true, loc: { en: "Avocado", zh: "牛油果", es: "Aguacate" }, varieties: [
        { name: "ハス", sci: "Persea americana 'Hass'" }, { name: "ベーコン", sci: "Persea americana 'Bacon'" }, { name: "ズタノ", sci: "Persea americana 'Zutano'" }, { name: "ピンカートン", sci: "Persea americana 'Pinkerton'" },
        { name: "フエルテ", sci: "Persea americana 'Fuerte'" }, { name: "メキシコーラ", sci: "Persea americana 'Mexicola'" },
      ] },
      { name: "バナナ", pickable: true, loc: { en: "Banana", zh: "香蕉", es: "Plátano" }, varieties: [
        { name: "三尺バナナ", sci: "Musa acuminata 'Dwarf Cavendish'", aliases: ["ドワーフバナナ"] }, { name: "アイスクリームバナナ", sci: "Musa 'Blue Java'" }, { name: "モンキーバナナ", sci: "Musa acuminata 'Señorita'" }, { name: "島バナナ", sci: "Musa 'Shima Banana'" },
      ] },
      { name: "パパイヤ", pickable: true, loc: { en: "Papaya", zh: "番木瓜", es: "Papaya" }, varieties: [
        { name: "サンライズ", sci: "Carica papaya 'Sunrise'" }, { name: "レッドレディ", sci: "Carica papaya 'Red Lady'" }, { name: "台農2号", sci: "Carica papaya 'Tainung No.2'" },
      ] },
      { name: "ドラゴンフルーツ", pickable: true, loc: { en: "Dragon fruit", zh: "火龙果", es: "Pitaya" }, aliases: ["ピタヤ"], varieties: [
        { name: "レッドピタヤ", sci: "Hylocereus polyrhizus" }, { name: "ホワイトピタヤ", sci: "Hylocereus undatus" }, { name: "イエローピタヤ", sci: "Selenicereus megalanthus" },
      ] },
      { name: "グァバ", pickable: true, loc: { en: "Guava", zh: "番石榴", es: "Guayaba" }, varieties: [
        { name: "赤肉グァバ", sci: "Psidium guajava" }, { name: "白肉グァバ", sci: "Psidium guajava" }, { name: "ストロベリーグァバ", sci: "Psidium cattleyanum", aliases: ["テリハバンジロウ"] },
      ] },
      { name: "フェイジョア", pickable: true, loc: { en: "Feijoa", zh: "斐济果", es: "Feijoa" }, varieties: [
        { name: "クーリッジ", sci: "Acca sellowiana 'Coolidge'" }, { name: "アポロ", sci: "Acca sellowiana 'Apollo'" }, { name: "マンモス", sci: "Acca sellowiana 'Mammoth'" }, { name: "トライアンフ", sci: "Acca sellowiana 'Triumph'" },
      ] },
      { name: "ライチ", pickable: true, loc: { en: "Lychee", zh: "荔枝", es: "Lichi" }, varieties: [
        { name: "玉荷包", sci: "Litchi chinensis 'Yu He Bao'" }, { name: "黒葉", sci: "Litchi chinensis 'Hak Ip'" },
      ] },
      { name: "その他果樹", pickable: false, loc: { en: "Other fruit trees", zh: "其他果树", es: "Otros frutales" }, varieties: [
        { name: "茂木", sci: "Eriobotrya japonica 'Mogi'" }, { name: "田中", sci: "Eriobotrya japonica 'Tanaka'" }, { name: "長崎早生", sci: "Eriobotrya japonica 'Nagasaki Wase'", aliases: ["びわ"] }, { name: "丹波栗", sci: "Castanea crenata 'Tamba'" },
        { name: "利平", sci: "Castanea crenata 'Rihei'" }, { name: "ラズベリー", sci: "Rubus idaeus" }, { name: "ブラックベリー", sci: "Rubus fruticosus" },
        { name: "ザクロ", sci: "Punica granatum" }, { name: "ジューンベリー", sci: "Amelanchier canadensis" }, { name: "ポポー", sci: "Asimina triloba" }, { name: "アケビ", sci: "Akebia quinata" },
        { name: "パッションフルーツ", sci: "Passiflora edulis" }, { name: "グミ", sci: "Elaeagnus" }, { name: "カシス", sci: "Ribes nigrum" }, { name: "グーズベリー", sci: "Ribes uva-crispa" },
        { name: "クランベリー", sci: "Vaccinium macrocarpon" }, { name: "桑", sci: "Morus", aliases: ["マルベリー"] }, { name: "パイナップル", sci: "Ananas comosus" },
        { name: "カリン", sci: "Pseudocydonia sinensis", aliases: ["花梨"] },
      ] },
    ],
  },
  {
    label: "穀物",
    loc: { en: "Grains", zh: "谷物", es: "Cereales" },
    genera: [
      { name: "イネ", pickable: true, loc: { en: "Rice", zh: "水稻", es: "Arroz" }, aliases: ["稲", "コメ", "米", "水稲", "陸稲"], varieties: [
        { name: "コシヒカリ", sci: "Oryza sativa 'Koshihikari'" }, { name: "あきたこまち", sci: "Oryza sativa 'Akitakomachi'" }, { name: "ひとめぼれ", sci: "Oryza sativa 'Hitomebore'" }, { name: "ヒノヒカリ", sci: "Oryza sativa 'Hinohikari'" },
        { name: "ななつぼし", sci: "Oryza sativa 'Nanatsuboshi'" }, { name: "ゆめぴりか", sci: "Oryza sativa 'Yumepirika'" }, { name: "つや姫", sci: "Oryza sativa 'Tsuyahime'" }, { name: "はえぬき", sci: "Oryza sativa 'Haenuki'" },
        { name: "キヌヒカリ", sci: "Oryza sativa 'Kinuhikari'" }, { name: "ササニシキ", sci: "Oryza sativa 'Sasanishiki'" }, { name: "きぬむすめ", sci: "Oryza sativa 'Kinumusume'" }, { name: "にこまる", sci: "Oryza sativa 'Nikomaru'" },
        { name: "森のくまさん", sci: "Oryza sativa 'Mori no Kumasan'" }, { name: "さがびより", sci: "Oryza sativa 'Sagabiyori'" }, { name: "新之助", sci: "Oryza sativa 'Shinnosuke'" }, { name: "いちほまれ", sci: "Oryza sativa 'Ichihomare'" },
        { name: "青天の霹靂", sci: "Oryza sativa 'Seiten no Hekireki'" }, { name: "だて正夢", sci: "Oryza sativa 'Date Masayume'" }, { name: "ふっくりんこ", sci: "Oryza sativa 'Fukkurinko'" },
        { name: "ヒメノモチ", sci: "Oryza sativa 'Himenomochi'" }, { name: "こがねもち", sci: "Oryza sativa 'Koganemochi'" }, { name: "ヒヨクモチ", sci: "Oryza sativa 'Hiyokumochi'" },
        { name: "山田錦", sci: "Oryza sativa 'Yamada Nishiki'" }, { name: "五百万石", sci: "Oryza sativa 'Gohyakumangoku'" }, { name: "美山錦", sci: "Oryza sativa 'Miyama Nishiki'" }, { name: "雄町", sci: "Oryza sativa 'Omachi'" },
        { name: "愛山", sci: "Oryza sativa 'Aiyama'" },
        { name: "赤米", sci: "Oryza sativa" }, { name: "黒米", sci: "Oryza sativa" }, { name: "緑米", sci: "Oryza sativa" }, { name: "香米", sci: "Oryza sativa" },
      ] },
      { name: "コムギ", pickable: true, loc: { en: "Wheat", zh: "小麦", es: "Trigo" }, varieties: [
        { name: "ゆめちから", sci: "Triticum aestivum 'Yumechikara'" }, { name: "きたほなみ", sci: "Triticum aestivum 'Kitahonami'" }, { name: "農林61号", sci: "Triticum aestivum 'Norin 61'" }, { name: "ニシノカオリ", sci: "Triticum aestivum 'Nishinokaori'" },
        { name: "ハルユタカ", sci: "Triticum aestivum 'Haruyutaka'" }, { name: "デュラムコムギ", sci: "Triticum durum" },
      ] },
      { name: "オオムギ", pickable: true, loc: { en: "Barley", zh: "大麦", es: "Cebada" }, varieties: [
        { name: "二条大麦", sci: "Hordeum vulgare" }, { name: "六条大麦", sci: "Hordeum vulgare" }, { name: "はだか麦", sci: "Hordeum vulgare var. nudum" }, { name: "ビール麦", sci: "Hordeum vulgare" },
      ] },
      { name: "ライムギ", pickable: true, loc: { en: "Rye", zh: "黑麦", es: "Centeno" }, varieties: [
        { name: "ライムギ", sci: "Secale cereale" },
      ] },
      { name: "エンバク", pickable: true, loc: { en: "Oat", zh: "燕麦", es: "Avena" }, aliases: ["オートムギ", "オーツ麦", "えん麦"], varieties: [
        { name: "エンバク", sci: "Avena sativa" },
      ] },
      { name: "ソバ", pickable: true, loc: { en: "Buckwheat", zh: "荞麦", es: "Alforfón" }, varieties: [
        { name: "常陸秋そば", sci: "Fagopyrum esculentum 'Hitachi Akisoba'" }, { name: "信濃1号", sci: "Fagopyrum esculentum 'Shinano 1'" }, { name: "キタワセソバ", sci: "Fagopyrum esculentum 'Kitawasesoba'" }, { name: "ダッタンソバ", sci: "Fagopyrum tataricum" },
      ] },
      { name: "雑穀", pickable: false, loc: { en: "Millets", zh: "杂粮", es: "Mijos" }, varieties: [
        { name: "アワ", sci: "Setaria italica" }, { name: "ヒエ", sci: "Echinochloa esculenta" }, { name: "キビ", sci: "Panicum miliaceum" }, { name: "タカキビ", sci: "Sorghum bicolor", aliases: ["モロコシ"] },
        { name: "ハトムギ", sci: "Coix lacryma-jobi" }, { name: "アマランサス", sci: "Amaranthus" }, { name: "キヌア", sci: "Chenopodium quinoa" },
      ] },
      { name: "トウモロコシ（穀物用）", pickable: false, loc: { en: "Corn (grain)", zh: "玉米（谷物用）", es: "Maíz (grano)" }, varieties: [
        { name: "デントコーン", sci: "Zea mays" }, { name: "フリントコーン", sci: "Zea mays" }, { name: "ポップコーン", sci: "Zea mays" }, { name: "飼料用トウモロコシ", sci: "Zea mays" },
      ] },
    ],
  },
  {
    label: "山菜・野草",
    loc: { en: "Wild Edible Plants", zh: "山菜野草", es: "Plantas Silvestres Comestibles" },
    genera: [
      { name: "フキ", pickable: true, loc: { en: "Butterbur", zh: "蜂斗菜", es: "Petasites" }, aliases: ["ふき", "蕗", "ふきのとう"], varieties: [
        { name: "愛知早生フキ", sci: "Petasites japonicus 'Aichi Wase'" }, { name: "水ふき", sci: "Petasites japonicus" }, { name: "山ふき", sci: "Petasites japonicus" }, { name: "秋田ふき", sci: "Petasites japonicus subsp. giganteus" },
      ] },
      { name: "ヨモギ", pickable: true, loc: { en: "Mugwort", zh: "艾", es: "Artemisa" }, aliases: ["よもぎ"], varieties: [
        { name: "ヨモギ", sci: "Artemisia indica var. maximowiczii" },
      ] },
      { name: "ウド", pickable: true, loc: { en: "Udo", zh: "食用土当归", es: "Udo" }, aliases: ["うど", "独活"], varieties: [
        { name: "山ウド", sci: "Aralia cordata", aliases: ["ヤマウド"] }, { name: "軟白ウド", sci: "Aralia cordata", aliases: ["白ウド"] }, { name: "赤ウド", sci: "Aralia cordata" },
      ] },
      { name: "ミョウガ", pickable: true, loc: { en: "Myoga", zh: "蘘荷", es: "Mioga" }, aliases: ["みょうが", "茗荷"], varieties: [
        { name: "陣田早生", sci: "Zingiber mioga 'Jinda Wase'" }, { name: "夏みょうが", sci: "Zingiber mioga" }, { name: "秋みょうが", sci: "Zingiber mioga" }, { name: "みょうがたけ", sci: "Zingiber mioga" },
      ] },
      { name: "セリ", pickable: true, loc: { en: "Water dropwort", zh: "水芹", es: "Apio japonés" }, aliases: ["せり", "芹"], varieties: [
        { name: "セリ", sci: "Oenanthe javanica" },
      ] },
      { name: "ミツバ", pickable: true, loc: { en: "Mitsuba", zh: "鸭儿芹", es: "Mitsuba" }, aliases: ["みつば", "三つ葉"], varieties: [
        { name: "糸三つ葉", sci: "Cryptotaenia japonica" }, { name: "根三つ葉", sci: "Cryptotaenia japonica" }, { name: "切り三つ葉", sci: "Cryptotaenia japonica" },
      ] },
      { name: "サンショウ", pickable: true, loc: { en: "Sansho pepper", zh: "山椒", es: "Pimienta sansho" }, aliases: ["山椒", "さんしょう", "実山椒", "葉山椒"], varieties: [
        { name: "朝倉山椒", sci: "Zanthoxylum piperitum 'Asakura'" }, { name: "ぶどう山椒", sci: "Zanthoxylum piperitum 'Budo'" },
      ] },
      { name: "タラノキ", pickable: true, loc: { en: "Japanese angelica tree", zh: "楤木", es: "Aralia japonesa" }, aliases: ["タラの芽", "たらの芽"], varieties: [
        { name: "新駒", sci: "Aralia elata 'Shinkoma'" }, { name: "駒みどり", sci: "Aralia elata 'Komamidori'" }, { name: "夕映え", sci: "Aralia elata 'Yubae'" }, { name: "メダラ", sci: "Aralia elata" },
      ] },
    ],
  },
];
