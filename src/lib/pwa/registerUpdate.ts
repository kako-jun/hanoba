// PWA 更新検知時の overlay 表示 → 新 SW 適用 → 自動 reload（#551・mypace 方式をそのまま移植）。
//
// astro.config.mjs の registerType: "prompt" ＝新しい SW を見つけても自動 skipWaiting しない
// （autoUpdate は無警告でタブの制御を奪う＝overlay も cooldown も挟めない）。ここでは能動的に
// onNeedRefresh を受け、①overlay 表示 → ②skipWaiting → ③controllerchange 待ち → ④reload する。
// controllerchange が来ない場合の fallback reload も持つ（ブラウザ差異・SW 実装差異への保険）。
//
// **reload は1回だけ**（QA 指摘・3min で見つかった同種バグの再発防止）: registerType:"prompt" では
// `updateSW(reloadPage)` の引数はもう使われず（vite-plugin-pwa 0.13.2+）、実際の reload は
// workbox-window 内部の `controlling` リスナーが `event.isUpdate` を見て独自に window.location.reload()
// する可能性がある。ここで張る自前の controllerchange リスナー・fallback timeout・updateSW() の
// catch と合わせると reload 経路が複数走り得るため、`reloaded` フラグで1回目以降を無視する。
//
// 投稿フォーム（/compose）にいる間は reload を defer する（#228 の自動下書き保存と衝突しないよう、
// skipWaiting を送らず待機 SW のまま留める）。判定は updateGuard.ts の isComposeRoute。
// reload ループ防止に sessionStorage cooldown を持つ（mypace 同様 10 秒）。
//
// **waitForSwCheck（Agasteer 方式・#551）**: hanoba は起動直後に Nostr リレーへタイムラインを
// 取得しに行く（FeedGrid/DiscoverGrid/MyGrid）。この取得が SW 更新チェックより先に走ると、
// 直後に onNeedRefresh が発火して reload された場合その取得が丸ごと無駄になる。初回の更新確認が
// 一段落する（成功・失敗・タイムアウトいずれか）まで待てる Promise を export し、各 Grid 島の
// 初回 fetch 直前で await する（agasteer の src/main.ts の waitForSwCheck と同じ設計・
// src/lib/app-state.svelte.ts:814 の「await waitForSwCheck してから初回データ取得」と同じ配線）。
// onNeedRefresh が実際に発火して reload フローに入った場合はこの Promise を resolve しない
// （すぐ reload されるので fetch を許可する意味が無い＝Agasteer と同じ判断）。
//
// Astro のクライアント <script>（MainLayout.astro）から import される、副作用込みのブートストラップ
// モジュールだが、waitForSwCheck は FeedGrid 等の React 島（client:load＝SSR で1回評価される）からも
// import されるため、**モジュール全体が SSR 安全でなければならない**。window/navigator/document に
// 触れる本体（initUpdateRegistration）は isBrowser ガードの内側だけで呼び、SSR/Node からの評価では
// 何も実行せず waitForSwCheck は即 resolve 済みの Promise になる（DOM/SW を直接触るので install.ts の
// ような純関数分離はここでは行わない。純粋な判定だけを updateGuard.ts に切り出し、そちらはテスト
// 可能にしてある）。

import { registerSW } from "virtual:pwa-register";
import { resolveClientLocale, t } from "../i18n/index.ts";
import { isComposeRoute, isUpdateCooldownActive, SW_UPDATE_STORAGE_KEY } from "./updateGuard.ts";

// overlay を見せてから skipWaiting を送るまでの間（ユーザーに気づかせる猶予）。
const OVERLAY_DELAY_MS = 1500;
// controllerchange が来ない場合の fallback reload までの猶予。
const FALLBACK_RELOAD_MS = 2000;
// registration.update() 完了後、onNeedRefresh が呼ばれる猶予（Agasteer 方式）。
const POST_CHECK_GRACE_MS = 500;
// SW 未対応・登録が長引く環境でも waitForSwCheck を無期限に止めないための上限（Agasteer 方式）。
const SW_CHECK_TIMEOUT_MS = 2000;

