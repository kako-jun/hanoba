import { describe, expect, it } from "vitest";
import {
  type CitizenLevel,
  CITIZEN_TIERS,
  citizenLevel,
  citizenLevelFull,
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

describe("citizenLevelFull（市民Ln 非キャップ・#272 段階2・複合 居住×投稿 AND）", () => {
  it("旅人/市民は citizenLevel と一致（L0/L1）", () => {
    expect(citizenLevelFull({ hasName: false, postCount: 99, earliestCreatedAt: NOW - 999 * DAY, now: NOW })).toBe(0);
    expect(citizenLevelFull({ hasName: true, postCount: 0, earliestCreatedAt: null, now: NOW })).toBe(1);
  });

  it("各 tier はちょうどのしきい値（投稿 かつ 居住）で到達する（>= 両軸 AND）", () => {
    for (const tier of CITIZEN_TIERS) {
      expect(
        citizenLevelFull({
          hasName: true,
          postCount: tier.minPosts,
          earliestCreatedAt: NOW - tier.minDays * DAY,
          now: NOW,
        }),
      ).toBe(tier.level);
    }
  });

  it("片軸だけ満たしても昇格しない（投稿は L4 だが居住が L3 止まり → L3）", () => {
    // 投稿40（L4 のしきい値）だが居住は 30 日（L3 のしきい値・L4 は 90 日要）→ L3。
    expect(
      citizenLevelFull({ hasName: true, postCount: 40, earliestCreatedAt: NOW - 30 * DAY, now: NOW }),
    ).toBe(3);
  });

  it("居住日数の境界は floor で判定（L3 の 30 日に 1 秒足りなければ L2 のまま）", () => {
    // 投稿は L3 のしきい値(15)を満たすが、居住が 30 日に 1 秒足りない → L2 止まり（floor(sec/日)>=30 が偽）。
    expect(
      citizenLevelFull({ hasName: true, postCount: 15, earliestCreatedAt: NOW - 30 * DAY + 1, now: NOW }),
    ).toBe(2);
    // ちょうど 30 日なら L3。
    expect(
      citizenLevelFull({ hasName: true, postCount: 15, earliestCreatedAt: NOW - 30 * DAY, now: NOW }),
    ).toBe(3);
  });

  it("両軸を超えても満たす最上位 tier に丸める（投稿200・居住500日 → 最上位 L6）", () => {
    const top = CITIZEN_TIERS[CITIZEN_TIERS.length - 1]!;
    expect(
      citizenLevelFull({ hasName: true, postCount: 200, earliestCreatedAt: NOW - 500 * DAY, now: NOW }),
    ).toBe(top.level);
  });

  it("citizenLevel は citizenLevelFull を 2 で頭打ちにする（CityHallBook 不変）", () => {
    const input = { hasName: true, postCount: 200, earliestCreatedAt: NOW - 500 * DAY, now: NOW };
    expect(citizenLevelFull(input)).toBeGreaterThan(2);
    expect(citizenLevel(input)).toBe(2);
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
