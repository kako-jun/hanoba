import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// 完全静的・バックエンドレス。状態は全て Nostr（クライアント側）に乗る。
// SSR アダプタは持たない（dist/ をそのまま CF Pages に配信）。
export default defineConfig({
  output: "static",
  integrations: [
    react(),
    AstroPWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Hanōba",
        short_name: "Hanōba",
        description: "植物写真のSNS。Instagram より、はやく・かんたんに、ひとこと添えて。",
        id: "/",
        start_url: "/",
        scope: "/",
        theme_color: "#509120",
        background_color: "#F3E7E7",
        display: "standalone",
        orientation: "portrait",
        lang: "ja",
        categories: ["lifestyle", "photo"],
        // SVG（vector）＋ PNG（iOS A2HS / 旧 Android が要求するラスタ）の両方を持つ。
        // PNG は scripts/generate-icons.mjs が public の SVG から生成する。
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
