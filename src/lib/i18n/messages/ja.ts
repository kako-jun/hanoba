// 日本語カタログ（#147 段階1）＝**文言の型の単一ソース**。
//
// フラットな dot-key（`nav.discover` 等）で名前空間を表す。`as const` で値リテラルを保ち、
// `keyof typeof ja` を MessageKey（全文言キーの union）として t.ts/en.ts が共有する
// ＝キーの取りこぼし・タイポをコンパイル時に検出できる。
//
// 補間は `{name}` プレースホルダ（t.ts が params で置換）。
// ここに無いキーを使うと型エラーになる＝文言の所在をこのファイルに一本化する。
//
// 段階1ではスライス（ヘッダ／ホームのヒーロー／投稿FAB）分だけを移管する。
// 全文言の展開は段階2（#147）で pages/islands へ fan-out する。

export const ja = {
  // 共通ナビ（SiteHeader / SiteFooter）。
  "nav.discover": "みんなの植物",
  "nav.me": "あなたの植物",
  "nav.compose": "投稿する",
  "nav.ranking": "人気ランキング",
  "nav.menu.open": "メニューを開く",
  "nav.menu.close": "メニューを閉じる",
  "nav.home.aria": "葉の場 Hanoba トップへ",

  // 共通フッタ（SiteFooter）。
  "footer.tagline": "架空の植物好き都市ハノーバ（葉の場）を、みんなで育てています。",

  // 一番上へ戻る（ScrollToTop）。
  "scrollToTop.aria": "一番上へ戻る",

  // PWA「ホーム画面に追加」促し（InstallPrompt）。
  "install.title": "ホーム画面に追加",
  "install.ios": "共有メニュー {arrow} から「ホーム画面に追加」を選ぶと、アプリのように開けます。",
  "install.tagline": "アプリのように開けます。",
  "install.add": "追加",
  "install.later": "あとで",

  // 汎用（複数箇所で共有）。
  "common.close": "閉じる",

  // ホーム（index）ヒーロー。世界観文言＝直訳でなく意訳前提（en.ts 参照）。
  "home.hero.title": "育てて、見せる。",
  "home.hero.lead": "植物写真のSNS。Instagram より、はやくかんたんに、ひとこと添えて。畑もビカクも実生も、この一画に。",
  "home.hero.sub": "ここは Hanōba に置かれた植物のタイムライン。Nostr 全体の植物は{link}へ。",
  "home.hero.sub.link": "みんなの植物",

  // 投稿フローティングボタン（PostFAB）。
  "fab.compose.aria": "投稿する",

  // サイト既定メタ（MainLayout）。
  "site.description": "植物写真のSNS。Instagram より、はやくかんたんに、ひとこと添えて。",

  // 各ページのメタ（<title> / <meta description>・SEO・OGP）。
  "meta.about.title": "Hanōba とは — 架空の植物都市",
  "meta.about.description": "Hanōba は植物写真の SNS。架空の植物好き都市ハノーバを、みんなで育てる場所です。",
  "meta.compose.title": "投稿する — Hanōba",
  "meta.discover.title": "みんなの植物 — Hanōba",
  "meta.discover.description": "Nostr 全体の植物（#plantstr）と、Hanōba の投稿をまとめて眺める。",
  "meta.me.title": "あなたの植物 — Hanōba",
  "meta.me.description": "あなたが Hanōba に置いた植物の一覧。ここから投稿を削除できます（写真ごと）。",
  "meta.ranking.title": "人気ランキング — Hanōba",
  "meta.ranking.description": "Hanōba の投稿から、いま人気の品種を週次で集計。先週比（↑↓・NEW・RE）つき。",
  "meta.u.title": "市民のプロフィール — Hanōba",
  "meta.u.description": "Hanōba の市民の公開プロフィール。置いた植物と活動スタッツ（投稿・写真・育てた品種・居住日数）を眺める。",
  "meta.vote.title": "住民投票 — ハノーバ市役所",
  "meta.vote.description": "ハノーバ市役所の住民投票所。品種の並び順・欲しい機能・バグ報告を、掲示板で気軽に。名前は任意。",

  // 各ページ本体のリード文（h1 は既存ナビキーを再利用）。
  "discover.lead": "Nostr 全体の植物（#plantstr）と、Hanōba の投稿をまとめて眺めます。",
  "me.lead": "あなたが置いた1枚たち。削除すると、投稿と写真がいっしょに消えます。",
  // 原文は2文が改行＋字下げで分かれ JSX が1スペースに畳む＝ここでは半角スペース1つで繋ぐ。
  "ranking.lead": "Hanōba の投稿から、いま人気の品種を週ごとに集計します。先週との比較（↑↓・NEW・RE）つき。 みんなの投稿がそのままチャートを動かします。",

  // 住民投票ページ（vote・市長ボタニクスの声）。
  "vote.h1": "住民投票",
  "vote.intro": "おっほん。ここは住民投票所だ。市政に物申したい諸君、遠慮はいらぬ。名乗らずとも一票は一票。市長が必ず目を通す。",
  "vote.note": "※ 各欄は掲示板です。気軽に書き込めます（名前は任意）。",
  "vote.board.aria": "住民投票 — {title}",
  "vote.board.requests.title": "品種への要望",
  "vote.board.requests.intro": "品種に関する願いはすべてここへ。並び順、名簿に無い品種の追加、その他、遠慮はいらぬ。市長が必ず目を通す。",
  "vote.board.features.title": "欲しい機能",
  "vote.board.features.intro": "この市にあったらいい仕組みを請願せよ。市長が善処する（かもしれない）。",
  "vote.board.bugs.title": "バグ報告",
  "vote.board.bugs.intro": "市の不具合を見つけたら、ここへ。直ちに修繕隊を送る。",
} as const;

/** 全文言キーの union（ja を単一ソースに型を導出する）。 */
export type MessageKey = keyof typeof ja;
