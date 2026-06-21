import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ActivityHeatmap from "./ActivityHeatmap.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";

afterEach(() => cleanup());

function post(daysAgo: number, id = `p${daysAgo}`): FeedPost {
  return {
    pubkey: "a".repeat(64),
    createdAt: Math.floor(Date.now() / 1000) - daysAgo * 86400,
    caption: "",
    imageUrls: ["x.jpg"],
    imageUrl: "x.jpg",
    hashtags: [],
    shotDates: [],    id,
  };
}

describe("ActivityHeatmap（#272 段階4・活動の草）", () => {
  it("投稿ゼロは節ごと出さない", () => {
    render(<ActivityHeatmap posts={[]} />);
    expect(screen.queryByText("活動の草")).not.toBeInTheDocument();
  });

  it("投稿があれば見出し・ヒートマップ・連続記録を出す", () => {
    const { container } = render(<ActivityHeatmap posts={[post(0), post(1), post(2)]} />);
    expect(screen.getByText("活動の草")).toBeInTheDocument();
    expect(screen.getByText(/現在の連続/)).toBeInTheDocument();
    expect(screen.getByText(/最長/)).toBeInTheDocument();
    // 週列×7曜日のマスが描画される（13週ぶん＝91マス前後）。
    const cells = container.querySelectorAll("div[aria-hidden] > div > span");
    expect(cells.length).toBeGreaterThan(70);
  });

  it("曜日軸は英語フル表記7日を省略せず全行に出す（#345）", () => {
    render(<ActivityHeatmap posts={[post(0)]} />);
    for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  it("曜日ラベルはロケールで変えない（ja でも英語フル）", () => {
    // i18n の locale は描画時に解決されるが、曜日軸は #345 で全言語固定＝英語のまま。
    render(<ActivityHeatmap posts={[post(0)]} />);
    expect(screen.queryByText("日")).not.toBeInTheDocument();
    expect(screen.getByText("Wednesday")).toBeInTheDocument();
  });
});
