import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SW_UPDATE_STORAGE_KEY } from "./updateGuard.ts";

// registerUpdate.ts は import 時に initUpdateRegistration() を即実行する副作用込みモジュール
// （DOM/SW を直接触るブートストラップ・updateGuard.ts の doc コメント参照）。テストは
// vi.mock("virtual:pwa-register") で registerSW を差し替え、onNeedRefresh コールバックを捕捉して
// 直接呼び出す構成にする。
//
// "virtual:pwa-register" は vite-plugin-pwa が Astro ビルド時にだけ提供する仮想モジュールで、
// vitest.config.ts には同プラグインを積んでいないため、vi.mock だけでは Vite の import-analysis の
// 事前解決チェックを通過できない。vitest.config.ts 側で resolve.alias により実体（スタブファイル）へ
// 静的に向けた上で、ここでは vi.mock によりそのスタブの中身を丸ごと差し替える。

type OnNeedRefresh = () => void;
interface RegisterSWOptions {
  immediate?: boolean;
  onRegisteredSW?: (swUrl: string, registration?: unknown) => void;
  onNeedRefresh?: OnNeedRefresh;
}

const { registerSWMock } = vi.hoisted(() => ({ registerSWMock: vi.fn() }));

vi.mock("virtual:pwa-register", () => ({
  registerSW: registerSWMock,
}));

const OVERLAY_DELAY_MS = 1500;
const FALLBACK_RELOAD_MS = 2000;
const BASE_TIME = new Date("2026-07-14T00:00:00.000Z").getTime();

/**
 * registerUpdate.ts をフレッシュな module closure（reloaded フラグ含む）で読み込み、
 * registerSW に渡された onNeedRefresh を返す。vi.resetModules() で毎回作り直すことで、
 * 「1回目の呼び出しで reloaded=true になった closure が次のテストに漏れる」事故を防ぐ。
 */
async function loadOnNeedRefresh(): Promise<OnNeedRefresh> {
  vi.resetModules();
  await import("./registerUpdate.ts");
  const options = registerSWMock.mock.calls.at(-1)?.[0] as RegisterSWOptions | undefined;
  if (!options?.onNeedRefresh) {
    throw new Error("registerSW に onNeedRefresh が渡されなかった（テスト構成の不備）");
  }
  return options.onNeedRefresh;
}

/** navigator.serviceWorker を happy-dom に無い最小スタブで補い、addEventListener の呼び出しを捕捉できるようにする。 */
function stubServiceWorker(): { addEventListener: ReturnType<typeof vi.fn> } {
  const sw = { addEventListener: vi.fn() };
  Object.defineProperty(navigator, "serviceWorker", { value: sw, configurable: true });
  return sw;
}

function setPath(pathname: string): void {
  window.history.replaceState(null, "", pathname);
}

describe("registerUpdate（#551 プロンプト方式の更新検知・onNeedRefresh ハンドラ）", () => {
  let updateSWMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BASE_TIME);
    sessionStorage.clear();
    document.body.innerHTML = "";
    setPath("/");

    updateSWMock = vi.fn().mockResolvedValue(undefined);
    registerSWMock.mockReset();
    registerSWMock.mockReturnValue(updateSWMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("cooldown 中でなく /compose 以外なら、onNeedRefresh 呼び出しで overlay 相当の副作用が起きる", async () => {
    stubServiceWorker();
    setPath("/discover");
    const onNeedRefresh = await loadOnNeedRefresh();

    onNeedRefresh();

    // overlay 要素が DOM に追加されている（role="status" で描画）。
    expect(document.body.querySelector('[role="status"]')).not.toBeNull();
    // cooldown 用の更新時刻が sessionStorage に書かれている（外部から観測可能な副作用）。
    expect(sessionStorage.getItem(SW_UPDATE_STORAGE_KEY)).toBe(String(BASE_TIME));
  });

  it("/compose にいる間は reload を defer する（overlay も sessionStorage 書き込みも起きない）", async () => {
    stubServiceWorker();
    setPath("/compose");
    const onNeedRefresh = await loadOnNeedRefresh();

    onNeedRefresh();

    expect(document.body.querySelector('[role="status"]')).toBeNull();
    expect(sessionStorage.getItem(SW_UPDATE_STORAGE_KEY)).toBeNull();
  });

  it("cooldown 中は何も起きない（overlay 無し・sessionStorage 更新無し）", async () => {
    stubServiceWorker();
    setPath("/discover");
    // 直近に既に更新適用済み（BASE_TIME 時点で cooldown 中）としてセットしておく。
    sessionStorage.setItem(SW_UPDATE_STORAGE_KEY, String(BASE_TIME));
    const onNeedRefresh = await loadOnNeedRefresh();

    onNeedRefresh();

    expect(document.body.querySelector('[role="status"]')).toBeNull();
    expect(sessionStorage.getItem(SW_UPDATE_STORAGE_KEY)).toBe(String(BASE_TIME));
  });

  it("修正3の回帰テスト: controllerchange が先に reload した後、fallback の setTimeout が発火しても2回目の reload は起きない", async () => {
    const sw = stubServiceWorker();
    setPath("/discover");
    const reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const onNeedRefresh = await loadOnNeedRefresh();

    onNeedRefresh();
    // OVERLAY_DELAY_MS 経過 → updateSW(true) 呼び出し・controllerchange リスナー登録済み・fallback タイマー起動。
    await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS);

    const controllerchangeHandler = sw.addEventListener.mock.calls.find(
      ([event]) => event === "controllerchange",
    )?.[1] as (() => void) | undefined;
    expect(controllerchangeHandler, "controllerchange リスナーが登録されていない").toBeTypeOf("function");

    // controllerchange が先に発火して reload される。
    controllerchangeHandler?.();
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    // その後 fallback（FALLBACK_RELOAD_MS 経過）が発火しても、reloaded フラグにより無視される。
    await vi.advanceTimersByTimeAsync(FALLBACK_RELOAD_MS);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("updateSW が reject しても例外が外に漏れず、最終的に reload に到達する", async () => {
    stubServiceWorker();
    setPath("/discover");
    updateSWMock.mockReset().mockRejectedValue(new Error("updateSW failed"));
    const reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => {});
    const onNeedRefresh = await loadOnNeedRefresh();

    onNeedRefresh();
    // OVERLAY_DELAY_MS 経過で updateSW(true) が呼ばれ reject する（.catch(reloadOnce) で拾われる）。
    // 続けて FALLBACK_RELOAD_MS まで進めても、reject 経由の reload 済みなら二重発火しない。
    // ここで例外が漏れていれば vitest がテスト失敗として検出する。
    await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS + FALLBACK_RELOAD_MS);

    expect(reloadSpy).toHaveBeenCalled();
  });
});
