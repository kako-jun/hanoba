// モーション抑制（prefers-reduced-motion）の検出（#275）。
// DandelionBurst / ScrollToTop が各自で持っていた同じ判定を一本化し、
// スワイプ中ぼかし（PostDetail / CityHallBook）からも共有する。
//
// SSR / matchMedia 不在時は安全に「抑制なし」(false) とみなす。
// React/DOM には依存しない（呼ぶ瞬間の OS 設定を都度読むだけ）。

/** OS の「視差効果を減らす」設定が有効か。SSR・matchMedia 不在は false。 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