function readLastUpdatedAt(): number | null {
  const raw = sessionStorage.getItem(SW_UPDATE_STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 「新しいバージョンがあります。再起動します...」overlay を全面に出す（既存 UI と衝突しない z-index）。 */
function showUpdateOverlay(): void {
  const locale = resolveClientLocale();

  const overlay = document.createElement("div");
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(20,18,13,.85);display:flex;align-items:center;justify-content:center;z-index:99999;";

  const message = document.createElement("div");
  message.style.cssText =
    "color:#f6f0e6;font-size:.9rem;text-align:center;padding:1.5rem 2rem;background:rgba(255,255,255,.1);border-radius:1rem;backdrop-filter:blur(10px);";
  message.textContent = t(locale, "update.restarting");

  overlay.appendChild(message);
  document.body.appendChild(overlay);
}

/**
 * SW 登録を開始し、更新検知（onNeedRefresh）を能動的にハンドルする。呼び出し元はブラウザ環境
 * であることを保証済み（isBrowser ガード後）とする。戻り値は初回更新チェックの一段落を待てる
 * Promise（waitForSwCheck の実体・Agasteer 方式）。
 */
function initUpdateRegistration(): Promise<void> {
  return new Promise((resolve) => {
    // 初回更新チェックの完了は一度きり通知すればよい（重複 resolve は no-op）。
    let resolved = false;
    const safeResolve = (): void => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    // reload 経路が複数（自前の controllerchange リスナー・fallback timeout・workbox-window 内部の
    // controlling リスナー）走り得るため、実行済みなら以降は無視する（QA 指摘・二重 reload 防止）。
    let reloaded = false;
    const reloadOnce = (): void => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (!registration) {
          // SW 未対応・登録失敗。更新チェックのしようがないので、fetch を止めず続行する。
          safeResolve();
          return;
        }
        // 起動時に一度だけ更新確認する（mypace/Agasteer 由来）。完了後、onNeedRefresh が
        // 呼ばれる猶予（500ms）を置いてから resolve する（この間に呼ばれれば reload フローへ入る）。
        registration
          .update()
          .then(() => {
            window.setTimeout(safeResolve, POST_CHECK_GRACE_MS);
          })
          .catch(() => {
            // オフライン等の失敗でも fetch を止めない。
            safeResolve();
          });
      },
      onNeedRefresh() {
        if (isUpdateCooldownActive(readLastUpdatedAt(), Date.now())) return;
        if (isComposeRoute(location.pathname)) {
          // 投稿フォーム中は reload しない。Astro は MPA なので、ここを離れる操作は必ず
          // フルナビゲーション＝次のページ読み込みで本モジュールが再実行され、待機中の SW が
          // 残っていれば onNeedRefresh が再発火して適用される（ポーリング不要）。
          return;
        }

        showUpdateOverlay();
        sessionStorage.setItem(SW_UPDATE_STORAGE_KEY, String(Date.now()));

        navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);

        window.setTimeout(() => {
          updateSW(true).catch(reloadOnce);
          window.setTimeout(reloadOnce, FALLBACK_RELOAD_MS);
        }, OVERLAY_DELAY_MS);
        // safeResolve は呼ばない（すぐ reload されるので fetch を許可する意味が無い＝Agasteer と同じ判断）。
      },
    });

    // タイムアウト: SW 未対応環境や登録に時間がかかる場合でも、fetch を無期限に止めない。
    window.setTimeout(safeResolve, SW_CHECK_TIMEOUT_MS);
  });
}

// FeedGrid.tsx 等（client:load＝SSR で1回評価される React 島）から waitForSwCheck を import しても
// 安全なように、window/navigator に触れる本体は isBrowser のときだけ呼ぶ（SSR/Node では何もしない）。
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined" && typeof navigator !== "undefined";

export const waitForSwCheck: Promise<void> = isBrowser ? initUpdateRegistration() : Promise.resolve();
