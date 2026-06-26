import { describe, expect, it } from "vitest";
import { buildCityHallBook, type HubLink } from "./cityHall.ts";

// 街の地図（P2・図鑑の早期ご褒美ページ・#469）の正本テスト。
// 機能導線（discover/ranking/me/compose）はヘッダ/フッタが持つので手帳からは外し、
// 地図には名所（ランドマーク）と「市政の窓口」strip（住民投票＋近日開庁）だけを残す。
// 役所が「開庁」したか（実在ルート）／「近日開庁」（route:null）かを、表示テキストでなく
// データ側で固定する（cityHall.ts が単一ソース・#160）。

function mapPage() {
  const page2 = buildCityHallBook("ja").find((p) => p.page === 2);
  expect(page2?.kind).toBe("map");
  return page2 && page2.kind === "map" ? page2 : null;
}

function civicLinks(): HubLink[] {
  return mapPage()?.civic ?? [];
}

function findCivic(label: string): HubLink {
  const link = civicLinks().find((l) => l.label === label);
  expect(link, `市政の窓口に「${label}」が無い`).toBeDefined();
  return link!;
}

describe("街の地図ページ（cityHall.ts P2・#469）", () => {
  it("page2 は kind:\"map\" で、地図の名所（ランドマーク）を持つ", () => {
    const page = mapPage();
    expect(page).not.toBeNull();
    expect(page!.landmarks.length).toBe(3);
    // 葉脈川がランドマークとして並ぶ（読み物の中身が在ることを固定）。
    expect(page!.landmarks.map((l) => l.name)).toContain("葉脈川");
    // 各ランドマークは名と説明を持つ。
    for (const lm of page!.landmarks) {
      expect(lm.name.length).toBeGreaterThan(0);
      expect(lm.text.length).toBeGreaterThan(0);
    }
    // 末尾に注記（地図はまだ描きかけ）。
    expect(page!.note.length).toBeGreaterThan(0);
    // 地図イラストは未生成＝image は null（#137 で webp パスを入れるまでの前方互換スロット・#469）。
    expect(page!.image).toBeNull();
  });

  it("市政の窓口は住民投票・品評会・市長ブログの3件だけ（discover 等の機能導線は手帳から外す）", () => {
    const labels = civicLinks().map((l) => l.label);
    expect(labels).toEqual(["住民投票", "品評会（コンテスト）", "市長ブログ"]);
  });

  it("住民投票（#160）は /vote へ開庁している（route が /vote の実リンク・退避先として健在）", () => {
    expect(findCivic("住民投票").route).toBe("/vote");
  });

  it("品評会/市長ブログは近日開庁のまま（route:null）", () => {
    for (const label of ["品評会（コンテスト）", "市長ブログ"]) {
      const link = findCivic(label);
      expect(link.route, `${label} はまだ近日開庁のはず`).toBeNull();
      expect(link.comingSoon).toBe("近日開庁");
    }
  });
});

// 全ページ冒頭に市長の言葉を必須化（#469 変更B）。welcome(lead相当の歓迎辞)・map(lead)に加え、
// chronicle(P3)・ordinances(P4) も冒頭に市長の前口上 lead を持つ。
describe("全ページ冒頭の市長 lead（#469 変更B）", () => {
  it("沿革（P3）・条文（P4）に市長の前口上 lead がある（おっほん。で始まる）", () => {
    const book = buildCityHallBook("ja");
    const p3 = book.find((p) => p.page === 3);
    const p4 = book.find((p) => p.page === 4);
    expect(p3?.kind).toBe("chronicle");
    expect(p4?.kind).toBe("ordinances");
    if (p3?.kind === "chronicle") {
      expect(p3.lead.length).toBeGreaterThan(0);
      expect(p3.lead.startsWith("おっほん")).toBe(true);
    }
    if (p4?.kind === "ordinances") {
      expect(p4.lead.length).toBeGreaterThan(0);
      expect(p4.lead.startsWith("おっほん")).toBe(true);
    }
  });
});
