// 品種タグ辞書（カテゴリ→属→品種・1,795件 / 185属 / 22カテゴリ・#143 / #168）。
//
// 趣味家の通称表記を Web 調査で裏取りした参照データ（読み取り専用・キュレーション済み）。
// hanoba はバックエンドレス（DESIGN §6）なので DB は持たず、これは不変の `Def` データ。
// **TagPicker（#144）が開いた時に動的 import で code-split** されるよう、ここはデータ専用にする
// （静的 import で初期 composer バンドルに載せない）。検索/ドリルダウンは全てクライアントで回る。
//
// カテゴリは意味の近いもの順（多肉→メセン→塊根→サボテン→着生→観葉→食虫→蘭→和もの→シダ→コケ→
// 水草→水生→花→球根→花木→食用）。基本種・別ジャンル（水草等）は #168 で補完した。
// 値は「本文 # に入るタグ文字列」（空白は insertTag 側で _ に正規化）。表記揺れ（赤猫 ↔
// レッドキャットウィーズル 等）は調査が両形を別品種として持つため、そのまま両方を pickable に残す。

export interface Variety {
  /** 通称（本文 # に入るタグ文字列）。 */
  name: string;
  /** 学名（任意・#147 i18n）。 */
  sci?: string;
  /** 英名（任意・#147 i18n）。 */
  en?: string;
  /** 表記揺れ・別名（検索の横断ヒット用）。 */
  aliases?: string[];
}

export interface Genus {
  /** 属／グループ名。 */
  name: string;
  /** 属名自体がタグになるか（その他/原種 等のグルーピング見出しは false）。 */
  pickable: boolean;
  /** 属名の別名（スラッシュ表記・括弧注記の吸収。検索用）。 */
  aliases?: string[];
  varieties: Variety[];
}

export interface VarietyCategory {
  label: string;
  genera: Genus[];
}

