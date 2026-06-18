// PWA インストール促し（#230）の「却下を記憶する」実行時状態。
//
// 「ホーム画面に追加」バナーを一度閉じたら、しばらく出さない（うるさくしない）。
// これは不変の Def でなく**実行時状態**なので、taxonomy 等と別管理（DESIGN の Def/状態分離）。
// 表示の判定（beforeinstallprompt 捕捉・既設置・iOS 分岐）はコンポーネント側の責務で、
// このモジュールは却下時刻の保存/読み出しと「今は抑制中か」の純粋判定だけを持つ（単一責務）。
// 却下記憶のしくみは mypace 由来（installDismissedAt 相当）。
// SSR 安全: localStorage は必ず関数内で参照する（keys.ts / recent-tags.ts と同じ getLS パターン）。

const KEY = "hanoba:pwa-install-dismissed-at";

/** 却下後に再表示を抑制する期間（ミリ秒）。mypace に合わせて 7 日。 */
export const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/** SSR 安全に localStorage を取得する（サーバ評価時は null）。 */
function getLS(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** 却下時刻（epoch ミリ秒）を返す。未却下・壊れた値は null。 */
export function getInstallDismissedAt(): number | null {
  const raw = getLS()?.getItem(KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 却下時刻を記録する（[あとで]/× を押した時に呼ぶ）。 */
export function setInstallDismissedAt(timestamp: number): void {
  getLS()?.setItem(KEY, String(timestamp));
}

/**
 * 今この時点で再表示を抑制すべきか（純関数・テスト可能に now を引数で受ける）。
 * 却下時刻から DISMISS_DURATION_MS 以内なら true（出さない）。未却下・期間切れは false。
 * 未来時刻（時計巻き戻し等）も保守的に抑制中とみなす。
 */
export function isDismissActive(
  dismissedAt: number | null,
  now: number,
  durationMs: number = DISMISS_DURATION_MS,
): boolean {
  if (dismissedAt === null) return false;
  return now - dismissedAt < durationMs;
}
