// ハノーバ市民手帳の表示テキスト（#163）。UI（CityHallBook）が描画する単一ソース。
//
// 文言はトーンロック済み（市長ボタニクス・フォン・ハノーバの声）。
// doctrine（市長バイブル・市民レベル・ページモデル）の正本は docs/lore.md にある。
// ここはその「レンダリング元」。本文の言い回しは承認済みのまま、改変しない。
//
// 言語別（JA/EN）は #147 前提で defer。まず JA のみ。

/** 本文の 1 段落。kind で見出し脇の実務注などを区別する。 */
export type Block =
  | { kind: "para"; text: string }
  | { kind: "note"; text: string }; // 小さく添える実務注・注記

/** ハブのリンク 1 件。route が null なら「近日開庁」（未開設・非リンク表示）。 */
export interface HubLink {
  label: string;
  /** 実在ルート（既存ページ）。未開設は null。 */
  route: string | null;
  /** 未開設の佇まい説明（近日開庁）。route が null のときに使う。 */
  comingSoon?: string;
}

/** 沿革（年表）の 1 行。 */
export interface ChronicleEntry {
  era: string;
  text: string;
}

/** 市の条文 1 条（条文＋市長解説）。osaka-kenpo 作法。 */
export interface Ordinance {
  article: string; // 例: 第一条（土地）
  text: string; // 条文
  commentary: string; // 市長解説
}

/** 本の 1 ページ。種類ごとに描画するデータ形を持つ。 */
export type BookPage =
  | { page: 1; kind: "welcome"; title: string; blocks: Block[] }
  | { page: 2; kind: "hub"; title: string; lead: string; links: HubLink[] }
  | { page: 3; kind: "chronicle"; title: string; entries: ChronicleEntry[]; note: string }
  | { page: 4; kind: "ordinances"; title: string; ordinances: Ordinance[] };

/** 本の在世タイトル（手帳の表題）。 */
export const BOOK_TITLE = "ハノーバ市民手帳";

/** P1 移住案内（市長の歓迎の辞）。 */
const PAGE_1: BookPage = {
  page: 1,
  kind: "welcome",
  title: "移住案内",
  blocks: [
    {
      kind: "para",
      text: "おっほん。ハノーバ市長、ボタニクス・フォン・ハノーバである。ようこそ、緑の市へ。",
    },
    {
      kind: "para",
      text: "わが市に土地代はない。植物を育てている限り、区画は永久に無料で諸君のものだ。やることはただ一つ——正方形の区画にあなたの一鉢を植え、ひとこと添える。それだけで、あなたも立派な市民だ。写真は植物に限る（人もペットも、よその街でやりたまえ）。",
    },
    {
      kind: "para",
      text: "市の沿革も、条文も、品評会も、すべてこの市役所からご覧になれる。さあ、移住の手続きを。名を名乗れば、それで完了だ。",
    },
    {
      kind: "note",
      text: "※ ハノーバは植物専用の写真SNSです。正方形の写真1枚＋ひとこと、植物だけ。名前を登録すると投稿できます。",
    },
  ],
};

/** P2 市役所ハブ（導線集約）。実在ルートのみ機能させ、未開設は「近日開庁」。 */
const PAGE_2: BookPage = {
  page: 2,
  kind: "hub",
  title: "市役所",
  lead: "おっほん。ここは市役所だ。市政のすべては、この扉から辿れる。",
  links: [
    { label: "みんなの植物（フィード）", route: "/discover" },
    { label: "あなたの植物", route: "/me" },
    { label: "投稿する", route: "/compose" },
    { label: "人気ランキング", route: "/ranking" },
    { label: "住民投票", route: null, comingSoon: "近日開庁" },
    { label: "品評会（コンテスト）", route: null, comingSoon: "近日開庁" },
    { label: "市長ブログ", route: null, comingSoon: "近日開庁" },
    { label: "街の地図", route: null, comingSoon: "近日開庁" },
  ],
};

/** P3 沿革（年表・遊び）。 */
const PAGE_3: BookPage = {
  page: 3,
  kind: "chronicle",
  title: "沿革",
  entries: [
    {
      era: "第一年 春",
      text: "初代市長ボタニクス・フォン・ハノーバ、荒れ地に最初の一鉢を植える。芽が出た日を、市の誕生とする。",
    },
    {
      era: "第一年 夏",
      text: "市長、「雑草という植物は無い」と布告。優劣をつける条例の制定を永久に禁ずる。",
    },
    {
      era: "第一年 秋",
      text: "葉脈川（はみゃくがわ）の水、初めて温室街を潤す。",
    },
    {
      era: "第二年",
      text: "区画はすべて正方形と定められる。理由は「美しいから」とのみ記録される。",
    },
  ],
  note: "市民が増えるたび、この年表は書き足される。",
};

/** P4 市の条文（ハノーバ市憲章・各条に市長解説）。 */
const PAGE_4: BookPage = {
  page: 4,
  kind: "ordinances",
  title: "市の条文",
  ordinances: [
    {
      article: "第一条（土地）",
      text: "ハノーバ市の土地代は、植物を育てている限り、無料とする。",
      commentary:
        "おっほん。育てる意志こそが地代だ。水をやり、葉を見つめる——それで諸君は十分に納めている。",
    },
    {
      article: "第二条（区画）",
      text: "一つの区画には、正方形の写真一枚と、ひとことを添えるものとする。",
      commentary: "区画は正方形に限る。なぜか？ 美しいからだ。理由は以上である。",
    },
    {
      article: "第三条（住民）",
      text: "名を名乗った者を、市民とみなす。",
      commentary: "名乗りは移住届だ。本名である必要はない。諸君が諸君であればよい。",
    },
    {
      article: "第四条（平等）",
      text: "市は、すべての植物を等しく愛する。雑草という名の植物は、当市には存在しない。",
      commentary:
        "日陰の苔も、軒先の多肉も、みな市の宝。優劣をつける条例は、永久に制定しない。",
    },
    {
      article: "第五条（写真）",
      text: "当市に掲げる写真は、植物のものに限る。",
      commentary: "人もペットも、それぞれの街で輝けばよい。ここは植物の市だ。",
    },
  ],
};

/** 全ページ（1〜4・順序固定）。 */
export const BOOK_PAGES: BookPage[] = [PAGE_1, PAGE_2, PAGE_3, PAGE_4];

/** ロックされたページのティザー（図鑑式・？？？）。 */
export const LOCKED_TEASER = {
  title: "？？？",
  note: "このページは、もう少し市に馴染んでから。",
} as const;

/** レベル昇格時に小さく添える市長のひとこと（味付け）。 */
export const LEVEL_FLAVOR = {
  /** L1 で 2p 目（市役所）を開いたとき。L2 以上では出さない（古参に移住受理を再掲しない）。 */
  citizen: "移住、確かに受理した。ようこそ、市民諸君。",
  /** L2 が初めて奥のページ（3p 沿革）に達したとき。 */
  tenured: "おっほん。諸君はもう、市の古い友人だ。奥の間を開けておいた。",
} as const;

/** レベル別の手帳タイトル脇に添える肩書（本の見出しがレベルで変わる・menu 語の差し替えは defer）。 */
export const LEVEL_SUBTITLE: Record<0 | 1 | 2, string> = {
  0: "ようこそ、緑の市へ",
  1: "市民の手引き",
  2: "古参の手引き",
};