export const VARIETY_CATALOG: VarietyCategory[] = [
  {
    label: "多肉植物",
    genera: [
      { name: "アガベ", pickable: true, varieties: [
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
        { name: "麻花龍", sci: "Agave titanota 'Mahanglong'" }, { name: "シャークソーイ", sci: "Agave titanota 'Shark Soei'" }, { name: "FO-076", sci: "Agave titanota 'FO-076'" }, { name: "笹の雪", sci: "Agave victoriae-reginae" },
        { name: "ビクトリアレジーナ", sci: "Agave victoriae-reginae" }, { name: "吉祥天", sci: "Agave parryi var. truncata" }, { name: "パリー", sci: "Agave parryi" }, { name: "吉祥冠", sci: "Agave potatorum 'Kisshokan'" },
        { name: "雷神", sci: "Agave potatorum" }, { name: "王妃雷神", sci: "Agave potatorum 'Ouhi Raijin'" }, { name: "五色万代", sci: "Agave lophantha 'Quadricolor'" }, { name: "滝の白糸", sci: "Agave schidigera" },
        { name: "乱れ雪", sci: "Agave filifera 'Midaresetsu'" }, { name: "吹上", sci: "Agave stricta" }, { name: "ストリクタ", sci: "Agave stricta" }, { name: "アテナータ", sci: "Agave attenuata" },
        { name: "アメリカーナ", sci: "Agave americana" }, { name: "オバティフォリア", sci: "Agave ovatifolia" }, { name: "パラサナ", sci: "Agave parrasana" }, { name: "モンタナ", sci: "Agave montana" },
      ] },
      { name: "ユーフォルビア", pickable: true, varieties: [
        { name: "オベサ", sci: "Euphorbia obesa" }, { name: "バリダ", sci: "Euphorbia valida" }, { name: "鉄甲丸", sci: "Euphorbia bupleurifolia" }, { name: "ホリダ", sci: "Euphorbia horrida" },
        { name: "ラクテア", sci: "Euphorbia lactea" }, { name: "ホワイトゴースト", sci: "Euphorbia lactea 'White Ghost'" }, { name: "マハラジャ", sci: "Euphorbia lactea 'Cristata'" }, { name: "白樺キリン", sci: "Euphorbia mammillaris 'Variegata'" },
        { name: "瑠璃晃", sci: "Euphorbia suzannae" }, { name: "スザンナエ", sci: "Euphorbia suzannae" }, { name: "笹蟹丸", sci: "Euphorbia pulvinata" }, { name: "ステラータ", sci: "Euphorbia stellata" },
        { name: "飛竜", sci: "Euphorbia stellata" }, { name: "ギラウミニアナ", sci: "Euphorbia guillauminiana" }, { name: "ポイゾニー", sci: "Euphorbia poissonii" }, { name: "デカリー", sci: "Euphorbia decaryi" },
        { name: "峨眉山", sci: "Euphorbia 'Gabizan'" }, { name: "グロボーサ", sci: "Euphorbia globosa" }, { name: "玉鱗宝", sci: "Euphorbia globosa" }, { name: "ソテツキリン", sci: "Euphorbia bupleurifolia" },
        { name: "蓬莱島", sci: "Euphorbia bupleurifolia × susannae" }, { name: "奇怪ヶ島", sci: "Euphorbia squarrosa" }, { name: "鬼笑い", sci: "Euphorbia knuthii" }, { name: "エクロニー", sci: "Euphorbia ecklonii" },
        { name: "スクアローサ", sci: "Euphorbia squarrosa" }, { name: "デシデュア", sci: "Euphorbia decidua" }, { name: "トゥレアレンシス", sci: "Euphorbia tulearensis" }, { name: "ブルアナ", sci: "Euphorbia bruynsii" },
        { name: "ダイヤモンドフロスト", sci: "Euphorbia hypericifolia 'Diamond Frost'" },
      ] },
      { name: "チレコドン", pickable: true, varieties: [
        { name: "万物想", sci: "Tylecodon reticulatus" }, { name: "阿房宮", sci: "Tylecodon paniculatus" }, { name: "奇峰錦", sci: "Tylecodon wallichii" }, { name: "砂夜叉姫", sci: "Tylecodon pearsonii" },
        { name: "レティキュラータス", sci: "Tylecodon reticulatus" }, { name: "パニクラーツス", sci: "Tylecodon paniculatus" },
      ] },
      { name: "コチレドン", pickable: true, varieties: [
        { name: "熊童子", sci: "Cotyledon tomentosa subsp. ladismithiensis" }, { name: "熊童子錦", sci: "Cotyledon tomentosa subsp. ladismithiensis 'Variegata'" }, { name: "子猫の爪", sci: "Cotyledon tomentosa" }, { name: "福娘", sci: "Cotyledon orbiculata var. oophylla" },
        { name: "だるま福娘", sci: "Cotyledon orbiculata 'Daruma'" }, { name: "ふっくら娘", sci: "Cotyledon orbiculata 'Fukkura'" }, { name: "銀波錦", sci: "Cotyledon undulata" }, { name: "ペンデンス", sci: "Cotyledon pendens" },
        { name: "オルビキュラータ", sci: "Cotyledon orbiculata" }, { name: "エリサエ", sci: "Cotyledon elisae" }, { name: "白美人", sci: "Cotyledon orbiculata 'Hakubijin'" }, { name: "パピラリス", sci: "Cotyledon papillaris" },
        { name: "旭波の光", sci: "Cotyledon orbiculata 'Kyokuha no Hikari'" }, { name: "旭波錦", sci: "Cotyledon orbiculata 'Kyokuha Nishiki'" }, { name: "嫁入り娘", sci: "Cotyledon orbiculata 'Yomeiri Musume'" }, { name: "紅覆輪", sci: "Cotyledon orbiculata 'Beni Fukurin'" },
      ] },
      { name: "セネシオ", pickable: true, varieties: [
        { name: "グリーンネックレス", sci: "Senecio rowleyanus" }, { name: "ドルフィンネックレス", sci: "Senecio peregrinus" }, { name: "ピーチネックレス", sci: "Senecio rowleyanus 'Peach'" }, { name: "ルビーネックレス", sci: "Othonna capensis" },
        { name: "三日月ネックレス", sci: "Senecio radicans" }, { name: "七宝樹", sci: "Senecio articulatus" }, { name: "万宝", sci: "Senecio kleinia" }, { name: "美空鉾", sci: "Senecio antandroi" },
        { name: "銀月", sci: "Senecio haworthii" }, { name: "京童子", sci: "Senecio herreanus" }, { name: "マサイの矢尻", sci: "Senecio kleiniiformis" }, { name: "新月", sci: "Senecio scaposus" },
        { name: "鉄錫杖", sci: "Senecio stapeliiformis" }, { name: "ヤコブセニー", sci: "Senecio jacobsenii" }, { name: "エンジェルティアーズ", sci: "Senecio herreanus 'Angel Tears'" }, { name: "ハリアヌス", sci: "Senecio harrianus" },
      ] },
      { name: "クラッスラ", pickable: true, varieties: [
        { name: "火祭り", sci: "Crassula capitella 'Campfire'" }, { name: "銀盃", sci: "Crassula arborescens 'Blue Bird'" }, { name: "神刀", sci: "Crassula perfoliata var. falcata" }, { name: "茜の塔", sci: "Crassula corymbulosa" },
        { name: "星の王子", sci: "Crassula perforata" }, { name: "桜星", sci: "Crassula 'Sakura Boshi'" }, { name: "紅稚児", sci: "Crassula pubescens subsp. radicans" }, { name: "若緑", sci: "Crassula muscosa 'Pseudolycopodioides'" },
        { name: "数珠星", sci: "Crassula rupestris subsp. marnieriana" }, { name: "南十字星", sci: "Crassula perforata 'Variegata'" }, { name: "ゴーラム", sci: "Crassula ovata 'Gollum'" }, { name: "宇宙の木", sci: "Crassula ovata 'Hobbit'" },
        { name: "リトルミッシー", sci: "Crassula pellucida subsp. marginalis 'Little Missy'" }, { name: "マネーメーカー", sci: "Crassula ovata 'Money Maker'" }, { name: "玉椿", sci: "Crassula barklyi" }, { name: "呂千絵", sci: "Crassula 'Moonglow'" },
        { name: "舞乙女", sci: "Crassula rupestris subsp. marnieriana 'Hottentot'" }, { name: "緑塔", sci: "Crassula pyramidalis" }, { name: "ブロウメアナ", sci: "Crassula expansa subsp. fragilis" }, { name: "ムスコーサ", sci: "Crassula muscosa" },
      ] },
      { name: "カランコエ", pickable: true, varieties: [
        { name: "月兎耳", sci: "Kalanchoe tomentosa" }, { name: "福兎耳", sci: "Kalanchoe eriophylla" }, { name: "黒兎耳", sci: "Kalanchoe tomentosa 'Chocolate Soldier'" }, { name: "唐印", sci: "Kalanchoe luciae" },
        { name: "デザートローズ", sci: "Kalanchoe thyrsiflora" }, { name: "仙女の舞", sci: "Kalanchoe beharensis" }, { name: "胡蝶の舞", sci: "Kalanchoe laxiflora" }, { name: "白銀の舞", sci: "Kalanchoe pumila" },
        { name: "不死鳥", sci: "Kalanchoe daigremontiana × delagoensis" }, { name: "子宝草", sci: "Kalanchoe daigremontiana × delagoensis" }, { name: "朱蓮", sci: "Kalanchoe longiflora var. coccinea" }, { name: "ミロッティー", sci: "Kalanchoe millotii" },
        { name: "チョコレートソルジャー", sci: "Kalanchoe tomentosa 'Chocolate Soldier'" }, { name: "ベハレンシス", sci: "Kalanchoe beharensis" }, { name: "ファング", sci: "Kalanchoe beharensis 'Fang'" },
      ] },
      { name: "アロエ", pickable: true, varieties: [
        { name: "ディコトマ", sci: "Aloidendron dichotomum" }, { name: "ポリフィラ", sci: "Aloe polyphylla" }, { name: "不夜城", sci: "Aloe nobilis" }, { name: "千代田錦", sci: "Aloe variegata" },
        { name: "ハオルチオイデス", sci: "Aloe haworthioides" }, { name: "キダチアロエ", sci: "Aloe arborescens" }, { name: "羅紋錦", sci: "Aloe striata" }, { name: "鬼ヒトデ", sci: "Aloe humilis" },
        { name: "プリカティリス", sci: "Kumara plicatilis" }, { name: "アロエベラ", sci: "Aloe vera" }, { name: "ペグレラエ", sci: "Aloe peglerae" }, { name: "綾錦", sci: "Aloe aristata" },
        { name: "帝王錦", sci: "Aloe humilis 'Globosa'" },
      ] },
      { name: "ガステリア", pickable: true, varieties: [
        { name: "臥牛", sci: "Gasteria armstrongii" }, { name: "グロメラータ", sci: "Gasteria glomerata" }, { name: "バイリシアナ", sci: "Gasteria baylissiana" }, { name: "子宝錦", sci: "Gasteria gracilis var. minima 'Variegata'" },
      ] },
      { name: "ハオルチア", pickable: true, varieties: [
        { name: "オブツーサ", sci: "Haworthia cooperi var. truncata" }, { name: "ブラックオブツーサ", sci: "Haworthia cooperi 'Black Obtusa'" }, { name: "雫石", sci: "Haworthia cooperi var. truncata 'Shizukuishi'" }, { name: "レツーサ", sci: "Haworthia retusa" },
        { name: "コレクタ", sci: "Haworthia correcta" }, { name: "京の舞", sci: "Haworthia 'Kyo no Mai'" }, { name: "玉扇", sci: "Haworthia truncata" }, { name: "万象", sci: "Haworthia maughanii" },
        { name: "寿", sci: "Haworthia retusa" }, { name: "ピクタ", sci: "Haworthia picta" }, { name: "スプレンデンス", sci: "Haworthia splendens" }, { name: "クーペリー", sci: "Haworthia cooperi" },
        { name: "ベヌスタ", sci: "Haworthia cooperi var. venusta" }, { name: "ムチカ", sci: "Haworthia mutica" }, { name: "十二の巻", sci: "Haworthiopsis fasciata" }, { name: "竜鱗", sci: "Haworthiopsis tessellata" },
        { name: "宝草", sci: "Haworthia cuspidata" },
      ] },
      { name: "エケベリア", pickable: true, varieties: [
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
      { name: "グラプトペタルム", pickable: true, varieties: [
        { name: "朧月", sci: "Graptopetalum paraguayense" }, { name: "姫秋麗", sci: "Graptopetalum mendozae" }, { name: "ブロンズ姫", sci: "Graptosedum 'Bronze'" }, { name: "銀天女", sci: "Graptopetalum rusbyi" },
        { name: "秋麗", sci: "Graptosedum 'Francesco Baldi'" }, { name: "ダルマ秋麗", sci: "Graptosedum 'Francesco Baldi Compactum'" }, { name: "パラグアイエンセ", sci: "Graptopetalum paraguayense" }, { name: "淡雪", sci: "Graptopetalum 'Awayuki'" },
      ] },
      { name: "セダム", pickable: true, varieties: [
        { name: "虹の玉", sci: "Sedum × rubrotinctum" }, { name: "オーロラ", sci: "Sedum × rubrotinctum 'Aurora'" }, { name: "乙女心", sci: "Sedum pachyphyllum" }, { name: "玉つづり", sci: "Sedum morganianum" },
        { name: "銘月", sci: "Sedum adolphi" }, { name: "黄麗", sci: "Sedum adolphi 'Golden Glow'" }, { name: "春萌", sci: "Sedum 'Alice Evans'" }, { name: "万年草", sci: "Sedum mexicanum" },
        { name: "レッドベリー", sci: "Sedum rubrotinctum 'Redberry'" }, { name: "アトランティス", sci: "Sedum takesimense 'Atlantis'" }, { name: "リトルミッシー", sci: "Sedum 'Little Missy'" }, { name: "パープルヘイズ", sci: "Sedum dasyphyllum 'Purple Haze'" },
        { name: "新玉つづり", sci: "Sedum 'Little Gem'" }, { name: "ヒスパニクム", sci: "Sedum hispanicum" },
      ] },
      { name: "パキフィツム", pickable: true, varieties: [
        { name: "桃美人", sci: "Pachyphytum 'Momobijin'" }, { name: "星美人", sci: "Pachyphytum oviferum" }, { name: "月美人", sci: "Pachyphytum 'Tsukibijin'" }, { name: "群雀", sci: "Pachyphytum hookeri" },
        { name: "ベビーフィンガー", sci: "Pachyphytum 'Baby Finger'" }, { name: "千代田の松", sci: "Pachyphytum compactum" }, { name: "京美人", sci: "Pachyphytum 'Kyobijin'" }, { name: "フーケリー", sci: "Pachyphytum hookeri" },
      ] },
    ],
  },
  {
    label: "メセン",
    genera: [
      { name: "コノフィツム", pickable: true, varieties: [
        { name: "ウィッテベルゲンセ", sci: "Conophytum wittebergense" }, { name: "ブルゲリ", sci: "Conophytum burgeri" }, { name: "オペラローズ", sci: "Conophytum 'Opera Rose'" }, { name: "花園", sci: "Conophytum 'Hanazono'" },
        { name: "ペルシダム", sci: "Conophytum pellucidum" }, { name: "玉彦", sci: "Conophytum flavum" }, { name: "マウガニー", sci: "Conophytum maughanii" }, { name: "群碧玉", sci: "Conophytum minutum" },
        { name: "寂光", sci: "Conophytum frutescens" }, { name: "円空玉", sci: "Conophytum ectypum" },
      ] },
      { name: "リトープス", pickable: true, varieties: [
        { name: "日輪玉", sci: "Lithops aucampiae" }, { name: "福来玉", sci: "Lithops julii subsp. fulleri" }, { name: "紫勲", sci: "Lithops lesliei" }, { name: "大津絵", sci: "Lithops otzeniana" },
        { name: "オリーブ玉", sci: "Lithops olivacea" }, { name: "麗虹玉", sci: "Lithops dorotheae" }, { name: "招福玉", sci: "Lithops bromfieldii" }, { name: "富貴玉", sci: "Lithops hookeri" },
        { name: "紅大内玉", sci: "Lithops optica 'Rubra'" }, { name: "巴里玉", sci: "Lithops hallii" }, { name: "花紋玉", sci: "Lithops karasmontana" }, { name: "李夫人", sci: "Lithops salicola" },
      ] },
      { name: "フェネストラリア", pickable: true, varieties: [
        { name: "五十鈴玉", sci: "Fenestraria rhopalophylla subsp. aurantiaca" }, { name: "群玉", sci: "Fenestraria rhopalophylla" },
      ] },
      { name: "プレイオスピロス", pickable: true, varieties: [
        { name: "帝玉", sci: "Pleiospilos nelii" }, { name: "紫帝玉", sci: "Pleiospilos nelii 'Royal Flush'" }, { name: "鳳卵", sci: "Pleiospilos bolusii" },
      ] },
      { name: "フォーカリア", pickable: true, varieties: [
        { name: "怒涛", sci: "Faucaria tuberculosa" }, { name: "四海波", sci: "Faucaria tigrina" }, { name: "雪波", sci: "Faucaria felina" },
      ] },
      { name: "チタノプシス", pickable: true, varieties: [
        { name: "天女", sci: "Titanopsis calcarea" }, { name: "カルカレア", sci: "Titanopsis calcarea" },
      ] },
      { name: "アルギロデルマ", pickable: true, varieties: [
        { name: "金鈴", sci: "Argyroderma delaetii" }, { name: "国宝玉", sci: "Argyroderma delaetii" },
      ] },
      { name: "ギバエウム", pickable: true, varieties: [
        { name: "無比玉", sci: "Gibbaeum velutinum" }, { name: "銀光玉", sci: "Gibbaeum heathii" },
      ] },
      { name: "ディンテランサス", pickable: true, varieties: [
        { name: "南蛮玉", sci: "Dinteranthus vanzylii" }, { name: "幻玉", sci: "Dinteranthus wilmotianus" },
      ] },
      { name: "フリチア", pickable: true, varieties: [
        { name: "光玉", sci: "Frithia pulchra" },
      ] },
    ],
  },
  {
    label: "塊根植物",
    genera: [
      { name: "パキポディウム", pickable: true, varieties: [
        { name: "グラキリス", sci: "Pachypodium rosulatum var. gracilius" }, { name: "象牙宮", sci: "Pachypodium rosulatum var. gracilius" }, { name: "恵比寿笑い", sci: "Pachypodium brevicaule" }, { name: "ブレビカウレ", sci: "Pachypodium brevicaule" },
        { name: "恵比寿大黒", sci: "Pachypodium 'Densicaule'" }, { name: "デンシフローラム", sci: "Pachypodium densiflorum" }, { name: "ウィンゾリー", sci: "Pachypodium windsorii" }, { name: "ラメリー", sci: "Pachypodium lamerei" },
        { name: "ゲアイー", sci: "Pachypodium geayi" }, { name: "ロスラーツム", sci: "Pachypodium rosulatum" }, { name: "カクチペス", sci: "Pachypodium rosulatum subsp. cactipes" }, { name: "レウコキサンツム", sci: "Pachypodium rosulatum subsp. leucoxanthum" },
        { name: "エブルネウム", sci: "Pachypodium eburneum" }, { name: "ホロンベンセ", sci: "Pachypodium horombense" }, { name: "イノピナツム", sci: "Pachypodium rosulatum subsp. inopinatum" }, { name: "マカイエンセ", sci: "Pachypodium makayense" },
        { name: "ラモスム", sci: "Pachypodium ramosum" }, { name: "フィヘレネンセ", sci: "Pachypodium lamerei var. fiherenense" }, { name: "デカリー", sci: "Pachypodium decaryi" }, { name: "ルーテンベルギアヌム", sci: "Pachypodium rutenbergianum" },
        { name: "アンボンゲンセ", sci: "Pachypodium ambongense" }, { name: "バロニー", sci: "Pachypodium baronii" }, { name: "サンデルシー", sci: "Pachypodium saundersii" }, { name: "白馬城", sci: "Pachypodium saundersii" },
        { name: "ビスピノーサム", sci: "Pachypodium bispinosum" }, { name: "サキュレンタム", sci: "Pachypodium succulentum" }, { name: "ナマクアナム", sci: "Pachypodium namaquanum" }, { name: "光堂", sci: "Pachypodium namaquanum" },
        { name: "リーアリー", sci: "Pachypodium lealii" },
      ] },
      { name: "アデニウム", pickable: true, varieties: [
        { name: "砂漠のバラ", sci: "Adenium obesum" }, { name: "オベスム", sci: "Adenium obesum" }, { name: "アラビカム", sci: "Adenium arabicum" }, { name: "ソコトラナム", sci: "Adenium socotranum" },
        { name: "ソマレンセ", sci: "Adenium somalense" },
      ] },
      { name: "オペルクリカリア", pickable: true, varieties: [
        { name: "パキプス", sci: "Operculicarya pachypus" }, { name: "デカリー", sci: "Operculicarya decaryi" },
      ] },
      { name: "ディオスコレア", pickable: true, varieties: [
        { name: "亀甲竜", sci: "Dioscorea elephantipes" }, { name: "アフリカ亀甲竜", sci: "Dioscorea sylvatica" }, { name: "エレファンティペス", sci: "Dioscorea elephantipes" },
      ] },
      { name: "ステファニア", pickable: true, varieties: [
        { name: "エレクタ", sci: "Stephania erecta" }, { name: "ピエレイ", sci: "Stephania pierrei" }, { name: "スベローサ", sci: "Stephania suberosa" },
      ] },
      { name: "アデニア", pickable: true, varieties: [
        { name: "グラウカ", sci: "Adenia glauca" }, { name: "グロボーサ", sci: "Adenia globosa" }, { name: "スピノーサ", sci: "Adenia spinosa" },
      ] },
      { name: "ドルステニア", pickable: true, varieties: [
        { name: "ギガス", sci: "Dorstenia gigas" }, { name: "フォエチダ", sci: "Dorstenia foetida" },
      ] },
      { name: "ボスウェリア", pickable: true, varieties: [
        { name: "サクラ", sci: "Boswellia sacra" }, { name: "ネアリー", sci: "Boswellia neglecta" },
      ] },
      { name: "ブルセラ", pickable: true, varieties: [
        { name: "ファガロイデス", sci: "Bursera fagaroides" }, { name: "ミクロフィラ", sci: "Bursera microphylla" },
      ] },
      { name: "フォークイエリア", pickable: true, varieties: [
        { name: "ファシクラータ", sci: "Fouquieria fasciculata" }, { name: "コルムナリス", sci: "Fouquieria columnaris" }, { name: "ディグエッティ", sci: "Fouquieria diguetii" }, { name: "プルプシー", sci: "Fouquieria purpusii" },
      ] },
      { name: "ペラルゴニウム", pickable: true, aliases: ["塊根"], varieties: [
        { name: "アペンディクラツム", sci: "Pelargonium appendiculatum" }, { name: "ミラビレ", sci: "Pelargonium mirabile" }, { name: "カルノーサム", sci: "Pelargonium carnosum" },
      ] },
      { name: "その他塊根", pickable: false, varieties: [
        { name: "フォッケア", sci: "Fockea edulis" }, { name: "火星人", sci: "Fockea edulis" }, { name: "モンソニア", sci: "Monsonia sp." }, { name: "サルコカウロン", sci: "Sarcocaulon sp." },
        { name: "オトンナ", sci: "Othonna sp." }, { name: "キフォステンマ", sci: "Cyphostemma juttae" }, { name: "フィカス ペティオラリス", sci: "Ficus petiolaris" }, { name: "ブーファン", sci: "Boophone disticha" },
        { name: "ウンカリーナ", sci: "Uncarina grandidieri" }, { name: "パキコルムス", sci: "Pachycormus discolor" }, { name: "ゲラルダンサス", sci: "Gerrardanthus macrorhizus" }, { name: "ヤトロファ", sci: "Jatropha sp." },
        { name: "センナ メリディオナリス", sci: "Senna meridionalis" }, { name: "サンセベリア", sci: "Sansevieria sp." }, { name: "スタッキー", sci: "Sansevieria stuckyi" },
      ] },
    ],
  },
  {
    label: "サボテン",
    genera: [
      { name: "マミラリア", pickable: true, varieties: [
        { name: "玉翁" }, { name: "白星" }, { name: "金洋丸" }, { name: "高砂" },
        { name: "ピコ" }, { name: "内裏玉" }, { name: "月影丸" }, { name: "明星" },
        { name: "豊明丸" }, { name: "白鳥" }, { name: "カルメナエ" }, { name: "猩々丸" },
      ] },
      { name: "アストロフィツム", pickable: true, varieties: [
        { name: "兜" }, { name: "兜丸" }, { name: "スーパー兜" }, { name: "ゼブラスーパー兜" },
        { name: "アロースーパー兜" }, { name: "V兜" }, { name: "鸞鳳玉" }, { name: "ランポー玉" },
        { name: "般若" }, { name: "瑞鳳玉" }, { name: "恩塚ランポー" }, { name: "ヘキラン" },
        { name: "兜錦" },
      ] },
      { name: "ギムノカリキウム", pickable: true, varieties: [
        { name: "緋牡丹" }, { name: "緋牡丹錦" }, { name: "牡丹玉" }, { name: "LB2178" },
        { name: "海王丸" }, { name: "怪竜丸" }, { name: "新天地" }, { name: "天平丸" },
        { name: "緋花玉" }, { name: "翠晃冠" }, { name: "光琳玉" }, { name: "麗蛇丸" },
      ] },
      { name: "エキノカクタス", pickable: true, varieties: [
        { name: "金鯱" }, { name: "太平丸" }, { name: "雷帝" }, { name: "王冠竜" },
        { name: "春雷" }, { name: "尖光丸" },
      ] },
      { name: "ロフォフォラ", pickable: true, varieties: [
        { name: "烏羽玉" }, { name: "翠冠玉" }, { name: "銀冠玉" }, { name: "子吹烏羽玉" },
      ] },
      { name: "フェロカクタス", pickable: true, varieties: [
        { name: "日の出丸" }, { name: "江守玉" }, { name: "金冠竜" }, { name: "太陽" },
        { name: "王虎" }, { name: "赤刺金冠竜" },
      ] },
      { name: "エキノプシス", pickable: true, varieties: [
        { name: "短毛丸" }, { name: "花盛丸" }, { name: "世界の図" },
      ] },
      { name: "パロディア", pickable: true, varieties: [
        { name: "獅子王丸" }, { name: "英冠玉" }, { name: "金晃丸" }, { name: "青王丸" },
      ] },
      { name: "ツルビニカルプス", pickable: true, varieties: [
        { name: "烏城丸" }, { name: "精巧丸" }, { name: "昇竜丸" }, { name: "牙城丸" },
        { name: "ミニマ" }, { name: "長城丸" },
      ] },
      { name: "テロカクタス", pickable: true, varieties: [
        { name: "緋冠竜" }, { name: "大統領" }, { name: "天晃" },
      ] },
      { name: "アリオカルプス", pickable: true, varieties: [
        { name: "岩牡丹" }, { name: "亀甲牡丹" }, { name: "玉牡丹" }, { name: "黒牡丹" },
        { name: "花牡丹" }, { name: "象牙牡丹" }, { name: "三角牡丹" }, { name: "連山" },
        { name: "亀甲牡丹ゴジラ" },
      ] },
      { name: "その他", pickable: false, varieties: [
        { name: "月世界" }, { name: "小人の帽子" }, { name: "鬼面角" }, { name: "残雪の峰" },
        { name: "山影丸" },
      ] },
    ],
  },
  {
    label: "ビカクシダ",
    genera: [
      { name: "原種", pickable: false, varieties: [
        { name: "ビカクシダ" }, { name: "コウモリラン" }, { name: "リドレイ" }, { name: "ウィリンキー" },
        { name: "グランデ" }, { name: "コロナリウム" }, { name: "ビフルカツム" }, { name: "エレファントティス" },
        { name: "ヴェイチー" }, { name: "ベイチー" }, { name: "ステマリア" }, { name: "ヒリー" },
        { name: "スパーバム" }, { name: "マダガスカリエンセ" }, { name: "ワンダエ" }, { name: "アルシコルネ" },
        { name: "ホルタミー" }, { name: "ワリチー" }, { name: "エリシー" }, { name: "クアドリディコトマム" },
        { name: "アンゴレンセ" }, { name: "アンディナム" },
      ] },
      { name: "交配・著名個体", pickable: false, varieties: [
        { name: "ネザーランド" }, { name: "ネザーランズ" }, { name: "グリフィン" }, { name: "キッチャクード" },
        { name: "ホワイトホーク" }, { name: "ペドロ" }, { name: "ドラゴン" }, { name: "キリン" },
        { name: "ギンガ" }, { name: "スザク" }, { name: "ジェイドガール" }, { name: "ペガサス" },
      ] },
    ],
  },
  {
    label: "エアプランツ",
    genera: [
      { name: "チランジア", pickable: true, varieties: [
        { name: "エアプランツ" }, { name: "イオナンタ" }, { name: "ウスネオイデス" }, { name: "キセログラフィカ" },
        { name: "ストレプトフィラ" }, { name: "カピタータ" }, { name: "ブルボーサ" }, { name: "フックシー" },
        { name: "フクシー" }, { name: "テクトラム" }, { name: "ハリシー" }, { name: "コットンキャンディ" },
        { name: "ジュンセア" }, { name: "カプトメドゥーサエ" }, { name: "ブラキカウロス" }, { name: "ベルゲリ" },
        { name: "ドゥラティ" }, { name: "パウシフォリア" }, { name: "セレリアナ" }, { name: "ファシクラータ" },
        { name: "ストリクタ" }, { name: "レクルビフォリア" },
      ] },
    ],
  },
  {
    label: "観葉植物",
    genera: [
      { name: "モンステラ", pickable: true, varieties: [
        { name: "デリシオサ" }, { name: "デリシオーサ" }, { name: "アダンソニー" }, { name: "ヒメモンステラ" },
        { name: "ボルシギアナ" }, { name: "ジェイドシャトルコック" }, { name: "スタンドレヤナ" }, { name: "ドゥビア" },
        { name: "オブリクア" }, { name: "レクレリアナ" }, { name: "ペルー" }, { name: "ピナッティパルティタ" },
        { name: "タイコンステレーション" }, { name: "ホワイトタイガー" }, { name: "アルボ" }, { name: "アルボバリエガータ" },
        { name: "ハーフムーン" }, { name: "フルムーン" }, { name: "オーレア" }, { name: "ミントバリエガータ" },
        { name: "白斑モンステラ" },
      ] },
      { name: "フィロデンドロン", pickable: true, varieties: [
        { name: "バーキン" }, { name: "ピンクプリンセス" }, { name: "ホワイトナイト" }, { name: "ホワイトウィザード" },
        { name: "セローム" }, { name: "ザナドゥ" }, { name: "クッカバラ" }, { name: "グロリオスム" },
        { name: "メラノクリサム" }, { name: "マイカンス" }, { name: "ブラジル" }, { name: "オキシカルジウム" },
        { name: "シルバーメタル" }, { name: "エルベセンス" }, { name: "パライソベルディ" },
      ] },
      { name: "アロカシア", pickable: true, varieties: [
        { name: "アマゾニカ" }, { name: "ザンラベシカ" }, { name: "バンビーノ" }, { name: "ブラックベルベット" },
        { name: "クプレア" }, { name: "ドラゴンスケール" }, { name: "シルバードラゴン" }, { name: "スティングレイ" },
        { name: "グリーンベルベット" }, { name: "レガリスシルバー" }, { name: "マハラニ" }, { name: "ゼブリナ" },
        { name: "ワトソニアナ" }, { name: "スカルプラム" }, { name: "レッドシークレット" },
      ] },
      { name: "アンスリウム", pickable: true, varieties: [
        { name: "クラリネルビウム" }, { name: "ウォロケウシー" }, { name: "クリスタリナム" }, { name: "フーケリー" },
        { name: "ベイチー" }, { name: "ワロクアナム" }, { name: "マグニフィカム" }, { name: "シロシマウチワ" },
      ] },
      { name: "ホヤ", pickable: true, varieties: [
        { name: "サクララン" }, { name: "カルノーサ" }, { name: "ケリー" }, { name: "リネアリス" },
        { name: "プビカリクス" }, { name: "クミンギアナ" }, { name: "マクロフィラ" }, { name: "カウダータ" },
        { name: "ベラ" }, { name: "オボバタ" }, { name: "リップカラー" },
      ] },
      { name: "ベゴニア", pickable: true, varieties: [
        { name: "マクラータ" }, { name: "レックス" }, { name: "マゾニアナ" }, { name: "木立性ベゴニア" },
        { name: "根茎性ベゴニア" }, { name: "球根性ベゴニア" },
      ] },
      { name: "カラテア", pickable: true, varieties: [
        { name: "マコヤナ" }, { name: "オルナータ" }, { name: "ホワイトスター" }, { name: "ランキフォリア" },
        { name: "ゼブリナ" }, { name: "ムサイカ" }, { name: "ロゼオピクタ" }, { name: "インシグニス" },
      ] },
      { name: "シンゴニウム", pickable: true, varieties: [
        { name: "ピンク" }, { name: "ネオン" }, { name: "アルボ" }, { name: "パンサー" },
        { name: "レッドスポット" }, { name: "ミルクコンフェッティ" }, { name: "マーブル" },
      ] },
      { name: "ポトス", pickable: true, aliases: ["エピプレムナム"], varieties: [
        { name: "エピプレムナム" }, { name: "ピンナタム" }, { name: "ゴールデン" }, { name: "マーブルクイーン" },
        { name: "ライム" }, { name: "エンジョイ" }, { name: "グローバルグリーン" }, { name: "ハーレクイン" },
        { name: "セブブルー" }, { name: "シンダプサス" }, { name: "トリカラー" },
      ] },
      { name: "フィカス", pickable: true, aliases: ["ゴムの木"], varieties: [
        { name: "ウンベラータ" }, { name: "ベンガレンシス" }, { name: "アルテシマ" }, { name: "バーガンディ" },
        { name: "ベンジャミン" }, { name: "ベンジャミナ" }, { name: "ガジュマル" }, { name: "ティネケ" },
        { name: "ルビギノーサ" }, { name: "ペティオラリス" }, { name: "リラータ" }, { name: "プミラ" },
      ] },
      { name: "ドラセナ", pickable: true, varieties: [
        { name: "幸福の木" }, { name: "マッサンゲアナ" }, { name: "コンシンネ" }, { name: "マジナータ" },
        { name: "ソング・オブ・インディア" }, { name: "ソング・オブ・ジャマイカ" }, { name: "コンパクタ" }, { name: "レモンライム" },
        { name: "ワーネッキー" }, { name: "ドラド" }, { name: "デレメンシス" },
      ] },
      { name: "パキラ", pickable: true, aliases: ["発財樹"], varieties: [
        { name: "グラブラ" }, { name: "アクアティカ" }, { name: "ミルキーウェイ" },
      ] },
      { name: "アイビー", pickable: true, aliases: ["ヘデラ"], varieties: [
        { name: "ヘデラ" }, { name: "ヘリックス" }, { name: "グレーシャー" }, { name: "ゴールドチャイルド" },
        { name: "ホワイトワンダー" }, { name: "ピッツバーグ" }, { name: "カナリエンシス" }, { name: "雪の妖精" },
      ] },
      { name: "シェフレラ", pickable: true, aliases: ["カポック"], varieties: [
        { name: "アンガスティフォリア" }, { name: "コンパクタ" }, { name: "ホンコン" }, { name: "アルボリコラ" },
        { name: "レナータ" }, { name: "アマテ" },
      ] },
      { name: "その他観葉", pickable: false, varieties: [
        { name: "ディフェンバキア" }, { name: "クワズイモ" }, { name: "アグラオネマ" }, { name: "ザミオクルカス" },
        { name: "ペペロミア" }, { name: "ストレリチア" }, { name: "エバーフレッシュ" }, { name: "ストロマンテ" },
        { name: "クテナンテ" }, { name: "ディスキディア" }, { name: "サンスベリア" },
      ] },
    ],
  },
  {
    label: "食虫植物",
    genera: [
      { name: "ハエトリソウ", pickable: true, varieties: [
        { name: "ディオネア" }, { name: "ハエトリグサ" }, { name: "マスシプラ" }, { name: "B52" },
        { name: "レッドピラニア" }, { name: "シャークティース" }, { name: "レッドドラゴン" }, { name: "ホエール" },
        { name: "ビッグマウス" }, { name: "ピンクビーナス" }, { name: "カップトラップ" }, { name: "エイリアン" },
        { name: "ジョーズ" }, { name: "ダーウィンレッドピラニア" },
      ] },
      { name: "ネペンテス", pickable: true, varieties: [
        { name: "ウツボカズラ" }, { name: "アラータ" }, { name: "ベントリコーサ" }, { name: "ベントラータ" },
        { name: "アンプラリア" }, { name: "ラフレシアナ" }, { name: "トランカータ" }, { name: "アルボマギナタ" },
        { name: "マキシマ" }, { name: "ラジャ" }, { name: "ハマタ" }, { name: "ローウィー" },
        { name: "ビーチー" }, { name: "アッテンボロギ" }, { name: "シンガラナ" }, { name: "グラシリス" },
        { name: "スペクタビリス" }, { name: "エドワードシアナ" }, { name: "ミランダ" }, { name: "レディラック" },
        { name: "ダイエリアナ" }, { name: "ガヤ" }, { name: "ミクスタ" }, { name: "ルイーザ" },
      ] },
      { name: "サラセニア", pickable: true, varieties: [
        { name: "ヘイシソウ" }, { name: "レウコフィラ" }, { name: "プルプレア" }, { name: "フラバ" },
        { name: "プシタシナ" }, { name: "アラタ" }, { name: "ミノール" }, { name: "ルブラ" },
        { name: "オレオフィラ" }, { name: "コーティ" }, { name: "エクセレンス" }, { name: "スカーレットベル" },
        { name: "レッドチューブ" },
      ] },
      { name: "ドロセラ", pickable: true, varieties: [
        { name: "モウセンゴケ" }, { name: "カペンシス" }, { name: "カペンシスレッド" }, { name: "カペンシスアルバ" },
        { name: "アデラエ" }, { name: "スパチュラータ" }, { name: "ビナータ" }, { name: "ブルマニー" },
        { name: "フィリフォルミス" }, { name: "マダガスカリエンシス" }, { name: "トウカイエンシス" }, { name: "ピグミードロセラ" },
        { name: "塊根ドロセラ" }, { name: "コモウセンゴケ" }, { name: "ナガバノモウセンゴケ" },
      ] },
      { name: "ピンギキュラ", pickable: true, varieties: [
        { name: "ムシトリスミレ" }, { name: "エセリアナ" }, { name: "モラネンシス" }, { name: "ギガンテア" },
        { name: "アグナタ" }, { name: "モクテズマエ" }, { name: "レクティフォリア" }, { name: "シクロセクタ" },
        { name: "グラシリス" }, { name: "プリムリフローラ" }, { name: "プラニフォリア" }, { name: "ティナ" },
        { name: "アフロディーテ" }, { name: "コウシンソウ" },
      ] },
      { name: "その他", pickable: false, varieties: [
        { name: "セファロタス" }, { name: "フクロユキノシタ" }, { name: "ヘリアンフォラ" }, { name: "ゲンリセア" },
        { name: "ウトリクラリア" }, { name: "ミミカキグサ" }, { name: "タヌキモ" },
      ] },
    ],
  },
  {
    label: "蘭",
    genera: [
      { name: "胡蝶蘭", pickable: true, varieties: [
        { name: "ファレノプシス" }, { name: "コチョウラン" }, { name: "ミディ胡蝶蘭" }, { name: "アマビリス" },
        { name: "シレリアナ" }, { name: "アフロディーテ" },
      ] },
      { name: "カトレア", pickable: true, varieties: [
        { name: "カトレヤ" }, { name: "ミニカトレア" }, { name: "ワルケリアナ" }, { name: "ラビアタ" },
        { name: "パープラータ" }, { name: "マキシマ" }, { name: "ルデマニアナ" }, { name: "インターメディア" },
      ] },
      { name: "デンドロビウム", pickable: true, varieties: [
        { name: "デンドロ" }, { name: "ノビル" }, { name: "デンファレ" }, { name: "キンギアナム" },
        { name: "シルコッキー" }, { name: "カリスタ系" },
      ] },
      { name: "パフィオペディルム", pickable: true, varieties: [
        { name: "パフィオ" }, { name: "ロスチャイルディアナム" }, { name: "デレナティ" }, { name: "多花性パフィオ" },
      ] },
      { name: "富貴蘭", pickable: true, varieties: [
        { name: "フウラン" }, { name: "風蘭" }, { name: "建国殿" }, { name: "富貴殿" },
        { name: "金兜" }, { name: "羽衣" }, { name: "御城覆輪" }, { name: "金牡丹" },
        { name: "朝日殿" }, { name: "西出都" }, { name: "豊明殿" }, { name: "青海" },
        { name: "金孔雀" }, { name: "翡翠" }, { name: "羆" }, { name: "紅扇" },
        { name: "湖東覆輪" },
      ] },
      { name: "セッコク", pickable: true, varieties: [
        { name: "石斛" }, { name: "長生蘭" }, { name: "金鶏閣" }, { name: "銀雪" },
        { name: "紅苑" }, { name: "黄金丸" }, { name: "金剛石" }, { name: "紅小町" },
        { name: "雷山" }, { name: "龍田" }, { name: "燈麗" },
      ] },
      { name: "エビネ", pickable: true, varieties: [
        { name: "カランセ" }, { name: "ジエビネ" }, { name: "キエビネ" }, { name: "ニオイエビネ" },
        { name: "サルメンエビネ" }, { name: "キリシマエビネ" },
      ] },
      { name: "その他の蘭", pickable: false, varieties: [
        { name: "シンビジウム" }, { name: "オンシジウム" }, { name: "バンダ" }, { name: "デンドロキラム" },
        { name: "リカステ" }, { name: "ミルトニア" }, { name: "マスデバリア" }, { name: "アングレカム" },
      ] },
      { name: "野生ラン", pickable: false, varieties: [
        { name: "ウチョウラン" }, { name: "クマガイソウ" }, { name: "アツモリソウ" }, { name: "サギソウ" },
        { name: "ネジバナ" }, { name: "シラン" }, { name: "シプリペディウム" },
      ] },
    ],
  },
  {
    label: "山野草",
    genera: [
      { name: "山野草", pickable: true, varieties: [
        { name: "雪割草" }, { name: "福寿草" }, { name: "イワヒバ" }, { name: "春蘭" },
        { name: "寒蘭" }, { name: "イワチドリ" }, { name: "ホトトギス" }, { name: "日本桜草" },
        { name: "ダイモンジソウ" }, { name: "イワタバコ" }, { name: "高山植物" }, { name: "斑入り山野草" },
      ] },
    ],
  },
  {
    label: "盆栽",
    genera: [
      { name: "盆栽樹種", pickable: false, varieties: [
        { name: "黒松" }, { name: "五葉松" }, { name: "赤松" }, { name: "錦松" },
        { name: "真柏" }, { name: "糸魚川真柏" }, { name: "杜松" }, { name: "蝦夷松" },
        { name: "唐松" }, { name: "杉" }, { name: "桧" }, { name: "石化檜" },
        { name: "一位" }, { name: "山もみじ" }, { name: "出猩々" }, { name: "楓" },
        { name: "唐楓" }, { name: "欅" }, { name: "ブナ" }, { name: "長寿梅" },
        { name: "盆梅" }, { name: "旭山桜" }, { name: "富士桜" }, { name: "椿" },
        { name: "皐月" }, { name: "ボケ" }, { name: "南天" }, { name: "ピラカンサ" },
        { name: "花梨" }, { name: "老爺柿" }, { name: "姫りんご" }, { name: "ウメモドキ" },
        { name: "蝋梅" }, { name: "クチナシ" }, { name: "苔盆栽" }, { name: "草もの盆栽" },
        { name: "ミニ盆栽" }, { name: "寄せ植え盆栽" },
      ] },
      { name: "さつき盆栽", pickable: false, aliases: ["皐月の銘"], varieties: [
        { name: "大盃" }, { name: "日光" }, { name: "月光" }, { name: "晃山" },
        { name: "白光" }, { name: "暁天" }, { name: "松鏡" }, { name: "長寿宝" },
        { name: "鹿沼" },
      ] },
    ],
  },
  {
    label: "シダ",
    genera: [
      { name: "アジアンタム", pickable: true, varieties: [
        { name: "ラディアナム" }, { name: "フリッツルーシー" }, { name: "ペルビアナム" }, { name: "ホウライシダ" },
      ] },
      { name: "プテリス", pickable: true, varieties: [
        { name: "クレティカ" }, { name: "アルボリネアタ" }, { name: "イノキシマ" },
      ] },
      { name: "ネフロレピス", pickable: true, aliases: ["タマシダ"], varieties: [
        { name: "ツデー" }, { name: "ボストンファーン" }, { name: "スコッチ" }, { name: "ダフィー" },
      ] },
      { name: "ダバリア", pickable: true, aliases: ["シノブ"], varieties: [
        { name: "トキワシノブ" }, { name: "玉シダ" },
      ] },
      { name: "アスプレニウム", pickable: true, aliases: ["タニワタリ"], varieties: [
        { name: "オオタニワタリ" }, { name: "コブラ" }, { name: "エメラルドウェーブ" }, { name: "アビス" },
      ] },
      { name: "その他シダ", pickable: false, aliases: ["シダ"], varieties: [
        { name: "シダ" }, { name: "リュウビンタイ" }, { name: "ヒノキシダ" }, { name: "クサソテツ" },
        { name: "コゴミ" }, { name: "ゼンマイ" }, { name: "ワラビ" }, { name: "イノモトソウ" },
        { name: "トキワシダ" }, { name: "ブレクナム" }, { name: "ヘミオニティス" }, { name: "イワヒバ" },
      ] },
    ],
  },
  {
    label: "コケ",
    genera: [
      { name: "コケ各種", pickable: false, aliases: ["苔", "コケ", "モス"], varieties: [
        { name: "苔" }, { name: "コケ" }, { name: "ホソバオキナゴケ", aliases: ["山苔"] }, { name: "ハイゴケ" },
        { name: "スナゴケ" }, { name: "タマゴケ" }, { name: "ヒノキゴケ" }, { name: "シノブゴケ" },
        { name: "ホウオウゴケ" }, { name: "コツボゴケ" }, { name: "スギゴケ" }, { name: "ゼニゴケ" },
        { name: "苔テラリウム" }, { name: "苔玉" },
      ] },
    ],
  },
  {
    label: "水草",
    genera: [
      { name: "アヌビアス", pickable: true, varieties: [
        { name: "ナナ" }, { name: "ナナプチ" }, { name: "コーヒーフォリア" }, { name: "バルテリー" },
        { name: "ナナゴールデン" }, { name: "ナンギ" },
      ] },
      { name: "ミクロソリウム", pickable: true, varieties: [
        { name: "プテロプス" }, { name: "ナローリーフ" }, { name: "本ナロー" }, { name: "トライデント" },
        { name: "ウェンディロフ" }, { name: "セミナロー" },
      ] },
      { name: "ウィローモス", pickable: true, aliases: ["モス"], varieties: [
        { name: "南米ウィローモス" }, { name: "ウィーピングモス" }, { name: "プレミアムモス" }, { name: "クリスマスモス" },
        { name: "フレイムモス" }, { name: "リシア" },
      ] },
      { name: "クリプトコリネ", pickable: true, varieties: [
        { name: "ウェンティ" }, { name: "ベケッティ" }, { name: "バランサエ" }, { name: "ルテア" },
        { name: "ペッチー" }, { name: "ウェンティグリーン" }, { name: "パルバ" },
      ] },
      { name: "ロタラ", pickable: true, varieties: [
        { name: "ロトンディフォリア" }, { name: "グリーン" }, { name: "ハイグロフィラ赤" }, { name: "インディカ" },
        { name: "ナンセアン" }, { name: "ワリッキー" }, { name: "ベトナム" },
      ] },
      { name: "ブセファランドラ", pickable: true, aliases: ["ブセ"], varieties: [
        { name: "クダガン" }, { name: "クアラクアヤン" }, { name: "ブラウニー" }, { name: "シンタン" },
        { name: "デフォルメ" },
      ] },
      { name: "エキノドルス", pickable: true, aliases: ["アマゾンソード"], varieties: [
        { name: "アマゾンソード" }, { name: "オゼロット" }, { name: "ルビン" }, { name: "テネルス" },
      ] },
      { name: "ハイグロフィラ", pickable: true, varieties: [
        { name: "ポリスペルマ" }, { name: "ピンナティフィダ" }, { name: "ロザエネルビス" }, { name: "ギニア" },
      ] },
      { name: "前景草・その他水草", pickable: false, varieties: [
        { name: "グロッソスティグマ" }, { name: "ニューラージパールグラス" }, { name: "ヘアーグラス" }, { name: "キューバパールグラス" },
        { name: "バリスネリア" }, { name: "ピグミーチェーンサジタリア" }, { name: "マツモ" }, { name: "アナカリス" },
        { name: "ウォータースプライト" }, { name: "ニードルリーフルドウィジア" }, { name: "ブリクサ" }, { name: "ヘテランテラ" },
        { name: "テネルス" }, { name: "ウォーターローン" },
      ] },
    ],
  },
  {
    label: "水生・ビオトープ",
    genera: [
      { name: "スイレン", pickable: true, aliases: ["睡蓮"], varieties: [
        { name: "温帯性スイレン" }, { name: "熱帯性スイレン" }, { name: "姫スイレン" }, { name: "ヒツジグサ" },
      ] },
      { name: "ハス", pickable: true, aliases: ["蓮"], varieties: [
        { name: "茶碗蓮" }, { name: "大賀蓮" }, { name: "舞妃蓮" }, { name: "ミニ蓮" },
      ] },
      { name: "水生植物各種", pickable: false, varieties: [
        { name: "ホテイアオイ" }, { name: "アサザ" }, { name: "ウォーターマッシュルーム" }, { name: "ナガバオモダカ" },
        { name: "オモダカ" }, { name: "ウォーターポピー" }, { name: "ウォーターバコパ" }, { name: "ミズトクサ" },
        { name: "カキツバタ" }, { name: "ガマ" }, { name: "コウホネ" }, { name: "ミズユキノシタ" },
        { name: "デンジソウ" }, { name: "サンショウモ" }, { name: "アマゾンフロッグビット" },
      ] },
    ],
  },
  {
    label: "バラ",
    genera: [
      { name: "バラ", pickable: true, varieties: [
        { name: "ピエールドゥロンサール" }, { name: "ブランピエールドゥロンサール" }, { name: "ルージュピエールドゥロンサール" }, { name: "アイスバーグ" },
        { name: "つるアイスバーグ" }, { name: "クイーンエリザベス" }, { name: "ナエマ" }, { name: "グラハムトーマス" },
        { name: "ジュードジオブスキュア" }, { name: "ボレロ" }, { name: "アブラハムダービー" }, { name: "レディオブシャーロット" },
        { name: "ジュビリーセレブレーション" }, { name: "マンステッドウッド" }, { name: "シェエラザード" }, { name: "オデュッセイア" },
        { name: "アンナプルナ" }, { name: "ラフランス" }, { name: "クロードモネ" }, { name: "ローズポンパドゥール" },
        { name: "ガブリエル" }, { name: "オールドローズ" }, { name: "つるバラ" }, { name: "ミニバラ" },
        { name: "イングリッシュローズ" }, { name: "河本バラ" }, { name: "和ばら" },
      ] },
    ],
  },
  {
    label: "草花",
    genera: [
      { name: "クレマチス", pickable: true, varieties: [
        { name: "モンタナ" }, { name: "モンタナルーベンス" }, { name: "ジャックマニー" }, { name: "テキセンシス" },
        { name: "ヴィチセラ" }, { name: "インテグリフォリア" }, { name: "ニオベ" }, { name: "ドクターラッペル" },
        { name: "篭口" }, { name: "テッセン" }, { name: "アーマンディ" },
      ] },
      { name: "アジサイ", pickable: true, varieties: [
        { name: "アナベル" }, { name: "ダンスパーティー" }, { name: "隅田の花火" }, { name: "墨田の花火" },
        { name: "万華鏡" }, { name: "ハイドランジア" }, { name: "ガクアジサイ" }, { name: "ヤマアジサイ" },
        { name: "カシワバアジサイ" }, { name: "ノリウツギ" },
      ] },
      { name: "ゼラニウム", pickable: true, aliases: ["ペラルゴニウム"], varieties: [
        { name: "パンジーゼラニウム" }, { name: "アイビーゼラニウム" }, { name: "センテッドゼラニウム" }, { name: "ニオイゼラニウム" },
        { name: "八重咲きゼラニウム" },
      ] },
      { name: "原種シクラメン", pickable: true, varieties: [
        { name: "コウム" }, { name: "ヘデリフォリウム" }, { name: "プルプラセンス" }, { name: "ミラビレ" },
        { name: "シリシアム" }, { name: "アルピナム" },
      ] },
      { name: "クリスマスローズ", pickable: true, varieties: [
        { name: "ヘレボルス" }, { name: "ニゲル" }, { name: "ヒブリドゥス" }, { name: "オリエンタリス" },
        { name: "シングル" }, { name: "セミダブル" }, { name: "ダブル" }, { name: "ピコティ" },
        { name: "ダークネクタリー" },
      ] },
      { name: "ヒマワリ", pickable: true, aliases: ["ひまわり", "向日葵", "サンフラワー", "sunflower"], varieties: [
        { name: "サンリッチ" }, { name: "ビンセント" }, { name: "テディベア" }, { name: "東北八重" },
        { name: "モネのひまわり" }, { name: "ゴッホのひまわり" }, { name: "ムーランルージュ" }, { name: "ロシアひまわり" },
      ] },
      { name: "アサガオ", pickable: true, aliases: ["朝顔", "あさがお"], varieties: [
        { name: "団十郎" }, { name: "ヘブンリーブルー" }, { name: "西洋朝顔" }, { name: "曜白朝顔" },
        { name: "変化朝顔" }, { name: "大輪朝顔" },
      ] },
      { name: "コスモス", pickable: true, varieties: [
        { name: "センセーション" }, { name: "イエローキャンパス" }, { name: "シーシェル" }, { name: "ダブルクリック" },
        { name: "キバナコスモス" }, { name: "チョコレートコスモス" },
      ] },
      { name: "ペチュニア", pickable: true, varieties: [
        { name: "サフィニア" }, { name: "サフィニアアート" }, { name: "スーパーチュニア" }, { name: "バカラ" },
        { name: "ナイトスカイ" }, { name: "ブリエッタ" }, { name: "カリブラコア" },
      ] },
      { name: "マリーゴールド", pickable: true, varieties: [
        { name: "フレンチマリーゴールド" }, { name: "アフリカンマリーゴールド" }, { name: "ストロベリーブロンド" }, { name: "ボナンザ" },
      ] },
      { name: "サルビア", pickable: true, aliases: ["セージ"], varieties: [
        { name: "スプレンデンス" }, { name: "ファリナセア" }, { name: "ブルーサルビア" }, { name: "ガラニチカ" },
        { name: "メキシカンセージ" }, { name: "レウカンサ" }, { name: "ネモローサ" },
      ] },
      { name: "ガーベラ", pickable: true, varieties: [
        { name: "ガービー" }, { name: "スパイダー咲き" }, { name: "ミニガーベラ" }, { name: "パスタ" },
      ] },
      { name: "キク", pickable: true, aliases: ["菊", "マム"], varieties: [
        { name: "ポットマム" }, { name: "スプレーマム" }, { name: "ガーデンマム" }, { name: "クッションマム" },
        { name: "古典菊" }, { name: "嵯峨菊" }, { name: "江戸菊" }, { name: "肥後菊" },
        { name: "厚物" }, { name: "管物" }, { name: "イソギク" },
      ] },
      { name: "ナデシコ", pickable: true, aliases: ["ダイアンサス"], varieties: [
        { name: "カワラナデシコ" }, { name: "なでしこ" }, { name: "テルスター" }, { name: "ビジョナデシコ" },
        { name: "アメリカナデシコ" },
      ] },
      { name: "ジニア", pickable: true, aliases: ["百日草", "ヒャクニチソウ"], varieties: [
        { name: "プロフュージョン" }, { name: "ジニアリネアリス" }, { name: "ザハラ" }, { name: "クイーンライム" },
      ] },
      { name: "パンジー", pickable: true, aliases: ["ビオラ"], varieties: [
        { name: "ビオラ" }, { name: "よく咲くスミレ" }, { name: "ヌーヴェルヴァーグ" }, { name: "ムーランフリル" },
        { name: "フリズルシズル" }, { name: "見元ビオラ" }, { name: "ローブドアンティーク" },
      ] },
      { name: "キンセンカ", pickable: true, aliases: ["カレンデュラ"], varieties: [
        { name: "冬知らず" }, { name: "コーヒークリーム" }, { name: "オレンジキング" },
      ] },
      { name: "ケイトウ", pickable: true, aliases: ["セロシア"], varieties: [
        { name: "久留米ケイトウ" }, { name: "ノゲイトウ" }, { name: "羽毛ケイトウ" }, { name: "ヤリゲイトウ" },
      ] },
      { name: "その他人気草花", pickable: false, varieties: [
        { name: "プリムラ" }, { name: "多年草" }, { name: "宿根草" }, { name: "原種チューリップ" },
        { name: "ダリア" }, { name: "花菖蒲" }, { name: "君子蘭" },
      ] },
    ],
  },
  {
    label: "球根",
    genera: [
      { name: "チューリップ", pickable: true, varieties: [
        { name: "アンジェリケ" }, { name: "ブルーダイヤモンド" }, { name: "クイーンオブナイト" }, { name: "アプリコットビューティー" },
        { name: "原種チューリップ" }, { name: "パーロット咲き" }, { name: "フリンジ咲き" }, { name: "ユリ咲き" },
        { name: "八重咲きチューリップ" },
      ] },
      { name: "スイセン", pickable: true, aliases: ["水仙", "ナルシサス"], varieties: [
        { name: "日本水仙" }, { name: "ラッパスイセン" }, { name: "テタテート" }, { name: "ペーパーホワイト" },
        { name: "口紅水仙" }, { name: "八重咲きスイセン" },
      ] },
      { name: "ヒヤシンス", pickable: true, varieties: [
        { name: "デルフトブルー" }, { name: "ピンクパール" }, { name: "ジャンボス" }, { name: "カーネギー" },
        { name: "ローマンヒヤシンス" },
      ] },
      { name: "ユリ", pickable: true, aliases: ["リリー", "百合"], varieties: [
        { name: "カサブランカ" }, { name: "オリエンタルリリー" }, { name: "テッポウユリ" }, { name: "スカシユリ" },
        { name: "ヤマユリ" }, { name: "カノコユリ" }, { name: "オニユリ" }, { name: "LAハイブリッド" },
      ] },
      { name: "クロッカス", pickable: true, varieties: [
        { name: "ジャンヌダルク" }, { name: "クリームビューティー" }, { name: "サフラン" }, { name: "原種クロッカス" },
      ] },
      { name: "アマリリス", pickable: true, aliases: ["ヒッペアストルム"], varieties: [
        { name: "アップルブロッサム" }, { name: "レッドライオン" }, { name: "ダブルドリーム" }, { name: "パピリオ" },
      ] },
      { name: "グラジオラス", pickable: true, varieties: [
        { name: "夏咲きグラジオラス" }, { name: "春咲きグラジオラス" },
      ] },
      { name: "ムスカリ", pickable: true, varieties: [
        { name: "アルメニアカム" }, { name: "ホワイトマジック" }, { name: "ラティフォリウム" }, { name: "オーシャンマジック" },
      ] },
      { name: "その他球根", pickable: false, varieties: [
        { name: "スノードロップ" }, { name: "スノーフレーク" }, { name: "アネモネ" }, { name: "ラナンキュラス" },
        { name: "フリージア" }, { name: "チオノドクサ" }, { name: "イフェイオン" }, { name: "ハナニラ" },
        { name: "アリウム" }, { name: "コルチカム" }, { name: "ネリネ" }, { name: "ダッチアイリス" },
      ] },
    ],
  },
  {
    label: "花木・庭木",
    genera: [
      { name: "ツツジ", pickable: true, aliases: ["躑躅"], varieties: [
        { name: "クルメツツジ" }, { name: "ヒラドツツジ" }, { name: "オオムラサキ" }, { name: "ミツバツツジ" },
        { name: "ヤマツツジ" }, { name: "レンゲツツジ" }, { name: "シャクナゲ" },
      ] },
      { name: "サツキ", pickable: true, aliases: ["皐月"], varieties: [
        { name: "大盃" }, { name: "日光" }, { name: "鹿沼" }, { name: "暁天" },
        { name: "晃山" },
      ] },
      { name: "ツバキ", pickable: true, aliases: ["椿", "カメリア"], varieties: [
        { name: "侘助" }, { name: "乙女椿" }, { name: "数寄屋侘助" }, { name: "卜伴" },
        { name: "玉之浦" }, { name: "ヤブツバキ" }, { name: "肥後椿" },
      ] },
      { name: "サザンカ", pickable: true, aliases: ["山茶花"], varieties: [
        { name: "朝倉" }, { name: "勘次郎" }, { name: "富士の峰" }, { name: "獅子頭" },
      ] },
      { name: "アジサイ以外の花木", pickable: false, varieties: [
        { name: "キンモクセイ", aliases: ["金木犀"] }, { name: "ギンモクセイ", aliases: ["銀木犀"] }, { name: "ジンチョウゲ", aliases: ["沈丁花"] }, { name: "クチナシ" },
        { name: "ハナミズキ" }, { name: "ヤマボウシ" }, { name: "モクレン" }, { name: "コブシ" },
        { name: "サルスベリ", aliases: ["百日紅"] }, { name: "ライラック" }, { name: "ユキヤナギ" }, { name: "レンギョウ" },
        { name: "ボケ" }, { name: "コデマリ" }, { name: "ナンテン", aliases: ["南天"] }, { name: "センリョウ" },
        { name: "マンリョウ" }, { name: "ムクゲ" }, { name: "フヨウ" }, { name: "キョウチクトウ" },
      ] },
      { name: "モミジ", pickable: true, aliases: ["紅葉", "カエデ", "もみじ"], varieties: [
        { name: "イロハモミジ" }, { name: "ヤマモミジ" }, { name: "出猩々" }, { name: "野村もみじ" },
        { name: "獅子頭" }, { name: "青枝垂れ" }, { name: "デショウジョウ" }, { name: "トウカエデ" },
      ] },
      { name: "ウメ", pickable: true, aliases: ["梅"], varieties: [
        { name: "南高" }, { name: "白加賀" }, { name: "豊後" }, { name: "鶯宿" },
        { name: "枝垂れ梅" }, { name: "思いのまま" }, { name: "長寿梅" },
      ] },
      { name: "サクラ", pickable: true, aliases: ["桜"], varieties: [
        { name: "ソメイヨシノ" }, { name: "枝垂れ桜" }, { name: "八重桜" }, { name: "河津桜" },
        { name: "陽光" }, { name: "旭山桜" }, { name: "富士桜" }, { name: "ヤマザクラ" },
      ] },
    ],
  },
  {
    label: "野菜",
    genera: [
      { name: "トマト", pickable: true, varieties: [
        { name: "桃太郎" }, { name: "ホーム桃太郎" }, { name: "麗夏" }, { name: "りんか409" },
        { name: "大玉トマト" }, { name: "フルティカ" }, { name: "レッドオーレ" }, { name: "中玉トマト" },
        { name: "シシリアンルージュ" }, { name: "アイコ" }, { name: "イエローアイコ" }, { name: "オレンジアイコ" },
        { name: "千果" }, { name: "ステラミニトマト" }, { name: "ミニトマト" }, { name: "サンマルツァーノ" },
        { name: "ピンキー" }, { name: "プチぷよ" }, { name: "トマトベリー" }, { name: "純あま" },
      ] },
      { name: "ナス", pickable: true, varieties: [
        { name: "千両" }, { name: "千両二号" }, { name: "庄屋大長" }, { name: "賀茂なす" },
        { name: "水なす" }, { name: "米なす" }, { name: "白なす" }, { name: "ヴィオレッタ" },
        { name: "筑陽" }, { name: "中長なす" }, { name: "仙台長なす" }, { name: "翡翠なす" },
        { name: "丸なす" },
      ] },
      { name: "きゅうり", pickable: true, varieties: [
        { name: "夏すずみ" }, { name: "四葉" }, { name: "スーヨー" }, { name: "Vロード" },
        { name: "北進" }, { name: "ときわ" }, { name: "加賀太きゅうり" }, { name: "地這きゅうり" },
        { name: "ラリーノ" },
      ] },
      { name: "ピーマン・唐辛子", pickable: false, varieties: [
        { name: "京みどり" }, { name: "こどもピーマン" }, { name: "ピー太郎" }, { name: "甘とう美人" },
        { name: "パプリカ" }, { name: "万願寺とうがらし" }, { name: "伏見甘長" }, { name: "ししとう" },
        { name: "鷹の爪" }, { name: "ハバネロ" }, { name: "ブートジョロキア" },
      ] },
      { name: "枝豆", pickable: true, varieties: [
        { name: "湯あがり娘" }, { name: "快豆黒頭巾" }, { name: "だだちゃ豆" }, { name: "黒豆" },
        { name: "丹波黒" }, { name: "茶豆" }, { name: "秘伝" }, { name: "サヤムスメ" },
        { name: "くろさき茶豆" },
      ] },
      { name: "とうもろこし", pickable: true, varieties: [
        { name: "ゴールドラッシュ" }, { name: "味来" }, { name: "ピュアホワイト" }, { name: "ハニーバンタム" },
        { name: "恵味" }, { name: "ドルチェドリーム" }, { name: "甘々娘" }, { name: "おおもの" },
        { name: "ピーターコーン" }, { name: "ミルキースイーツ" },
      ] },
      { name: "かぼちゃ", pickable: true, varieties: [
        { name: "坊っちゃん" }, { name: "バターナッツ" }, { name: "雪化粧" }, { name: "えびす" },
        { name: "ロロン" }, { name: "栗マロン" }, { name: "みやこ" }, { name: "九重栗" },
        { name: "コリンキー" }, { name: "打木赤皮甘栗" }, { name: "宿儺かぼちゃ" }, { name: "金糸瓜" },
        { name: "万次郎かぼちゃ" }, { name: "プッチーニ" },
      ] },
      { name: "さつまいも", pickable: true, varieties: [
        { name: "紅はるか" }, { name: "シルクスイート" }, { name: "安納芋" }, { name: "鳴門金時" },
        { name: "紅あずま" }, { name: "高系14号" }, { name: "五郎島金時" }, { name: "クイックスイート" },
        { name: "パープルスイートロード" }, { name: "紅天使" }, { name: "甘太くん" },
      ] },
      { name: "じゃがいも", pickable: true, varieties: [
        { name: "キタアカリ" }, { name: "男爵" }, { name: "メークイン" }, { name: "インカのめざめ" },
        { name: "アンデスレッド" }, { name: "デストロイヤー" }, { name: "グラウンドペチカ" }, { name: "とうや" },
        { name: "ノーザンルビー" }, { name: "シャドークイーン" }, { name: "きたかむい" }, { name: "レッドムーン" },
      ] },
      { name: "いちご", pickable: true, varieties: [
        { name: "章姫" }, { name: "紅ほっぺ" }, { name: "とちおとめ" }, { name: "あまおう" },
        { name: "よつぼし" }, { name: "宝交早生" }, { name: "さがほのか" }, { name: "ゆうべに" },
        { name: "桃薫" }, { name: "女峰" }, { name: "淡雪" }, { name: "越後姫" },
        { name: "やよいひめ" }, { name: "スカイベリー" }, { name: "かおり野" }, { name: "とちあいか" },
        { name: "古都華" }, { name: "あまりん" }, { name: "いちごさん" }, { name: "四季なりイチゴ" },
      ] },
      { name: "オクラ", pickable: true, varieties: [
        { name: "アーリーファイブ" }, { name: "グリーンソード" }, { name: "ヘルシエ" }, { name: "まるみちゃん" },
        { name: "ダビデの星" }, { name: "平城グリーン" }, { name: "丸オクラ" }, { name: "島オクラ" },
        { name: "八丈オクラ" }, { name: "ミニオクラ" }, { name: "赤オクラ" }, { name: "白オクラ" },
        { name: "花オクラ" },
      ] },
      { name: "ズッキーニ", pickable: true, varieties: [
        { name: "ダイナー" }, { name: "ブラックトスカ" }, { name: "グリーンボート2号" }, { name: "ゼルダネロ" },
        { name: "オーラム" }, { name: "イエローボート" }, { name: "グリーンエッグ" }, { name: "UFOズッキーニ" },
        { name: "カスタードホワイト" }, { name: "パティパン" },
      ] },
      { name: "ゴーヤ", pickable: true, varieties: [
        { name: "あばしゴーヤ" }, { name: "純白ゴーヤ" }, { name: "白ゴーヤ" }, { name: "願寿ゴーヤ" },
        { name: "中長ゴーヤ" }, { name: "さつま大長れいし" }, { name: "汐風" }, { name: "島さんご" },
        { name: "節成ゴーヤ" },
      ] },
      { name: "大根", pickable: true, varieties: [
        { name: "青首大根" }, { name: "耐病総太り" }, { name: "宮重大根" }, { name: "三浦大根" },
        { name: "聖護院大根" }, { name: "桜島大根" }, { name: "守口大根" }, { name: "源助大根" },
        { name: "紅芯大根" }, { name: "紅くるり大根" }, { name: "ビタミン大根" }, { name: "ねずみ大根" },
        { name: "黒大根" }, { name: "辛味大根" }, { name: "二十日大根" }, { name: "ラディッシュ" },
      ] },
      { name: "人参", pickable: true, varieties: [
        { name: "向陽二号" }, { name: "ベーターリッチ" }, { name: "黒田五寸" }, { name: "ひとみ五寸" },
        { name: "五寸人参" }, { name: "京くれない" }, { name: "金時人参" }, { name: "島人参" },
        { name: "アロマレッド" }, { name: "彩誉" }, { name: "国分鮮紅大長" }, { name: "パープルヘイズ" },
        { name: "紫人参" }, { name: "黒人参" }, { name: "スノースティック" }, { name: "金美人参" },
      ] },
      { name: "玉ねぎ", pickable: true, varieties: [
        { name: "泉州黄" }, { name: "猩々赤" }, { name: "ソニック" }, { name: "ネオアース" },
        { name: "もみじ3号" }, { name: "ケルたま" }, { name: "札幌黄" }, { name: "湘南レッド" },
        { name: "赤玉ねぎ" }, { name: "サラダ玉ねぎ" }, { name: "ペコロス" },
      ] },
      { name: "白菜", pickable: true, varieties: [
        { name: "黄ごころ85" }, { name: "黄芯白菜" }, { name: "オレンジクイン" }, { name: "京都三号" },
        { name: "無双" }, { name: "冬月90" }, { name: "娃々菜" }, { name: "ミニ白菜" },
      ] },
      { name: "キャベツ", pickable: true, varieties: [
        { name: "金系201号" }, { name: "YR春空" }, { name: "四季穫" }, { name: "初秋" },
        { name: "新藍" }, { name: "富士早生" }, { name: "札幌大球" }, { name: "グリーンボール" },
        { name: "サボイキャベツ" }, { name: "紫キャベツ" }, { name: "みさき" },
      ] },
      { name: "ブロッコリー", pickable: true, varieties: [
        { name: "緑嶺" }, { name: "ピクセル" }, { name: "スティックセニョール" }, { name: "茎ブロッコリー" },
        { name: "おはよう" }, { name: "ハイツSP" }, { name: "ドシコ" }, { name: "夢ひびき" },
      ] },
      { name: "カリフラワー", pickable: true, varieties: [
        { name: "スノークラウン" }, { name: "オレンジ美星" }, { name: "パープルフラワー" }, { name: "紫カリフラワー" },
        { name: "バイオレットクイン" },
      ] },
      { name: "ロマネスコ", pickable: true, varieties: [
        { name: "うずまき" }, { name: "ダ・ヴィンチ" }, { name: "ミナレット" }, { name: "カリッコリー" },
        { name: "サンゴショウ" },
      ] },
      { name: "葉物・その他", pickable: false, varieties: [
        { name: "ほうれん草" }, { name: "サラダほうれん草" }, { name: "ちぢみほうれん草" }, { name: "次郎丸ほうれん草" },
        { name: "小松菜" }, { name: "レタス" }, { name: "サニーレタス" }, { name: "サンチュ" },
        { name: "ロメインレタス" }, { name: "リーフレタス" }, { name: "フリルレタス" }, { name: "玉レタス" },
        { name: "サラダ菜" }, { name: "グリーンカール" }, { name: "春菊" }, { name: "水菜" },
        { name: "ルッコラ" }, { name: "パクチー" }, { name: "コリアンダー" }, { name: "大葉" },
        { name: "青じそ" }, { name: "赤じそ" }, { name: "ケール" }, { name: "カーボロネロ" },
        { name: "カリーノケール" }, { name: "スイスチャード" }, { name: "ふだん草" },
      ] },
      { name: "豆類・その他", pickable: false, varieties: [
        { name: "そら豆" }, { name: "一寸そら豆" }, { name: "スナップエンドウ" }, { name: "さやいんげん" },
        { name: "つるありインゲン" }, { name: "モロッコいんげん" }, { name: "ケンタッキーワンダー" }, { name: "落花生" },
        { name: "おおまさり" }, { name: "千葉半立" }, { name: "さといも" }, { name: "里芋" },
        { name: "土垂" }, { name: "石川早生" }, { name: "セレベス" }, { name: "八つ頭" },
        { name: "海老芋" }, { name: "ニンニク" }, { name: "ホワイト六片" }, { name: "ジャンボニンニク" },
        { name: "食用ほおずき" }, { name: "ストロベリートマト" },
      ] },
    ],
  },
  {
    label: "ハーブ",
    genera: [
      { name: "バジル", pickable: true, varieties: [
        { name: "スイートバジル" }, { name: "ホーリーバジル" }, { name: "レモンバジル" }, { name: "ジェノベーゼ" },
        { name: "ダークオパール" }, { name: "ブッシュバジル" }, { name: "シナモンバジル" },
      ] },
      { name: "ミント", pickable: true, varieties: [
        { name: "スペアミント" }, { name: "ペパーミント" }, { name: "アップルミント" }, { name: "パイナップルミント" },
        { name: "モロッカンミント" }, { name: "オーデコロンミント" }, { name: "ブラックペパーミント" },
      ] },
      { name: "ローズマリー", pickable: true, varieties: [
        { name: "立性ローズマリー" }, { name: "匍匐性ローズマリー" }, { name: "トスカナブルー" }, { name: "マリンブルー" },
        { name: "モーツァルトブルー" }, { name: "プロストラータス" },
      ] },
      { name: "タイム", pickable: true, varieties: [
        { name: "コモンタイム" }, { name: "レモンタイム" }, { name: "クリーピングタイム" }, { name: "シルバータイム" },
      ] },
      { name: "セージ", pickable: true, varieties: [
        { name: "コモンセージ" }, { name: "パイナップルセージ" }, { name: "チェリーセージ" }, { name: "ホワイトセージ" },
        { name: "ゴールデンセージ" }, { name: "パープルセージ" },
      ] },
      { name: "ラベンダー", pickable: true, varieties: [
        { name: "イングリッシュラベンダー" }, { name: "フレンチラベンダー" }, { name: "グロッソ" }, { name: "ラバンディン" },
        { name: "デンタータ" }, { name: "ストエカス" },
      ] },
      { name: "カモミール", pickable: true, varieties: [
        { name: "ジャーマンカモミール" }, { name: "ローマンカモミール" },
      ] },
      { name: "オレガノ", pickable: true, varieties: [
        { name: "ケントビューティー" }, { name: "コモンオレガノ" }, { name: "ゴールデンオレガノ" }, { name: "マジョラム" },
      ] },
      { name: "パセリ", pickable: true, varieties: [
        { name: "イタリアンパセリ" }, { name: "カーリーパセリ" }, { name: "モスカールドパセリ" },
      ] },
      { name: "シソ", pickable: true, aliases: ["大葉", "紫蘇"], varieties: [
        { name: "青じそ" }, { name: "赤じそ" }, { name: "ちりめんじそ" }, { name: "穂じそ" },
      ] },
      { name: "パクチー", pickable: true, aliases: ["コリアンダー", "香菜", "シャンツァイ"], varieties: [
        { name: "コリアンダー" }, { name: "サイゴンパクチー" },
      ] },
      { name: "その他ハーブ", pickable: false, varieties: [
        { name: "レモングラス" }, { name: "レモンバーム" }, { name: "ディル" }, { name: "チャイブ" },
        { name: "タラゴン" }, { name: "フェンネル" }, { name: "チャービル" }, { name: "ルッコラ" },
        { name: "ステビア" }, { name: "ナスタチウム" }, { name: "ボリジ" }, { name: "ヒソップ" },
        { name: "コモンマロウ" }, { name: "キャットニップ" }, { name: "ワイルドストロベリー" },
      ] },
    ],
  },
  {
    label: "果樹",
    genera: [
      { name: "ブルーベリー", pickable: true, varieties: [
        { name: "ティフブルー" }, { name: "ホームベル" }, { name: "ブライトウェル" }, { name: "パウダーブルー" },
        { name: "オンスロー" }, { name: "クライマックス" }, { name: "ウッダード" }, { name: "チャンドラー" },
        { name: "ブルークロップ" }, { name: "スパルタン" }, { name: "オニール" }, { name: "サンシャインブルー" },
        { name: "ピンクレモネード" }, { name: "ブリジッタ" }, { name: "ブリギッタ" }, { name: "デューク" },
        { name: "レガシー" }, { name: "リバティ" }, { name: "サザンハイブッシュ" }, { name: "ラビットアイ" },
        { name: "ハイブッシュ" },
      ] },
      { name: "イチジク", pickable: true, varieties: [
        { name: "ドーフィン" }, { name: "桝井ドーフィン" }, { name: "ホワイトゼノア" }, { name: "ビオレソリエス" },
        { name: "ロングドゥート" }, { name: "バナーネ" }, { name: "ザ・キング" }, { name: "ブラウンターキー" },
        { name: "ヌアールドカロン" }, { name: "セレステ" }, { name: "ダルマティ" }, { name: "ホワイトイスキア" },
        { name: "とよみつひめ" }, { name: "蓬莱柿" },
      ] },
      { name: "柑橘", pickable: true, varieties: [
        { name: "レモン" }, { name: "リスボン" }, { name: "マイヤー" }, { name: "ユーレカ" },
        { name: "温州みかん" }, { name: "デコポン" }, { name: "不知火" }, { name: "金柑" },
        { name: "ライム" }, { name: "タヒチライム" }, { name: "すだち" }, { name: "かぼす" },
        { name: "ゆず" }, { name: "八朔" }, { name: "甘夏" }, { name: "ブラッドオレンジ" },
        { name: "タロッコ" }, { name: "河内晩柑" }, { name: "フィンガーライム" }, { name: "せとか" },
        { name: "清見" }, { name: "はるみ" }, { name: "日向夏" },
      ] },
      { name: "ぶどう", pickable: true, varieties: [
        { name: "シャインマスカット" }, { name: "巨峰" }, { name: "ピオーネ" }, { name: "デラウェア" },
        { name: "ナガノパープル" }, { name: "マスカットベーリーA" }, { name: "ベリーA" }, { name: "クイーンニーナ" },
        { name: "藤稔" }, { name: "安芸クイーン" }, { name: "サニードルチェ" },
      ] },
      { name: "柿", pickable: true, varieties: [
        { name: "富有" }, { name: "次郎" }, { name: "太秋" }, { name: "早秋" },
        { name: "西村早生" }, { name: "蜂屋" }, { name: "平核無" }, { name: "甘百目" },
        { name: "松本早生富有" },
      ] },
      { name: "りんご", pickable: true, varieties: [
        { name: "ふじ" }, { name: "姫りんご" }, { name: "アルプス乙女" }, { name: "つがる" },
        { name: "王林" }, { name: "シナノゴールド" }, { name: "ジョナゴールド" },
      ] },
      { name: "桃・さくらんぼ・梅・すもも", pickable: false, varieties: [
        { name: "桃" }, { name: "佐藤錦" }, { name: "紅秀峰" }, { name: "高砂" },
        { name: "ナポレオン" }, { name: "紅さやか" }, { name: "南高梅" }, { name: "白加賀" },
        { name: "豊後" }, { name: "小梅" }, { name: "古城" }, { name: "鶯宿" },
        { name: "ソルダム" }, { name: "大石早生" }, { name: "太陽" }, { name: "サンタローザ" },
        { name: "プラム" },
      ] },
      { name: "キウイ", pickable: true, varieties: [
        { name: "ヘイワード" }, { name: "紅妃" }, { name: "香緑" }, { name: "アップルキウイ" },
        { name: "ゴールデンキウイ" }, { name: "ゴールドキウイ" },
      ] },
      { name: "オリーブ", pickable: true, varieties: [
        { name: "ミッション" }, { name: "ネバディロブランコ" }, { name: "ルッカ" }, { name: "アルベキナ" },
        { name: "フラントイオ" }, { name: "コロネイキ" }, { name: "マンザニロ" }, { name: "シプレッシーノ" },
        { name: "ピクアル" },
      ] },
      { name: "その他果樹", pickable: false, varieties: [
        { name: "茂木" }, { name: "田中" }, { name: "長崎早生", aliases: ["びわ"] }, { name: "丹波栗" },
        { name: "利平" }, { name: "クーリッジ", aliases: ["フェイジョア"] }, { name: "アーウィン", aliases: ["マンゴー"] }, { name: "ベーコン", aliases: ["アボカド"] },
        { name: "ハス", aliases: ["アボカド"] }, { name: "ズタノ", aliases: ["アボカド"] }, { name: "ラズベリー" }, { name: "ブラックベリー" },
        { name: "ザクロ" }, { name: "ジューンベリー" }, { name: "ポポー" }, { name: "アケビ" },
        { name: "パッションフルーツ" }, { name: "グミ" }, { name: "カシス" }, { name: "グーズベリー" },
        { name: "クランベリー" }, { name: "桑" }, { name: "マルベリー" }, { name: "パイナップル" },
      ] },
    ],
  },
];

