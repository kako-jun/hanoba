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
        name: "葉の場 (Hanoba)",
        short_name: "葉の場",
        description: "植物専用の正方形写真SNS。1投稿 = 正方形写真1枚 + 一言。",
        theme_color: "#509120",
        background_color: "#F3E7E7",
        display: "standalone",
        lang: "ja",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
