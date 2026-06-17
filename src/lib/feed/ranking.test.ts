import { describe, expect, it } from "vitest";
import { VARIETY_CATALOG } from "../plants/variety-catalog.ts";
import type { FeedPost } from "./parse.ts";
import {
  bucketByWeek,
  isoWeekKey,
  rankRunData,
  rankWithDeltas,
  tallyVarieties,
} from "./ranking.ts";

// 実カタログを使う（buildFuda の同定・dedupe を本物で検証する）。fixture のタグは
// カタログに実在する品種/alias から選ぶ（チタノタ/オテロイ/白鯨/黒鯨＝アガベ、グラキリス/恵比寿笑い＝パキポ、
// オベサ＝ユーフォルビア、デリシオサ＝モンステラ、キンモクセイ(+alias 金木犀)＝花木）。
const catalog = VARIETY_CATALOG;

// 距離のある 3 つの ISO 週（いずれも水曜 12:00 UTC＝週の内側）。
const W23 = 1780488000; // 2026-W23
const W24 = 1781092800; // 2026-W24
const W25 = 1781697600; // 2026-W25（= now の既定）

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? W25,
    caption: overrides.caption ?? "",
    imageUrls: overrides.imageUrls ?? ["https://image.example/x.jpg"],
    imageUrl: overrides.imageUrl ?? "https://image.example/x.jpg",
    hashtags: overrides.hashtags ?? [],
  };
}

describe("isoWeekKey", () => {
  it("月曜始まり・UTC で週キーを出す（ISO 8601）", () => {
    expect(isoWeekKey(1781697600)).toBe("2026-W25"); // 水
    // 同じ週の月曜00:00と日曜23:59は同一キー。
    expect(isoWeekKey(Math.floor(new Date("2026-06-15T00:00:00Z").getTime() / 1000))).toBe("2026-W25");
    expect(isoWeekKey(Math.floor(new Date("2026-06-21T23:59:59Z").getTime() / 1000))).toBe("2026-W25");
    // 翌週月曜は次のキー。
    expect(isoWeekKey(Math.floor(new Date("2026-06-22T00:00:00Z").getTime() / 1000))).toBe("2026-W26");
  });

  it("年またぎは木曜基準で ISO 年を決める", () => {
    // 2025-12-29(月) は ISO で 2026-W01。
    expect(isoWeekKey(Math.floor(new Date("2025-12-29T00:00:00Z").getTime() / 1000))).toBe("2026-W01");
    // 2021-01-01(金) は ISO で 2020-W53。
    expect(isoWeekKey(Math.floor(new Date("2021-01-01T00:00:00Z").getTime() / 1000))).toBe("2020-W53");
    // 2016-01-01(金) は ISO で 2015-W53。
    expect(isoWeekKey(Math.floor(new Date("2016-01-01T00:00:00Z").getTime() / 1000))).toBe("2015-W53");
  });
});

describe("tallyVarieties", () => {
  it("空投稿は空", () => {
    expect(tallyVarieties([], catalog)).toEqual([]);
  });

  it("品種を票数で降順に集計する（投稿ごとに +1）", () => {
    const posts = [
      makePost({ id: "1", hashtags: ["チタノタ"] }),
      makePost({ id: "2", hashtags: ["チタノタ"] }),
      makePost({ id: "3", hashtags: ["オベサ"] }),
    ];
    const got = tallyVarieties(posts, catalog);
    expect(got.map((r) => [r.name, r.count])).toEqual([
      ["チタノタ", 2],
      ["オベサ", 1],
    ]);
  });

  it("学名は catalog の sci を持つ", () => {
    const got = tallyVarieties([makePost({ id: "1", hashtags: ["チタノタ"] })], catalog);
    expect(got[0]?.sci).toBe("Agave titanota");
  });

  it("1投稿が複数品種を持てば各品種に1票", () => {
    const posts = [makePost({ id: "1", hashtags: ["チタノタ", "オベサ", "グラキリス"] })];
    const got = tallyVarieties(posts, catalog);
    expect(got.map((r) => r.name).sort()).toEqual(["オベサ", "グラキリス", "チタノタ"].sort());
    expect(got.every((r) => r.count === 1)).toBe(true);
  });

  it("同一投稿内の alias 違いの同一品種は buildFuda が畳むので1票（二重計上しない）", () => {
    // キンモクセイ（canonical）と 金木犀（alias）は同じ品種＝1票・canonical 名に寄る。
    const posts = [makePost({ id: "1", hashtags: ["キンモクセイ", "金木犀"] })];
    const got = tallyVarieties(posts, catalog);
    expect(got).toHaveLength(1);
    expect(got[0]?.name).toBe("キンモクセイ");
    expect(got[0]?.count).toBe(1);
  });

  it("同数は初出順で安定（後から出た品種は後ろ）", () => {
    const posts = [
      makePost({ id: "1", hashtags: ["オベサ"] }), // 先に出る
      makePost({ id: "2", hashtags: ["チタノタ"] }), // 後に出る
    ];
    const got = tallyVarieties(posts, catalog);
    expect(got.map((r) => r.name)).toEqual(["オベサ", "チタノタ"]); // 同数1票・初出順
  });

  it("カタログに無いタグ（世話/記録など）は集計しない", () => {
    const posts = [makePost({ id: "1", hashtags: ["水やり", "チタノタ", "成長記録"] })];
    const got = tallyVarieties(posts, catalog);
    expect(got.map((r) => r.name)).toEqual(["チタノタ"]);
  });
});

