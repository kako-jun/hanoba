import { beforeEach, describe, expect, it } from "vitest";
import {
  DISMISS_DURATION_MS,
  getInstallDismissedAt,
  isDismissActive,
  setInstallDismissedAt,
} from "./install.ts";

const KEY = "hanoba:pwa-install-dismissed-at";

describe("pwa install dismiss state", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("初期状態は却下時刻なし（null）", () => {
    expect(getInstallDismissedAt()).toBeNull();
  });

  it("set した時刻を読み戻せる", () => {
    setInstallDismissedAt(1700000000000);
    expect(getInstallDismissedAt()).toBe(1700000000000);
  });

  it("壊れた保存値は null に倒す", () => {
    window.localStorage.setItem(KEY, "not-a-number");
    expect(getInstallDismissedAt()).toBeNull();
  });

  describe("isDismissActive（純関数）", () => {
    it("未却下（null）は抑制しない", () => {
      expect(isDismissActive(null, Date.now())).toBe(false);
    });

    it("却下直後は抑制中", () => {
      const t = 1_000_000;
      expect(isDismissActive(t, t)).toBe(true);
    });

    it("期間内（7日未満）は抑制中", () => {
      const t = 1_000_000;
      expect(isDismissActive(t, t + DISMISS_DURATION_MS - 1)).toBe(true);
    });

    it("期間切れ（ちょうど7日経過）は抑制しない", () => {
      const t = 1_000_000;
      expect(isDismissActive(t, t + DISMISS_DURATION_MS)).toBe(false);
    });

    it("未来時刻（時計巻き戻し）も保守的に抑制中とみなす", () => {
      const t = 2_000_000;
      expect(isDismissActive(t, 1_000_000)).toBe(true);
    });
  });
});
