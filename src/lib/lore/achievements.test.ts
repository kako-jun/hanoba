import { describe, expect, it } from "vitest";
import { BADGES, badgeHint, evaluateBadges, unlockedBadgeCount, type BadgeInput } from "./achievements.ts";

const ZERO: BadgeInput = { postCount: 0, photoCount: 0, varietyCount: 0, tenureDays: 0 };

describe("achievements（実績バッジ・#272 段階2）", () => {
  it("何も無い市民は全バッジ未解除", () => {
    const badges = evaluateBadges(ZERO);
    expect(badges).toHaveLength(BADGES.length);
    expect(badges.every((b) => !b.unlocked)).toBe(true);
    expect(unlockedBadgeCount(ZERO)).toBe(0);
  });

  it("投稿1件で『初めの一鉢』だけ解除", () => {
    const input: BadgeInput = { ...ZERO, postCount: 1 };
    const byKey = Object.fromEntries(evaluateBadges(input).map((b) => [b.def.key, b.unlocked]));
    expect(byKey["first-pot"]).toBe(true);
    expect(byKey["pots-10"]).toBe(false);
    expect(unlockedBadgeCount(input)).toBe(1);
  });

  it("しきい値ちょうどで解除（境界・>=）", () => {
    expect(unlockedBadgeCount({ ...ZERO, postCount: 10 })).toBe(2); // first-pot + pots-10
    expect(evaluateBadges({ ...ZERO, postCount: 9 }).find((b) => b.def.key === "pots-10")!.unlocked).toBe(false);
  });

  it("metric ごとに独立して解除する（投稿/写真/品種/居住）", () => {
    const input: BadgeInput = { postCount: 50, photoCount: 100, varietyCount: 30, tenureDays: 365 };
    const byKey = Object.fromEntries(evaluateBadges(input).map((b) => [b.def.key, b.unlocked]));
    expect(byKey["pots-50"]).toBe(true);
    expect(byKey["pots-100"]).toBe(false);
    expect(byKey["photos-100"]).toBe(true);
    expect(byKey["species-30"]).toBe(true);
    expect(byKey["tenure-365"]).toBe(true);
  });

  it("品種カタログ未ロード相当（varietyCount=0）では品種バッジは未解除のまま", () => {
    const input: BadgeInput = { postCount: 100, photoCount: 200, varietyCount: 0, tenureDays: 400 };
    const byKey = Object.fromEntries(evaluateBadges(input).map((b) => [b.def.key, b.unlocked]));
    expect(byKey["species-10"]).toBe(false);
    expect(byKey["species-30"]).toBe(false);
    // 他系統はちゃんと解除される。
    expect(byKey["pots-100"]).toBe(true);
  });

  it("badgeHint は metric としきい値から解除条件を作る", () => {
    const speciesBadge = BADGES.find((b) => b.key === "species-10")!;
    expect(badgeHint(speciesBadge)).toBe("育てた品種が10種で開きます。");
    const tenureBadge = BADGES.find((b) => b.key === "tenure-30")!;
    expect(badgeHint(tenureBadge)).toBe("居住が30日で開きます。");
  });

  it("バッジの key は一意", () => {
    const keys = BADGES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
