import { describe, expect, it } from "vitest";
import {
  activityHeatmap,
  activityLevel,
  jstDayIndex,
  postActiveDays,
  streaks,
  weekdayOf,
  ymdToJstDayIndex,
} from "./activity.ts";
import type { FeedPost } from "./parse.ts";

const DAY = 86400;
// 鼓門 JST の暦日 D の正午（JST）の unix 秒。jstDayIndex(noon(D)) === D。
function noon(dayIndex: number): number {
  return dayIndex * DAY + 12 * 3600 - 9 * 3600;
}
function post(dayIndex: number, id = `p${dayIndex}`, shotDates: string[] = []): FeedPost {
  return {
    pubkey: "a".repeat(64),
    createdAt: noon(dayIndex),
    caption: "",
    imageUrls: ["x.jpg"],
    imageUrl: "x.jpg",
    hashtags: [],
    shotDates,
    id,
  };
}

describe("ymdToJstDayIndex / postActiveDays（#324・撮影日）", () => {
  it("YYYY-MM-DD を JST 暦日インデックスに（jstDayIndex と整合）", () => {
    // 2024-06-15 の暦日インデックスは、その日の正午 JST の jstDayIndex と一致する。
    const idx = ymdToJstDayIndex("2024-06-15")!;
    expect(jstDayIndex(noon(idx))).toBe(idx);
    expect(ymdToJstDayIndex("2024-06-16")).toBe(idx + 1);
    expect(ymdToJstDayIndex("not-a-date")).toBeNull();
    expect(ymdToJstDayIndex("2024-13-40")).toBeNull();
  });

  it("撮影日があればそれを、無ければ投稿日を活動日にする", () => {
    expect(postActiveDays(post(100, "a", ["2024-06-15", "2024-06-16"]))).toEqual([
      ymdToJstDayIndex("2024-06-15"),
      ymdToJstDayIndex("2024-06-16"),
    ]);
    expect(postActiveDays(post(20000, "b"))).toEqual([20000]); // 撮影日なし→投稿日
  });
});

describe("jstDayIndex / weekdayOf", () => {
  it("JST の日境界で切り替わる（23:00 JST と翌 01:00 JST は別日）", () => {
    // 2024-01-01 00:00 JST = unix 1704034800。
    const jan1_2300 = 1704034800 + 23 * 3600;
    const jan2_0100 = 1704034800 + 25 * 3600;
    expect(jstDayIndex(jan2_0100)).toBe(jstDayIndex(jan1_2300) + 1);
  });
  it("1970-01-01（暦日0）は木曜＝weekday 4", () => {
    expect(weekdayOf(0)).toBe(4);
    expect(weekdayOf(3)).toBe(0); // 1970-01-04 は日曜
  });
});

describe("activityLevel", () => {
  it("撮影枚数を 0〜3 段階に量子化（0=なし / 1=少 / 2=中 / 3〜=多・#440）", () => {
    expect(activityLevel(0)).toBe(0);
    expect(activityLevel(1)).toBe(1);
    expect(activityLevel(2)).toBe(2);
    expect(activityLevel(3)).toBe(3);
    expect(activityLevel(5)).toBe(3);
  });
});

describe("activityHeatmap", () => {
  const today = 20000; // 任意の暦日
  const now = noon(today);

  it("週列×7曜日で、今日を含み・日曜始まりで並ぶ", () => {
    const grid = activityHeatmap([], now, 12);
    expect(grid.length).toBeGreaterThanOrEqual(12);
    for (const col of grid) expect(col).toHaveLength(7);
    // 各列の先頭は日曜（weekday 0）。
    for (const col of grid) {
      const firstReal = col.find((c) => c.day !== null);
      if (firstReal && col[0]!.day !== null) expect(weekdayOf(col[0]!.day)).toBe(0);
    }
    // 末尾列に今日が含まれる。
    const last = grid[grid.length - 1]!;
    expect(last.some((c) => c.day === today)).toBe(true);
  });

  it("その日の投稿数がマスに入る（範囲外はパディング day:null）", () => {
    const grid = activityHeatmap([post(today), post(today, "p2"), post(today - 1)], now, 12);
    const flat = grid.flat();
    expect(flat.find((c) => c.day === today)?.count).toBe(2);
    expect(flat.find((c) => c.day === today - 1)?.count).toBe(1);
    // 表示範囲より古い投稿は入らない。
    const old = activityHeatmap([post(today - 200)], now, 12).flat();
    expect(old.every((c) => c.count === 0)).toBe(true);
  });
});

describe("streaks", () => {
  const today = 20000;
  const now = noon(today);

  it("投稿ゼロは 0/0", () => {
    expect(streaks([], now)).toEqual({ current: 0, longest: 0 });
  });

  it("今日から遡る連続を current にする", () => {
    const posts = [post(today), post(today - 1), post(today - 2)];
    expect(streaks(posts, now)).toEqual({ current: 3, longest: 3 });
  });

  it("今日未投稿でも昨日まで続いていれば連続は生存", () => {
    const posts = [post(today - 1), post(today - 2)];
    expect(streaks(posts, now).current).toBe(2);
  });

  it("一昨日までで途切れていれば current は 0（最長は残る）", () => {
    const posts = [post(today - 3), post(today - 4), post(today - 5)];
    const s = streaks(posts, now);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(3);
  });

  it("最長は飛びを跨いで最大ランを採る", () => {
    const posts = [
      post(today - 10),
      post(today - 9), // run 2
      post(today - 5),
      post(today - 4),
      post(today - 3),
      post(today - 2), // run 4（最長）
    ];
    expect(streaks(posts, now).longest).toBe(4);
  });

  it("同日複数投稿は1日として数える", () => {
    const posts = [post(today, "a"), post(today, "b"), post(today - 1)];
    expect(streaks(posts, now).current).toBe(2);
  });

  it("週末まとめ投稿でも撮った日数ぶん連続になる（#324・撮影日基準）", () => {
    // 1投稿に7日ぶんの撮影日（毎日撮って日曜にまとめ投稿）。投稿は1回でも連続7日になる。
    const dates = ["2024-06-10", "2024-06-11", "2024-06-12", "2024-06-13", "2024-06-14", "2024-06-15", "2024-06-16"];
    const lastIdx = ymdToJstDayIndex("2024-06-16")!;
    const sundayPost = post(lastIdx, "batch", dates);
    const s = streaks([sundayPost], noon(lastIdx));
    expect(s.longest).toBe(7);
    expect(s.current).toBe(7); // 最終撮影日が今日＝今日まで連続
    // ヒートマップにも7日ぶん点く（各日 count 1）。
    const flat = activityHeatmap([sundayPost], noon(lastIdx), 12).flat();
    expect(flat.filter((c) => c.count > 0)).toHaveLength(7);
  });
});
