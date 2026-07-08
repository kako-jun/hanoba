import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// 完全静的・バックエンドレス。状態は全て Nostr（クライアント側）に乗る。
// SSR アダプタは持たない（dist/ をそのまま CF Pages に配信）。
export default defineConfig({
  // 本番ドメイン。canonical / og:url / sitemap の絶対 URL 生成に使う（#107）。
  site: "https://hanoba.llll-ll.com",
  output: "static",
  integrations: [
    react(),
    // sitemap-index.xml / sitemap-0.xml を全ページから自動生成（robots.txt から参照）。
    sitemap(),
    AstroPWA({
      registerType: "autoUpdate",
      workbox: {
        // クエリ付きのナビゲーション（例: 植物札→ `/discover?tags=ブレビカウレ`）が、precache 済みの
        // 各ページ HTML（`/discover/index.html` 等）に**マッチするよう、マッチ時に全クエリパラメータを
        // 無視する**（既定は utm_/fbclid のみ無視）。これが無いと `?tags=` 付き /discover が precache に
        // マッチせず、生成 SW の navigateFallback（`createHandlerBoundToURL("/")`＝ホーム）にすり替わり、
        // discover が一切描画されない＝**札クリックで品種絞り込みに遷移できない真因**（#291・本番のみ／
        // SW 有効時のみ再現。dev は SW 無しで露見しなかった）。`?q=`（JSON-LD 検索）・旧 `?tag=` も同時に救済。
        ignoreURLParametersMatching: [/.*/],
        // 天気の水滴素材（#231・雨のときだけ出る装飾）は precache しない＝雨を見ないユーザーにも
        // install で数百 KB を背負わせない（#132「軽量」）。雨が降ったとき初回だけ network 取得し、
        // 以後は _headers の長期 Cache-Control（public/_headers の /weather/*）でブラウザ HTTP キャッシュに乗る。
        globIgnores: ["**/weather/**"],
      },
      manifest: {
        name: "Hanōba",
        short_name: "Hanōba",
        description: "植物写真のSNS。Instagram より、はやくかんたんに、ひとこと添えて。",
        id: "/",
        start_url: "/",
        scope: "/",
        // theme_color はスプラッシュのステータスバー色＝background_color と同色にする（cream）。
        // 違う色だと Android スプラッシュで「緑のステータスバー × cream 本体」の境目が上端に
        // 細い線として出る（#478 の「枠」の真因＝両色を一致させれば境目が消えて線が出ない）。
        // アプリ内（起動後）のステータスバー色は <meta name="theme-color">（MainLayout）が別途持つので、
        // ここを cream にしてもアプリ内の見た目は変わらない。
        theme_color: "#F3E7E7",
        background_color: "#F3E7E7",
        display: "standalone",
        orientation: "portrait",
        lang: "ja",
        categories: ["lifestyle", "photo"],
        // 192/512 の PNG（purpose=any）2つだけに絞る。PNG は scripts/generate-icons.mjs が
        // public/icon.svg から生成する（maskable/SVG の生成物はディスクからも撤去済み #515）。
        // 以前は先頭に SVG（sizes=any）と maskable PNG 2つを足していたが、これが Android スプラッシュで
        // アイコンを板／マスク付きに描かせ、極薄い四角い枠を生んだ。SVG/maskable を持たず
        // purpose:"any" の PNG 2つだけにすると板／マスクが描かれず枠が出ないので、その構成に絞って枠を消す（#513）。
        // PNG は -v3 サフィックス付き＝アイコンの中身を差し替えただけでは Android の WebAPK が
        // 焼き直されず古いスプラッシュが残るため、URL を変えて manifest 内容を変化させ OS に
        // WebAPK を強制再生成させる（#478。中身を変えたら必ず URL も上げる）。
        icons: [
          { src: "/icon-192-v3.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512-v3.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
