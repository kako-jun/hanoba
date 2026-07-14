// テスト専用スタブ（#551）。"virtual:pwa-register" は vite-plugin-pwa が Astro のビルド時にだけ
// 提供する仮想モジュールで、vitest.config.ts には同プラグインを積んでいない（React プラグインのみ）
// ため、実 import は解決に失敗する。registerUpdate.test.ts は vi.mock("virtual:pwa-register", ...) で
// registerSW を差し替えるが、vi.mock だけでは Vite の import-analysis が transform 時に行う
// 「specifier が解決できるか」の事前チェックを通過できない（このチェックは resolve.alias の後に
// vi.mock のモック解決へ渡る前段で走るため）。そこで vitest.config.ts の resolve.alias で
// "virtual:pwa-register" をこのファイルへ静的に向け、実体を持たせて transform を通す。
// ここでエクスポートする registerSW は常に vi.mock で上書きされる前提のダミーで、テストが
// これを直接呼ぶことは無い（呼ばれたらモックし忘れの signal として気づけるよう no-op にしてある）。
export function registerSW(_options?: unknown): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
