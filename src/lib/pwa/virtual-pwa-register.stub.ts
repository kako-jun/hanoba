// テスト専用スタブ（#551）。"virtual:pwa-register" は vite-plugin-pwa が Astro のビルド時にだけ
// 提供する仮想モジュールで、vitest.config.ts には同プラグインを積んでいない（React プラグインのみ）
// ため、実 import は解決に失敗する。registerUpdate.test.ts は vi.mock("virtual:pwa-register", ...) で
// registerSW を差し替えるが、vi.mock だけでは Vite の import-analysis が transform 時に行う
// 「specifier が解決できるか」の事前チェックを通過できない（このチェックは resolve.alias の後に
// vi.mock のモック解決へ渡る前段で走るため）。そこで vitest.config.ts の resolve.alias で
// "virtual:pwa-register" をこのファイルへ静的に向け、実体を持たせて transform を通す。
//
// registerUpdate.test.ts はこの既定挙動を vi.mock で丸ごと上書きする（呼ばれることは無い）。
// 一方 FeedGrid/DiscoverGrid/MyGrid の component テスト（#551・waitForSwCheck 導入）は
// registerUpdate.ts を経由でこのスタブへ実際に到達する＝ここが no-op のままだと
// registerUpdate.ts の waitForSwCheck が SW_CHECK_TIMEOUT_MS（2秒の実タイマー）でしか解決せず、
// テストの findBy* 系デフォルトタイムアウト（1秒）より長くかかってタイムアウトする。
// happy-dom は実 Service Worker を持たないため「登録できなかった」を模し、マイクロタスクで
// onRegisteredSW(url, undefined) を呼んで即座に解決させる（実体の registerSW も非同期で
// onRegisteredSW を呼ぶので、同期呼び出しにはしない）。
interface StubRegisterSWOptions {
  onRegisteredSW?: (swUrl: string, registration: unknown) => void;
}

export function registerSW(options?: StubRegisterSWOptions): (reloadPage?: boolean) => Promise<void> {
  queueMicrotask(() => {
    options?.onRegisteredSW?.("/sw.js", undefined);
  });
  return async () => {};
}
