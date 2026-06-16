// 品種タグ辞書（カテゴリ→属→品種・1,416件 / 120属 / 12カテゴリ・#143）。
//
// 趣味家の通称表記を Web 調査で裏取りした参照データ（読み取り専用・キュレーション済み）。
// hanoba はバックエンドレス（DESIGN §6）なので DB は持たず、これは不変の `Def` データ。
// **TagPicker（#144）が開いた時に動的 import で code-split** されるよう、ここはデータ専用にする
// （静的 import で初期 composer バンドルに載せない）。検索/ドリルダウンは全てクライアントで回る。
//
// 値は「本文 # に入るタグ文字列」（空白は insertTag 側で _ に正規化）。表記揺れ（赤猫 ↔
// レッドキャットウィーズル 等）は調査が両形を別品種として持つため、そのまま両方を pickable に残す
// （趣味家は同じ品種を複数表記でタグするため・#143 メモ1）。

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
    label: "多肉・塊根",
    genera: [
      { name: "アガベ", pickable: true, varieties: [
        { name: "チタノタ" }, { name: "オテロイ" }, { name: "白鯨" }, { name: "黒鯨" },
        { name: "福建白鯨" }, { name: "大白鯊" }, { name: "金鯨" }, { name: "白犀牛" },
        { name: "海王" }, { name: "レッドキャットウィーズル" }, { name: "赤猫" }, { name: "ゴリ猫" },
        { name: "地獄猫" }, { name: "姫厳竜" }, { name: "シーザー" }, { name: "凱撒" },
        { name: "フィリグリー" }, { name: "圓葉拇指" }, { name: "ハデス" }, { name: "黒帝斯" },
        { name: "恐竜牙歯" }, { name: "ブラックアンドブルー" }, { name: "BB" }, { name: "白火焔" },
        { name: "ホワイトファイヤー" }, { name: "黒火焔" }, { name: "ブラックファイヤー" }, { name: "スナグルトゥース" },
        { name: "烈焔" }, { name: "ナンバーワン" }, { name: "農大No.1" }, { name: "狂刺夕映" },
        { name: "金剛" }, { name: "キングコング" }, { name: "魔丸" }, { name: "螃蟹" },
        { name: "追星" }, { name: "COK" }, { name: "清櫻" }, { name: "セオ" },
        { name: "皇冠" }, { name: "クラウン" }, { name: "SAD" }, { name: "南アフリカダイヤモンド" },
        { name: "狼人" }, { name: "覇王龍" }, { name: "鳳凰" }, { name: "黒豹" },
        { name: "鬼爪" }, { name: "雪峰" }, { name: "柊月" }, { name: "悪魔くん" },
        { name: "麻花龍" }, { name: "シャークソーイ" }, { name: "FO-076" }, { name: "笹の雪" },
        { name: "ビクトリアレジーナ" }, { name: "吉祥天" }, { name: "パリー" }, { name: "吉祥冠" },
        { name: "雷神" }, { name: "王妃雷神" }, { name: "五色万代" }, { name: "滝の白糸" },
        { name: "乱れ雪" }, { name: "吹上" }, { name: "ストリクタ" }, { name: "アテナータ" },
        { name: "アメリカーナ" }, { name: "オバティフォリア" }, { name: "パラサナ" }, { name: "モンタナ" },
      ] },
      { name: "パキポディウム", pickable: true, varieties: [
        { name: "グラキリス" }, { name: "象牙宮" }, { name: "恵比寿笑い" }, { name: "ブレビカウレ" },
        { name: "恵比寿大黒" }, { name: "デンシフローラム" }, { name: "ウィンゾリー" }, { name: "ラメリー" },
        { name: "ゲアイー" }, { name: "ロスラーツム" }, { name: "カクチペス" }, { name: "レウコキサンツム" },
        { name: "エブルネウム" }, { name: "ホロンベンセ" }, { name: "イノピナツム" }, { name: "マカイエンセ" },
        { name: "ラモスム" }, { name: "フィヘレネンセ" }, { name: "デカリー" }, { name: "ルーテンベルギアヌム" },
        { name: "アンボンゲンセ" }, { name: "バロニー" }, { name: "サンデルシー" }, { name: "白馬城" },
        { name: "ビスピノーサム" }, { name: "サキュレンタム" }, { name: "ナマクアナム" }, { name: "光堂" },
        { name: "リーアリー" },
      ] },
      { name: "ユーフォルビア", pickable: true, varieties: [
        { name: "オベサ" }, { name: "バリダ" }, { name: "鉄甲丸" }, { name: "ホリダ" },
        { name: "ラクテア" }, { name: "ホワイトゴースト" }, { name: "マハラジャ" }, { name: "白樺キリン" },
        { name: "瑠璃晃" }, { name: "スザンナエ" }, { name: "笹蟹丸" }, { name: "ステラータ" },
        { name: "飛竜" }, { name: "ギラウミニアナ" }, { name: "ポイゾニー" }, { name: "デカリー" },
        { name: "峨眉山" }, { name: "グロボーサ" }, { name: "玉鱗宝" }, { name: "ソテツキリン" },
        { name: "蓬莱島" }, { name: "奇怪ヶ島" }, { name: "鬼笑い" }, { name: "エクロニー" },
        { name: "スクアローサ" }, { name: "デシデュア" }, { name: "トゥレアレンシス" }, { name: "ブルアナ" },
        { name: "ダイヤモンドフロスト" },
      ] },
      { name: "アデニウム", pickable: true, varieties: [
        { name: "砂漠のバラ" }, { name: "オベスム" }, { name: "アラビカム" }, { name: "ソコトラナム" },
        { name: "ソマレンセ" },
      ] },
      { name: "オペルクリカリア", pickable: true, varieties: [
        { name: "パキプス" }, { name: "デカリー" },
      ] },
      { name: "ディオスコレア", pickable: true, varieties: [
        { name: "亀甲竜" }, { name: "アフリカ亀甲竜" }, { name: "エレファンティペス" },
      ] },
      { name: "ステファニア", pickable: true, varieties: [
        { name: "エレクタ" }, { name: "ピエレイ" }, { name: "スベローサ" },
      ] },
      { name: "アデニア", pickable: true, varieties: [
        { name: "グラウカ" }, { name: "グロボーサ" }, { name: "スピノーサ" },
      ] },
      { name: "ドルステニア", pickable: true, varieties: [
        { name: "ギガス" }, { name: "フォエチダ" },
      ] },
      { name: "ボスウェリア", pickable: true, varieties: [
        { name: "サクラ" }, { name: "ネアリー" },
      ] },
      { name: "ブルセラ", pickable: true, varieties: [
        { name: "ファガロイデス" }, { name: "ミクロフィラ" },
      ] },
      { name: "フォークイエリア", pickable: true, varieties: [
        { name: "ファシクラータ" }, { name: "コルムナリス" }, { name: "ディグエッティ" }, { name: "プルプシー" },
      ] },
      { name: "ペラルゴニウム", pickable: true, aliases: ["塊根"], varieties: [
        { name: "アペンディクラツム" }, { name: "ミラビレ" }, { name: "カルノーサム" },
      ] },
      { name: "その他塊根", pickable: false, varieties: [
        { name: "フォッケア" }, { name: "火星人" }, { name: "モンソニア" }, { name: "サルコカウロン" },
        { name: "オトンナ" }, { name: "キフォステンマ" }, { name: "フィカス ペティオラリス" }, { name: "ブーファン" },
        { name: "ウンカリーナ" }, { name: "パキコルムス" }, { name: "ゲラルダンサス" }, { name: "ヤトロファ" },
        { name: "センナ メリディオナリス" }, { name: "サンセベリア" }, { name: "スタッキー" },
      ] },
      { name: "チレコドン", pickable: true, varieties: [
        { name: "万物想" }, { name: "阿房宮" }, { name: "奇峰錦" }, { name: "砂夜叉姫" },
        { name: "レティキュラータス" }, { name: "パニクラーツス" },
      ] },
      { name: "コチレドン", pickable: true, varieties: [
        { name: "熊童子" }, { name: "熊童子錦" }, { name: "子猫の爪" }, { name: "福娘" },
        { name: "だるま福娘" }, { name: "ふっくら娘" }, { name: "銀波錦" }, { name: "ペンデンス" },
        { name: "オルビキュラータ" }, { name: "エリサエ" }, { name: "白美人" }, { name: "パピラリス" },
        { name: "旭波の光" }, { name: "旭波錦" }, { name: "嫁入り娘" }, { name: "紅覆輪" },
      ] },
      { name: "セネシオ", pickable: true, varieties: [
        { name: "グリーンネックレス" }, { name: "ドルフィンネックレス" }, { name: "ピーチネックレス" }, { name: "ルビーネックレス" },
        { name: "三日月ネックレス" }, { name: "七宝樹" }, { name: "万宝" }, { name: "美空鉾" },
        { name: "銀月" }, { name: "京童子" }, { name: "マサイの矢尻" }, { name: "新月" },
        { name: "鉄錫杖" }, { name: "ヤコブセニー" }, { name: "エンジェルティアーズ" }, { name: "ハリアヌス" },
      ] },
      { name: "クラッスラ", pickable: true, varieties: [
        { name: "火祭り" }, { name: "銀盃" }, { name: "神刀" }, { name: "茜の塔" },
        { name: "星の王子" }, { name: "桜星" }, { name: "紅稚児" }, { name: "若緑" },
        { name: "数珠星" }, { name: "南十字星" }, { name: "ゴーラム" }, { name: "宇宙の木" },
        { name: "リトルミッシー" }, { name: "マネーメーカー" }, { name: "玉椿" }, { name: "呂千絵" },
        { name: "舞乙女" }, { name: "緑塔" }, { name: "ブロウメアナ" }, { name: "ムスコーサ" },
      ] },
      { name: "カランコエ", pickable: true, varieties: [
        { name: "月兎耳" }, { name: "福兎耳" }, { name: "黒兎耳" }, { name: "唐印" },
        { name: "デザートローズ" }, { name: "仙女の舞" }, { name: "胡蝶の舞" }, { name: "白銀の舞" },
        { name: "不死鳥" }, { name: "子宝草" }, { name: "朱蓮" }, { name: "ミロッティー" },
        { name: "チョコレートソルジャー" }, { name: "ベハレンシス" }, { name: "ファング" },
      ] },
      { name: "アロエ", pickable: true, varieties: [
        { name: "ディコトマ" }, { name: "ポリフィラ" }, { name: "不夜城" }, { name: "千代田錦" },
        { name: "ハオルチオイデス" }, { name: "キダチアロエ" }, { name: "羅紋錦" }, { name: "鬼ヒトデ" },
        { name: "プリカティリス" }, { name: "アロエベラ" }, { name: "ペグレラエ" }, { name: "綾錦" },
        { name: "帝王錦" },
      ] },
      { name: "ガステリア", pickable: true, varieties: [
        { name: "臥牛" }, { name: "グロメラータ" }, { name: "バイリシアナ" }, { name: "子宝錦" },
      ] },
      { name: "ハオルチア", pickable: true, varieties: [
        { name: "オブツーサ" }, { name: "ブラックオブツーサ" }, { name: "雫石" }, { name: "レツーサ" },
        { name: "コレクタ" }, { name: "京の舞" }, { name: "玉扇" }, { name: "万象" },
        { name: "寿" }, { name: "ピクタ" }, { name: "スプレンデンス" }, { name: "クーペリー" },
        { name: "ベヌスタ" }, { name: "ムチカ" }, { name: "十二の巻" }, { name: "竜鱗" },
        { name: "宝草" },
      ] },
    ],
  },
  {
    label: "エケベリア・メセン",
    genera: [
      { name: "エケベリア", pickable: true, varieties: [
        { name: "ラウイ" }, { name: "七福神" }, { name: "桃太郎" }, { name: "パールフォンニュルンベルク" },
        { name: "高砂の翁" }, { name: "ピンクザラゴーサ" }, { name: "ザラゴーサ" }, { name: "アガボイデス" },
        { name: "リップスティック" }, { name: "静夜" }, { name: "花うらら" }, { name: "ローラ" },
        { name: "デレッセーナ" }, { name: "アフターグロー" }, { name: "トップシータービー" }, { name: "沙羅姫牡丹" },
        { name: "白鳳" }, { name: "エレガンス" }, { name: "シャビアナ" }, { name: "リラシナ" },
        { name: "ロメオ" }, { name: "ロメオルビン" }, { name: "ラウリンゼ" }, { name: "ハムシー" },
        { name: "チワワエンシス" }, { name: "モンロー" }, { name: "ブルードラゴン" }, { name: "スノーフェイス" },
        { name: "アイスローズ" }, { name: "オンスロー" }, { name: "コロラータ" }, { name: "パープルクイーン" },
        { name: "アイスバーグ" }, { name: "ルブラ" }, { name: "レモンローズ" }, { name: "水蜜桃" },
        { name: "スポテッドディア" }, { name: "クリスマス" }, { name: "エボニー" }, { name: "ザラゴーサノヴァ" },
        { name: "メキシカンジャイアント" },
      ] },
      { name: "グラプトペタルム", pickable: true, varieties: [
        { name: "朧月" }, { name: "姫秋麗" }, { name: "ブロンズ姫" }, { name: "銀天女" },
        { name: "秋麗" }, { name: "ダルマ秋麗" }, { name: "パラグアイエンセ" }, { name: "淡雪" },
      ] },
      { name: "セダム", pickable: true, varieties: [
        { name: "虹の玉" }, { name: "オーロラ" }, { name: "乙女心" }, { name: "玉つづり" },
        { name: "銘月" }, { name: "黄麗" }, { name: "春萌" }, { name: "万年草" },
        { name: "レッドベリー" }, { name: "アトランティス" }, { name: "リトルミッシー" }, { name: "パープルヘイズ" },
        { name: "新玉つづり" }, { name: "ヒスパニクム" },
      ] },
      { name: "パキフィツム", pickable: true, varieties: [
        { name: "桃美人" }, { name: "星美人" }, { name: "月美人" }, { name: "群雀" },
        { name: "ベビーフィンガー" }, { name: "千代田の松" }, { name: "京美人" }, { name: "フーケリー" },
      ] },
      { name: "コノフィツム", pickable: true, varieties: [
        { name: "ウィッテベルゲンセ" }, { name: "ブルゲリ" }, { name: "オペラローズ" }, { name: "花園" },
        { name: "ペルシダム" }, { name: "玉彦" }, { name: "マウガニー" }, { name: "群碧玉" },
        { name: "寂光" }, { name: "円空玉" },
      ] },
      { name: "リトープス", pickable: true, varieties: [
        { name: "日輪玉" }, { name: "福来玉" }, { name: "紫勲" }, { name: "大津絵" },
        { name: "オリーブ玉" }, { name: "麗虹玉" }, { name: "招福玉" }, { name: "富貴玉" },
        { name: "紅大内玉" }, { name: "巴里玉" }, { name: "花紋玉" }, { name: "李夫人" },
      ] },
      { name: "フェネストラリア", pickable: true, varieties: [
        { name: "五十鈴玉" }, { name: "群玉" },
      ] },
      { name: "プレイオスピロス", pickable: true, varieties: [
        { name: "帝玉" }, { name: "紫帝玉" }, { name: "鳳卵" },
      ] },
      { name: "フォーカリア", pickable: true, varieties: [
        { name: "怒涛" }, { name: "四海波" }, { name: "雪波" },
      ] },
      { name: "チタノプシス", pickable: true, varieties: [
        { name: "天女" }, { name: "カルカレア" },
      ] },
      { name: "アルギロデルマ", pickable: true, varieties: [
        { name: "金鈴" }, { name: "国宝玉" },
      ] },
      { name: "ギバエウム", pickable: true, varieties: [
        { name: "無比玉" }, { name: "銀光玉" },
      ] },
      { name: "ディンテランサス", pickable: true, varieties: [
        { name: "南蛮玉" }, { name: "幻玉" },
      ] },
      { name: "フリチア", pickable: true, varieties: [
        { name: "光玉" },
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
    label: "観葉",
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
      { name: "その他観葉", pickable: false, varieties: [
        { name: "ディフェンバキア" }, { name: "クワズイモ" }, { name: "アグラオネマ" }, { name: "ザミオクルカス" },
        { name: "シェフレラ" }, { name: "フィカス" }, { name: "ウンベラータ" }, { name: "アルテシマ" },
        { name: "ベンガレンシス" }, { name: "ペペロミア" }, { name: "ストレリチア" }, { name: "エバーフレッシュ" },
        { name: "ガジュマル" }, { name: "ストロマンテ" }, { name: "クテナンテ" }, { name: "ディスキディア" },
        { name: "サンスベリア" },
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
    label: "山野草・盆栽",
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
      { name: "山野草", pickable: true, varieties: [
        { name: "雪割草" }, { name: "福寿草" }, { name: "イワヒバ" }, { name: "春蘭" },
        { name: "寒蘭" }, { name: "イワチドリ" }, { name: "ホトトギス" }, { name: "日本桜草" },
        { name: "ダイモンジソウ" }, { name: "イワタバコ" }, { name: "高山植物" }, { name: "斑入り山野草" },
      ] },
    ],
  },
  {
    label: "バラ・草花",
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
      { name: "その他人気草花", pickable: false, varieties: [
        { name: "プリムラ" }, { name: "ビオラ" }, { name: "パンジー" }, { name: "多年草" },
        { name: "宿根草" }, { name: "原種チューリップ" }, { name: "ダリア" }, { name: "変化朝顔" },
        { name: "古典菊" }, { name: "嵯峨菊" }, { name: "江戸菊" }, { name: "肥後菊" },
        { name: "花菖蒲" }, { name: "君子蘭" },
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
      { name: "ハーブ", pickable: true, varieties: [
        { name: "バジル" }, { name: "スイートバジル" }, { name: "ホーリーバジル" }, { name: "レモンバジル" },
        { name: "ジェノベーゼ" }, { name: "ローズマリー" }, { name: "立性ローズマリー" }, { name: "匍匐性ローズマリー" },
        { name: "タイム" }, { name: "コモンタイム" }, { name: "レモンタイム" }, { name: "ミント" },
        { name: "スペアミント" }, { name: "ペパーミント" }, { name: "アップルミント" }, { name: "パイナップルミント" },
        { name: "セージ" }, { name: "コモンセージ" }, { name: "パイナップルセージ" }, { name: "チェリーセージ" },
        { name: "ホワイトセージ" }, { name: "オレガノ" }, { name: "ケントビューティー" }, { name: "ラベンダー" },
        { name: "イングリッシュラベンダー" }, { name: "フレンチラベンダー" }, { name: "グロッソ" }, { name: "カモミール" },
        { name: "ジャーマンカモミール" }, { name: "ローマンカモミール" }, { name: "レモングラス" }, { name: "レモンバーム" },
        { name: "ディル" }, { name: "チャイブ" }, { name: "タラゴン" },
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

