/**
 * Workbox options shared by Astro config and regression tests.
 *
 * Hanoba is a static multi-page app, not an SPA. The service worker should let
 * static page navigations resolve through the page-specific precache entry or
 * the network; it must never rewrite every missed navigation to the top page.
 */
export const hanobaWorkboxOptions = {
  // クエリ付きのナビゲーション（例: 植物札→ `/discover?tags=ブレビカウレ`）が、precache 済みの
  // 各ページ HTML（`/discover/index.html` 等）に**マッチするよう、マッチ時に全クエリパラメータを
  // 無視する**（既定は utm_/fbclid のみ無視）。これが無いと `?tags=` 付き /discover が precache に
  // マッチせず、生成 SW の navigateFallback にすり替わり、discover が一切描画されない＝
  // **札クリックで品種絞り込みに遷移できない真因**（#291・本番のみ／SW 有効時のみ再現）。
  // `?q=`（JSON-LD 検索）・旧 `?tag=`・`?p=`（投稿 deep-link）も同時に救済。
  ignoreURLParametersMatching: [/.*/],

  // Astro の静的出力は `/about`・`/gazette` などページごとの HTML を持つ。
  // GenerateSW 既定の navigation fallback は未一致ナビゲーションを `/` へ束ねるため、
  // SW 有効時に市民手帳・市政だよりがトップ内容へすり替わる。Hanoba では SPA fallback が
  // 不要なので無効化し、各静的ルート自身または network に解決させる（#538）。
  navigateFallback: null,

  // 天気の水滴素材（#231・雨のときだけ出る装飾）は precache しない＝雨を見ないユーザーにも
  // install で数百 KB を背負わせない（#132「軽量」）。雨が降ったとき初回だけ network 取得し、
  // 以後は _headers の長期 Cache-Control（public/_headers の /weather/*）でブラウザ HTTP キャッシュに乗る。
  globIgnores: ["**/weather/**"],
};
