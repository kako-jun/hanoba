import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";
import { hanobaWorkboxOptions } from "./src/lib/pwa/workbox-options.mjs";

// フッタ等に出す公開版数。orber / machigai-salad と同じく JST のビルド年月日を使う。
const BUILD_DATE = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
      // "prompt"（mypace 方式・#551）＝新しい SW を検知しても自動 skipWaiting しない。
      // "autoUpdate" だと新SWが自動でclientsClaimし、開いたままのタブが無警告でネットワーク境界を
      // 差し替えられる（overlay も cooldown も挟めない）。src/lib/pwa/registerUpdate.ts が
      // onNeedRefresh を受けて overlay 表示 → skipWaiting → controllerchange 待ち → reload する。
      registerType: "prompt",
      // 自動生成される registerSW.js（素の navigator.serviceWorker.register のみ・onNeedRefresh を
      // 呼ばない）は使わない。src/layouts/MainLayout.astro から registerUpdate.ts を
      // 直接 import する自前の <script> に置き換える（#551）。
      injectRegister: false,
      workbox: hanobaWorkboxOptions,
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
    define: {
      __BUILD_DATE__: JSON.stringify(BUILD_DATE),
    },
  },
});