describe("bucketByWeek", () => {
  it("週キーでバケットし、古い→新しい順で返す", () => {
    const posts = [
      makePost({ id: "new", createdAt: W25 }),
      makePost({ id: "old", createdAt: W23 }),
      makePost({ id: "mid", createdAt: W24 }),
    ];
    const got = bucketByWeek(posts);
    expect([...got.keys()]).toEqual(["2026-W23", "2026-W24", "2026-W25"]);
    expect(got.get("2026-W23")?.map((p) => p.id)).toEqual(["old"]);
  });

  it("空投稿は空 Map", () => {
    expect(bucketByWeek([]).size).toBe(0);
  });
});

describe("rankWithDeltas", () => {
  it("空投稿は空ランキング", () => {
    expect(rankWithDeltas([], catalog, W25)).toEqual([]);
  });

  it("週が1つだけ（初週）なら全行が NEW（偽の up/down を出さない）", () => {
    const posts = [
      makePost({ id: "1", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "2", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "3", hashtags: ["オベサ"], createdAt: W25 }),
    ];
    const got = rankWithDeltas(posts, catalog, W25);
    expect(got.map((r) => [r.rank, r.name, r.delta.kind])).toEqual([
      [1, "チタノタ", "new"],
      [2, "オベサ", "new"],
    ]);
  });

  it("先週比で up/down/same を出す", () => {
    const posts = [
      // 先週(W24): チタノタ=2(1位), オベサ=1(2位)
      makePost({ id: "p1", hashtags: ["チタノタ"], createdAt: W24 }),
      makePost({ id: "p2", hashtags: ["チタノタ"], createdAt: W24 }),
      makePost({ id: "p3", hashtags: ["オベサ"], createdAt: W24 }),
      // 今週(W25): オベサ=3(1位↑1), チタノタ=2(2位↓1), グラキリス=1(3位 NEW)
      makePost({ id: "c1", hashtags: ["オベサ"], createdAt: W25 }),
      makePost({ id: "c2", hashtags: ["オベサ"], createdAt: W25 }),
      makePost({ id: "c3", hashtags: ["オベサ"], createdAt: W25 }),
      makePost({ id: "c4", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "c5", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "c6", hashtags: ["グラキリス"], createdAt: W25 }),
    ];
    const got = rankWithDeltas(posts, catalog, W25);
    expect(got.map((r) => [r.rank, r.name, r.delta])).toEqual([
      [1, "オベサ", { kind: "up", by: 1 }],
      [2, "チタノタ", { kind: "down", by: 1 }],
      [3, "グラキリス", { kind: "new" }],
    ]);
  });

  it("順位が変わらなければ same(by:0)", () => {
    const posts = [
      // 先週(W24): チタノタ=2(1位), オベサ=1(2位)
      makePost({ id: "p1", hashtags: ["チタノタ"], createdAt: W24 }),
      makePost({ id: "p2", hashtags: ["チタノタ"], createdAt: W24 }),
      makePost({ id: "p3", hashtags: ["オベサ"], createdAt: W24 }),
      // 今週(W25): 同じ順位（チタノタ1位・オベサ2位）
      makePost({ id: "c1", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "c2", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "c3", hashtags: ["オベサ"], createdAt: W25 }),
    ];
    const got = rankWithDeltas(posts, catalog, W25);
    expect(got.map((r) => [r.name, r.delta])).toEqual([
      ["チタノタ", { kind: "same", by: 0 }],
      ["オベサ", { kind: "same", by: 0 }],
    ]);
  });

  it("RE: 過去週(W23)に居て、直前週(W24)に居らず、今週(W25)に復帰した品種は再浮上", () => {
    const posts = [
      // W23: グラキリスが載る
      makePost({ id: "a", hashtags: ["グラキリス"], createdAt: W23 }),
      // W24: グラキリスは居ない（別品種のみ）。直前週を成立させる。
      makePost({ id: "b", hashtags: ["チタノタ"], createdAt: W24 }),
      // W25: グラキリス復帰（RE）＋ オベサ（過去に一度も無い＝NEW）
      makePost({ id: "c", hashtags: ["グラキリス"], createdAt: W25 }),
      makePost({ id: "d", hashtags: ["オベサ"], createdAt: W25 }),
    ];
    const got = rankWithDeltas(posts, catalog, W25);
    const byName = new Map(got.map((r) => [r.name, r.delta.kind]));
    expect(byName.get("グラキリス")).toBe("re");
    expect(byName.get("オベサ")).toBe("new");
  });

  it("直前週に居なくても過去に一度も無ければ NEW（RE ではない）", () => {
    const posts = [
      // W24（直前週）: チタノタのみ
      makePost({ id: "b", hashtags: ["チタノタ"], createdAt: W24 }),
      // W25: 完全新規のオベサ
      makePost({ id: "c", hashtags: ["オベサ"], createdAt: W25 }),
    ];
    const got = rankWithDeltas(posts, catalog, W25);
    expect(got.find((r) => r.name === "オベサ")?.delta.kind).toBe("new");
  });

  it("直前週は「データのある直近の過去週」（カレンダー連続でなくてよい）", () => {
    const posts = [
      // 直近の過去週は W23（W24 は投稿なし）。W23 で オベサ1位/チタノタ2位 → 今週は入れ替え。
      makePost({ id: "p1", hashtags: ["オベサ"], createdAt: W23 }),
      makePost({ id: "p2", hashtags: ["オベサ"], createdAt: W23 }),
      makePost({ id: "p3", hashtags: ["チタノタ"], createdAt: W23 }),
      // 今週(W25): チタノタ=2(1位↑1), オベサ=1(2位↓1)
      makePost({ id: "c1", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "c2", hashtags: ["チタノタ"], createdAt: W25 }),
      makePost({ id: "c3", hashtags: ["オベサ"], createdAt: W25 }),
    ];
    const got = rankWithDeltas(posts, catalog, W25);
    expect(got.map((r) => [r.name, r.delta])).toEqual([
      ["チタノタ", { kind: "up", by: 1 }],
      ["オベサ", { kind: "down", by: 1 }],
    ]);
  });

  it("現在週に投稿が無ければ空ランキング（過去週があっても）", () => {
    const posts = [makePost({ id: "old", hashtags: ["チタノタ"], createdAt: W23 })];
    // now は W25（投稿は W23 のみ）。
    expect(rankWithDeltas(posts, catalog, W25)).toEqual([]);
  });
});

