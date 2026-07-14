/// <reference types="astro/client" />
// "virtual:pwa-register" の型（#551・src/lib/pwa/registerUpdate.ts が使う）。
// フレームワーク専用（react.d.ts 等）ではなく vanilla の registerSW 契約を使う
// （Astro のクライアント <script> はプレーン TS で書くため）。
/// <reference types="vite-plugin-pwa/vanillajs" />

// astro.config.mjs の Vite define で JST の YYYY-MM-DD に置換される。
declare const __BUILD_DATE__: string;
