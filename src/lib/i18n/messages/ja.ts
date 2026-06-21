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
} as const;

/** 全文言キーの union（ja を単一ソースに型を導出する）。 */
export type MessageKey = keyof typeof ja;
