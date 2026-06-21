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
  "common.retry": "再試行",

  // 相対時刻（relativeTime・PostCard/PostDetail 等で共有）。
  "time.justNow": "たった今",
  "time.minutesAgo": "{n}分前",
  "time.hoursAgo": "{n}時間前",
  "time.daysAgo": "{n}日前",

  // フィード表示（PostCard・FudaList・VarietyFilter・いいね/コメント数）。
  "card.photo.zoom": "写真を拡大",
  "card.photos.count": "{n}枚",
  "card.author.profile": "{name} のプロフィール",
  "card.readMore": "続きを読む",
  "reaction.likes.aria": "いいね {n}",
  "reaction.comments.aria": "コメント {n}",
  "fuda.search.title": "{label}で探す",
  "filter.remove.aria": "「{tag}」を外す",

  // フィードのグリッド（FeedGrid / DiscoverGrid / MyGrid の読み込み・空・エラー）。
  "feed.error": "フィードを読み込めませんでした。",
  "feed.empty": "まだ投稿がありません。",
  "feed.error.short": "読み込めませんでした。",
  "feed.filter.clear": "絞り込みを解除",
  "feed.tag.empty": "「#{tag}」の投稿はまだありません。",
  "discover.loading": "「{summary}」を探しています…",
  "discover.empty": "「{summary}」の投稿は見つかりませんでした。別の品種で試してみましょう。",

  // あなたの植物（MyGrid・自分の投稿の編集/削除）。
  "my.subject": "あなた",
  "my.empty": "まだ、あなたの植物はありません。",
  "my.edit.aria": "この投稿を編集",
  "my.delete.aria": "この投稿を削除",
  "my.edit.done": "投稿を編集しました（新しい投稿として再投稿しました）。",
  "my.delete.photoUnconfirmed": "投稿は削除しましたが、写真の削除を確認できませんでした（数分後に消える場合があります）。",
  "my.delete.failed": "削除できませんでした。時間をおいて再試行してください。",

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
