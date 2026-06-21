import { describe, expect, it } from "vitest";
import { buildCityHallBook, type HubLink } from "./cityHall.ts";

// 市役所ハブ（P2・#163）のリンクデータの正本テスト。
// 役所が「開庁」したか（実在ルート）／「近日開庁」（route:null）かを、
// 表示テキストでなくデータ側で固定する（cityHall.ts が単一ソース・#160）。

function hubLinks(): HubLink[] {
  const page2 = buildCityHallBook("ja").find((p) => p.page === 2);
  expect(page2?.kind).toBe("hub");
  // 型ナローイング（hub ページのみ groups を持つ）。群をまたいで全リンクを平らに見る（#263）。
  return page2 && page2.kind === "hub" ? page2.groups.flatMap((g) => g.links) : [];
}

function findLink(label: string): HubLink {
  const link = hubLinks().find((l) => l.label === label);
  expect(link, `ハブに「${label}」が無い`).toBeDefined();
  return link!;
}

describe("市役所ハブのリンク（cityHall.ts P2）", () => {
  it("住民投票（#160）は /vote へ開庁している（route が /vote の実リンク）", () => {
    const vote = findLink("住民投票");
    expect(vote.route).toBe("/vote");
  });

  it("住民投票以外の市民系役所（品評会/市長ブログ/街の地図）は近日開庁のまま（route:null）", () => {
    for (const label of ["品評会（コンテスト）", "市長ブログ", "街の地図"]) {
      const link = findLink(label);
      expect(link.route, `${label} はまだ近日開庁のはず`).toBeNull();
      expect(link.comingSoon).toBe("近日開庁");
    }
  });

  it("既存の実在役所のルートは変わっていない（回帰防止）", () => {
    expect(findLink("みんなの植物（フィード）").route).toBe("/discover");
    expect(findLink("あなたの植物").route).toBe("/me");
    expect(findLink("投稿する").route).toBe("/compose");
    expect(findLink("人気ランキング").route).toBe("/ranking");
  });
});
