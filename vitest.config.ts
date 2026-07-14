import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // "virtual:pwa-register" は vite-plugin-pwa が Astro ビルド時にだけ提供する仮想モジュール。
      // ここでは同プラグインを積んでいないため、実体を持つスタブへ静的に向けて import-analysis の
      // 解決を通す（registerUpdate.test.ts はその上で vi.mock により中身を差し替える・#551）。
      "virtual:pwa-register": fileURLToPath(new URL("./src/lib/pwa/virtual-pwa-register.stub.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
