import { describe, expect, it } from "vitest";
import { solarPhase, solarPhaseOf } from "./solarPhase.ts";

// 八節大別の正本テスト（#231 後段①）。節の境界（開始日）を固定する。

describe("solarPhase（月日 → 八節）", () => {
  it("各節の開始日ちょうどでその節に入る", () => {
    expect(solarPhase(2, 4)).toBe("risshun");
    expect(solarPhase(3, 20)).toBe("shunbun");
    expect(solarPhase(5, 5)).toBe("rikka");
    expect(solarPhase(6, 21)).toBe("geshi");
    expect(solarPhase(8, 7)).toBe("risshu");
    expect(solarPhase(9, 23)).toBe("shubun");
    expect(solarPhase(11, 7)).toBe("ritto");
    expect(solarPhase(12, 22)).toBe("toji");
  });

  it("各節の開始前日はひとつ前の節", () => {
    expect(solarPhase(2, 3)).toBe("toji"); // 立春の前日は冬至
    expect(solarPhase(3, 19)).toBe("risshun");
    expect(solarPhase(5, 4)).toBe("shunbun");
    expect(solarPhase(6, 20)).toBe("rikka"); // 夏至の前日＝今日（2026-06-20）は立夏
    expect(solarPhase(8, 6)).toBe("geshi");
    expect(solarPhase(9, 22)).toBe("risshu");
    expect(solarPhase(11, 6)).toBe("shubun");
    expect(solarPhase(12, 21)).toBe("ritto");
  });

  it("冬至は年をまたぐ（12/22〜翌1〜2/3）", () => {
    expect(solarPhase(12, 31)).toBe("toji");
    expect(solarPhase(1, 1)).toBe("toji");
    expect(solarPhase(1, 31)).toBe("toji");
  });
});

describe("solarPhaseOf（Date → 八節・JST）", () => {
  it("JST の月日で判定する（UTC からの換算）", () => {
    // 2026-06-20T05:00:00Z = JST 6/20 14:00 → 立夏
    expect(solarPhaseOf(new Date("2026-06-20T05:00:00Z"))).toBe("rikka");
    // 2026-06-20T15:30:00Z = JST 6/21 00:30 → 夏至
    expect(solarPhaseOf(new Date("2026-06-20T15:30:00Z"))).toBe("geshi");
    // 2026-12-31T20:00:00Z = JST 翌 1/1 05:00 → 冬至
    expect(solarPhaseOf(new Date("2026-12-31T20:00:00Z"))).toBe("toji");
  });
});
