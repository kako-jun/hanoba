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
// Astro のクライアント <script>（MainLayout.astro）から import される、副作用込みのブートストラップ
// モジュール（DOM/SW を直接触るので install.ts のような純関数分離はここでは行わない。
// 純粋な判定だけを updateGuard.ts に切り出し、そちらはテスト可能にしてある）。

import { registerSW } from "virtual:pwa-register";
import { resolveClientLocale, t } from "../i18n/index.ts";
import { isComposeRoute, isUpdateCooldownActive, SW_UPDATE_STORAGE_KEY } from "./updateGuard.ts";

// overlay を見せてから skipWaiting を送るまでの間（ユーザーに気づかせる猶予）。
const OVERLAY_DELAY_MS = 1500;
// controllerchange が来ない場合の fallback reload までの猶予。
const FALLBACK_RELOAD_MS = 2000;

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

/** SW 登録を開始し、更新検知（onNeedRefresh）を能動的にハンドルする。 */
export function initUpdateRegistration(): void {
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
      // 起動時に一度だけ更新確認する（mypace 由来）。オフライン等の失敗は無視してよい。
      registration?.update().catch(() => {});
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
    },
  });
}

initUpdateRegistration();
