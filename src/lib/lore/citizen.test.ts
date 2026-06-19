import { describe, expect, it } from "vitest";
import {
  type CitizenLevel,
  citizenLevel,
  citizenLevelLabel,
  defaultPage,
  maxUnlockedPage,
  TENURE_DAYS,
  TENURE_POSTS,
} from "./citizen.ts";

// テスト用の固定 now（unix 秒）。2026-06-18 頃。
const NOW = 1781913600;
const DAY = 86400;

describe("citizenLevel", () => {
  it("L0: 表示名が無ければ訪問者（投稿があっても名前が無ければ L0）", () => {
    expect(citizenLevel({ hasName: false, postCount: 0, earliestCreatedAt: null, now: NOW })).toBe(0);
    // 名前が無いと、投稿が古く多くても訪問者のまま（移住届＝名乗りが市民の条件）。
    expect(
      citizenLevel({ hasName: false, postCount: 99, earliestCreatedAt: NOW - 365 * DAY, now: NOW }),
    ).toBe(0);
  });

  it("L1: 名前だけ（投稿ゼロ）は市民", () => {
    expect(citizenLevel({ hasName: true, postCount: 0, earliestCreatedAt: null, now: NOW })).toBe(1);
  });

  it("L1: 名前＋少数の投稿（古参の投稿数に満たない）は市民", () => {
    expect(
      citizenLevel({
        hasName: true,
        postCount: TENURE_POSTS - 1,
        earliestCreatedAt: NOW - 100 * DAY,
        now: NOW,
      }),
    ).toBe(1);
  });

  it("L1: 名前＋十分な投稿数でも、最古投稿が新しすぎれば市民（在籍が浅い）", () => {
    expect(
      citizenLevel({
        hasName: true,
        postCount: TENURE_POSTS + 10,
        earliestCreatedAt: NOW - (TENURE_DAYS - 1) * DAY,
        now: NOW,
      }),
    ).toBe(1);
  });

  it("L2: 名前＋投稿数 >= 5 ＋ 在籍 >= 14 日 は古参", () => {
    expect(
      citizenLevel({
        hasName: true,
        postCount: TENURE_POSTS,
        earliestCreatedAt: NOW - TENURE_DAYS * DAY,
        now: NOW,
      }),
    ).toBe(2);
  });

  it("境界: ちょうど 5 投稿・ちょうど 14 日 で L2（>= 判定）", () => {
    expect(
      citizenLevel({
        hasName: true,
        postCount: 5,
        earliestCreatedAt: NOW - 14 * DAY,
        now: NOW,
      }),
    ).toBe(2);
  });

  it("境界: 4 投稿（14 日経過）は L1（投稿数が 1 足りない）", () => {
    expect(
      citizenLevel({ hasName: true, postCount: 4, earliestCreatedAt: NOW - 14 * DAY, now: NOW }),
    ).toBe(1);
  });

  it("境界: 14 日に 1 秒足りなければ L1", () => {
    expect(
      citizenLevel({
        hasName: true,
        postCount: 5,
        earliestCreatedAt: NOW - 14 * DAY + 1,
        now: NOW,
      }),
    ).toBe(1);
  });

  it("古参条件でも earliestCreatedAt が null（投稿が無い）なら L1 止まり", () => {
    expect(
      citizenLevel({ hasName: true, postCount: 10, earliestCreatedAt: null, now: NOW }),
    ).toBe(1);
  });
});

describe("maxUnlockedPage", () => {
  it("L0 → 1 / L1 → 2 / L2 → 4", () => {
    expect(maxUnlockedPage(0)).toBe(1);
    expect(maxUnlockedPage(1)).toBe(2);
    expect(maxUnlockedPage(2)).toBe(4);
  });
});

describe("defaultPage", () => {
  it("L0 → 1 / L1 → 2 / L2 → 2（奥は前送りで辿る）", () => {
    const cases: Array<[CitizenLevel, number]> = [
      [0, 1],
      [1, 2],
      [2, 2],
    ];
    for (const [level, expected] of cases) {
      expect(defaultPage(level)).toBe(expected);
    }
  });

  it("既定ページは常に maxUnlockedPage 以下（解放済みページを指す）", () => {
    const levels: CitizenLevel[] = [0, 1, 2];
    for (const level of levels) {
      expect(defaultPage(level)).toBeLessThanOrEqual(maxUnlockedPage(level));
    }
  });
});

describe("citizenLevelLabel（旅人/市民/市民Ln・#272）", () => {
  it("0 以下は旅人（まだ名乗っていない＝市民でない）", () => {
    expect(citizenLevelLabel(0)).toBe("旅人");
    expect(citizenLevelLabel(-1)).toBe("旅人");
  });
  it("1 は市民", () => {
    expect(citizenLevelLabel(1)).toBe("市民");
  });
  it("2 以上は市民Ln（古参という別語は使わない）", () => {
    expect(citizenLevelLabel(2)).toBe("市民L2");
    expect(citizenLevelLabel(3)).toBe("市民L3");
    expect(citizenLevelLabel(10)).toBe("市民L10");
  });
});
