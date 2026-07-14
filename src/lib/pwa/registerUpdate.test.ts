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
// registerUpdate.ts 内の同名定数と一致させる（waitForSwCheck のタイミング境界テスト用）。
const POST_CHECK_GRACE_MS = 500;
const SW_CHECK_TIMEOUT_MS = 2000;
const BASE_TIME = new Date("2026-07-14T00:00:00.000Z").getTime();

type OnRegisteredSW = (swUrl: string, registration?: unknown) => void;

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

/**
 * registerUpdate.ts をフレッシュな module closure で読み込み、onNeedRefresh・onRegisteredSW・
 * module の waitForSwCheck export をまとめて返す（#551・waitForSwCheck 系テスト用）。
 * loadOnNeedRefresh と同じく vi.resetModules() で毎回作り直し、closure 漏れを防ぐ。
 */
async function loadModule(): Promise<{
  onNeedRefresh: OnNeedRefresh;
  onRegisteredSW: OnRegisteredSW;
  waitForSwCheck: Promise<void>;
}> {
  vi.resetModules();
  const mod = await import("./registerUpdate.ts");
  const options = registerSWMock.mock.calls.at(-1)?.[0] as RegisterSWOptions | undefined;
  if (!options?.onNeedRefresh || !options?.onRegisteredSW) {
    throw new Error("registerSW に onNeedRefresh/onRegisteredSW が渡されなかった（テスト構成の不備）");
  }
  return { onNeedRefresh: options.onNeedRefresh, onRegisteredSW: options.onRegisteredSW, waitForSwCheck: mod.waitForSwCheck };
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

describe("waitForSwCheck（#551・agasteer 方式の初回更新チェック待ち）", () => {
  // FeedGrid/DiscoverGrid/MyGrid の初回 relay fetch はこの Promise を await してから始まる
  // （agasteer の src/main.ts の waitForSwCheck と同じ設計）。ここでは resolve/非 resolve の
  // タイミング境界だけを検証する（Grid 側での実際の await 配線は各 component テストの守備範囲）。

  // 上の describe とは別スコープ（sibling describe）なので updateSWMock はここで独自に持つ。
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

  /** waitForSwCheck の resolve 有無を観測するための boolean ref を返す（直接 await すると未解決時に無限待ちになるため）。 */
  function observeResolution(waitForSwCheck: Promise<void>): { resolved: boolean } {
    const state = { resolved: false };
    void waitForSwCheck.then(() => {
      state.resolved = true;
    });
    return state;
  }

  it("registration が undefined（SW 未対応・登録失敗）なら即座に resolve する", async () => {
    stubServiceWorker();
    const { onRegisteredSW, waitForSwCheck } = await loadModule();
    const state = observeResolution(waitForSwCheck);

    onRegisteredSW("/sw.js", undefined);
    await vi.advanceTimersByTimeAsync(0); // マイクロタスクだけ流す（setTimeout 不要のはず）。

    expect(state.resolved).toBe(true);
  });

  it("registration.update() 成功後、POST_CHECK_GRACE_MS 経過するまでは resolve しない", async () => {
    stubServiceWorker();
    const { onRegisteredSW, waitForSwCheck } = await loadModule();
    const state = observeResolution(waitForSwCheck);

    const registration = { update: vi.fn().mockResolvedValue(undefined) };
    onRegisteredSW("/sw.js", registration);
    await vi.advanceTimersByTimeAsync(0); // update() 自体の resolve を待つ。

    expect(registration.update).toHaveBeenCalledTimes(1);
    expect(state.resolved, "onNeedRefresh が呼ばれる猶予中はまだ resolve しないはず").toBe(false);

    await vi.advanceTimersByTimeAsync(POST_CHECK_GRACE_MS - 1);
    expect(state.resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
  });

  it("registration.update() が reject（オフライン等）しても resolve する", async () => {
    stubServiceWorker();
    const { onRegisteredSW, waitForSwCheck } = await loadModule();
    const state = observeResolution(waitForSwCheck);

    const registration = { update: vi.fn().mockRejectedValue(new Error("offline")) };
    onRegisteredSW("/sw.js", registration);
    await vi.advanceTimersByTimeAsync(0);

    expect(state.resolved).toBe(true);
  });

  it("onRegisteredSW が呼ばれなくても SW_CHECK_TIMEOUT_MS 経過で resolve する（フォールバック）", async () => {
    stubServiceWorker();
    const { waitForSwCheck } = await loadModule();
    const state = observeResolution(waitForSwCheck);

    await vi.advanceTimersByTimeAsync(SW_CHECK_TIMEOUT_MS - 1);
    expect(state.resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(state.resolved).toBe(true);
  });

  it("onNeedRefresh が実際に reload フローへ入っても、その経路自体は resolve を呼ばない（Agasteer と同じ判断＝reload 予定なら fetch を許可する意味が無い）", async () => {
    // 注意: waitForSwCheck には reload フローとは独立な SW_CHECK_TIMEOUT_MS（2秒）の安全弁が
    // 別途あり、そちらは onNeedRefresh の状態に関係なく必ず resolve へ向かう（Agasteer 本家も同じ
    // 構造＝2秒より先の時点まで進めると、たとえ reload 中でもいずれ resolve してしまう）。
    // ここでは「reload フロー（overlay→skipWaiting）自体が resolve を呼ばない」ことだけを、
    // その安全弁がまだ発火していない時点（OVERLAY_DELAY_MS < SW_CHECK_TIMEOUT_MS）で確認する。
    stubServiceWorker();
    setPath("/discover");
    const { onNeedRefresh, waitForSwCheck } = await loadModule();
    const state = observeResolution(waitForSwCheck);

    onNeedRefresh();
    await vi.advanceTimersByTimeAsync(OVERLAY_DELAY_MS);

    expect(state.resolved).toBe(false);
  });

  it("cooldown 中で onNeedRefresh が早期 return しても、resolve は onRegisteredSW 側の経路で独立に進む", async () => {
    // cooldown/compose defer は「reload しない」だけで、waitForSwCheck の resolve 有無を
    // 左右する設計ではない（resolve は onRegisteredSW から辿る別経路）。早期 return 後も
    // 通常どおり resolve できることを確認する。
    stubServiceWorker();
    setPath("/discover");
    sessionStorage.setItem(SW_UPDATE_STORAGE_KEY, String(BASE_TIME)); // cooldown 中にしておく。
    const { onNeedRefresh, onRegisteredSW, waitForSwCheck } = await loadModule();
    const state = observeResolution(waitForSwCheck);

    onNeedRefresh(); // cooldown 中なので何もしない。
    onRegisteredSW("/sw.js", undefined);
    await vi.advanceTimersByTimeAsync(0);

    expect(state.resolved).toBe(true);
  });
});
