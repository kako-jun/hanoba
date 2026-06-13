// モーダルのフォーカストラップ（a11y）。
// 純粋関数 focusTrapTarget はテスト可能。DOM 走査 getFocusableElements は薄い補助。

/**
 * Tab / Shift+Tab でフォーカスを循環させるとき、次にフォーカスすべき要素を返す（純粋）。
 *
 * - 末尾で Tab（!shift）→ 先頭へ。
 * - 先頭で Shift+Tab → 末尾へ。
 * - それ以外（中間・対象外）は null（ブラウザ既定の移動に任せる）。
 *
 * focusables は文書順の focusable 要素列、active は現在フォーカス中の要素。
 */
export function focusTrapTarget<T>(focusables: T[], active: T | null, shift: boolean): T | null {
  if (focusables.length === 0) return null;
  const first = focusables[0]!;
  const last = focusables[focusables.length - 1]!;
  if (shift && active === first) return last;
  if (!shift && active === last) return first;
  return null;
}

// 文書順の focusable 要素を集める対象セレクタ。
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * コンテナ内の可視な focusable 要素を文書順で返す。
 * 非表示（offsetParent が null）は除くが、現在フォーカス中の要素は残す。
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const all = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return all.filter((el) => el.offsetParent !== null || el === document.activeElement);
}