describe("rankRunData", () => {
  // 各 fixture の key は tally で実際に引いて使う（buildFuda の canonical 名に依存しない）。
  const keyOf = (tag: string) => tallyVarieties([makePost({ id: "k", hashtags: [tag] })], catalog)[0]!.key;

  it("週を古い→新しい順に並べ、各系列の counts を週に整列する", () => {
    const titanota = keyOf("チタノタ");
    const obesa = keyOf("オベサ");
    const posts = [
      // W23: チタノタ=2, オベサ=1
      makePost({ id: "a", hashtags: ["チタノタ"], createdAt: W23 }),
      makePost({ id: "b", hashtags: ["チタノタ"], createdAt: W23 }),
      makePost({ id: "c", hashtags: ["オベサ"], createdAt: W23 }),
      // W24: チタノタ=1（オベサは 0）
      makePost({ id: "d", hashtags: ["チタノタ"], createdAt: W24 }),
      // W25: オベサ=3（チタノタは 0）
      makePost({ id: "e", hashtags: ["オベサ"], createdAt: W25 }),
      makePost({ id: "f", hashtags: ["オベサ"], createdAt: W25 }),
      makePost({ id: "g", hashtags: ["オベサ"], createdAt: W25 }),
    ];
    const data = rankRunData(posts, catalog, [titanota, obesa]);
    // 週は古い→新しい。
    expect(data.weeks).toEqual(["2026-W23", "2026-W24", "2026-W25"]);
    // counts は週に整列・keys の順序を保つ。
    expect(data.series.map((s) => s.key)).toEqual([titanota, obesa]);
    expect(data.series[0]).toMatchObject({ name: "チタノタ", counts: [2, 1, 0] });
    expect(data.series[1]).toMatchObject({ name: "オベサ", counts: [1, 0, 3] });
  });

  it("ある週に居ない品種はその週 0（出現の谷を 0 で埋め、線が途切れない）", () => {
    const grak = keyOf("グラキリス");
    const posts = [
      // W23 に出て、W24 は不在、W25 で復帰。間の W24 は 0 で埋まる。
      makePost({ id: "a", hashtags: ["グラキリス"], createdAt: W23 }),
      makePost({ id: "b", hashtags: ["チタノタ"], createdAt: W24 }), // W24 を成立させる別投稿
      makePost({ id: "c", hashtags: ["グラキリス"], createdAt: W25 }),
    ];
    const data = rankRunData(posts, catalog, [grak]);
    expect(data.weeks).toEqual(["2026-W23", "2026-W24", "2026-W25"]);
    expect(data.series[0]?.counts).toEqual([1, 0, 1]); // 谷の W24 が 0
  });

  it("週列は範囲内に欠けが無い（投稿のある全週を漏れなく並べる）", () => {
    const titanota = keyOf("チタノタ");
    const posts = [
      makePost({ id: "a", hashtags: ["チタノタ"], createdAt: W23 }),
      makePost({ id: "b", hashtags: ["オベサ"], createdAt: W24 }),
      makePost({ id: "c", hashtags: ["チタノタ"], createdAt: W25 }),
    ];
    const data = rankRunData(posts, catalog, [titanota]);
    expect(data.weeks).toEqual(["2026-W23", "2026-W24", "2026-W25"]);
    expect(data.series[0]?.counts).toHaveLength(data.weeks.length);
  });

  it("単週なら weeks は1つ・counts も長さ1", () => {
    const titanota = keyOf("チタノタ");
    const data = rankRunData(
      [
        makePost({ id: "a", hashtags: ["チタノタ"], createdAt: W25 }),
        makePost({ id: "b", hashtags: ["チタノタ"], createdAt: W25 }),
      ],
      catalog,
      [titanota],
    );
    expect(data.weeks).toEqual(["2026-W25"]);
    expect(data.series[0]?.counts).toEqual([2]);
  });

  it("空投稿は {weeks:[], series:[]}", () => {
    expect(rankRunData([], catalog, ["チタノタ"])).toEqual({ weeks: [], series: [] });
  });

  it("keys が空なら series は空（週列は出る）", () => {
    const data = rankRunData([makePost({ id: "a", hashtags: ["チタノタ"], createdAt: W25 })], catalog, []);
    expect(data.weeks).toEqual(["2026-W25"]);
    expect(data.series).toEqual([]);
  });

  it("カタログに無い key はどの週でも 0（投稿はあるが票が無い）", () => {
    const data = rankRunData(
      [makePost({ id: "a", hashtags: ["チタノタ"], createdAt: W25 })],
      catalog,
      ["__not_a_real_key__"],
    );
    expect(data.weeks).toEqual(["2026-W25"]);
    // 和名が引けない key は key 自体を name にフォールバックし、counts は全 0。
    expect(data.series[0]).toMatchObject({ key: "__not_a_real_key__", name: "__not_a_real_key__", counts: [0] });
  });
});
