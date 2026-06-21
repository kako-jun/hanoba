import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// #147 go-live で公開既定（DEFAULT_LOCALE）を en にしたため、`resolveClientLocale()` を mount で呼ぶ
// 島コンポーネント（FeedGrid/MyGrid/PostFAB 等）は既定だと en で描かれる。**テストは原典の日本語で
// 検証する**方針なので、各テスト前に locale 設定（localStorage `hanoba:lang`）を ja に固定する。
// localStorage を自前で clear/設定するテスト（clientLocale.test の DEFAULT 検証など）は、自身の
// beforeEach がこの後に走って上書きするので干渉しない。
beforeEach(() => {
  try {
    localStorage.setItem("hanoba:lang", "ja");
  } catch {
    /* localStorage 不在の環境では何もしない（happy-dom では存在する）。 */
  }
});
