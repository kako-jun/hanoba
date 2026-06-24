import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない）。
// カタログ（variety-catalog）と純ロジック（ranking.ts）は本物を使う＝動的 import は実モジュールに解決される。
const fetchRankingPosts = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchRankingPosts: (...args: unknown[]) => fetchRankingPosts(...args),
}));

// 途中経過チャート（uPlot）は happy-dom では描けない（canvas/window）。RankRunChart は薄いラッパなので
// 内部（uPlot 構築）は検証せず、props として渡る系列の本数だけ見える軽量スタブに差し替える。
// チャートを出すか/出さないかの gate（週が2未満なら出さない）と、上位 N の系列が渡ることを検証する。
// 系列の識別子は学名（sci）のみ（#459＝ランキング・凡例は学名のみ・RankRunSeries に name は無い）。
vi.mock("./RankRunChart.tsx", () => ({
  default: ({ data }: { data: { series: { sci: string }[] } }) => (
    <div data-testid="rank-run-chart" data-series={data.series.map((s) => s.sci).join(",")} />
  ),
}));

import RankingBoard from "./RankingBoard.tsx";

// 距離のある ISO 週（水曜 12:00 UTC）。now は W25 に固定する（Date.now をスタブ）。
const W23 = 1780488000; // 2026-W23
const W24 = 1781092800; // 2026-W24
const W25_NOW_MS = 1781697600 * 1000; // 2026-W25（now）

// #459: 親（属/カテゴリ）の無い素の品種タグは札にならないので、ランキングに乗せるには
// 投稿が **属＋品種** を持つ（TagPicker が #属 #品種 を書く）。表示は学名のみ。
const TITANOTA = ["アガベ", "チタノタ"]; // → key=チタノタ / sci=Agave titanota
const OBESA = ["ユーフォルビア", "オベサ"]; // → key=オベサ / sci=Euphorbia obesa
const GRAKILIS = ["パキポディウム", "グラキリス"]; // → key=グラキリス / sci=Pachypodium rosulatum var. gracilius

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? 1781697600,
    caption: overrides.caption ?? "",
    imageUrls: overrides.imageUrls ?? ["https://image.example/x.jpg"],
    imageUrl: overrides.imageUrl ?? "https://image.example/x.jpg",
    hashtags: overrides.hashtags ?? [],
    shotDates: [],  };
}

describe("RankingBoard", () => {
  beforeEach(() => {
    fetchRankingPosts.mockReset();
    fetchRankingPosts.mockResolvedValue([]);
    // now を W25 に固定（純ロジックには component が Date.now を渡す）。
    vi.spyOn(Date, "now").mockReturnValue(W25_NOW_MS);
    window.history.replaceState(null, "", "/ranking");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("投稿ゼロのとき、正直な空案内と投稿 CTA を出す（壊れて見せない）", async () => {
    render(<RankingBoard />);
    expect(
      await screen.findByText(/まだランキングを出すほどの投稿が集まっていません/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /投稿する/ })).toHaveAttribute("href", "/compose");
  });

  it("単週のみなら全行 NEW で、先週比は来週からと注記する（偽の矢印を出さない）", async () => {
    fetchRankingPosts.mockResolvedValue([
      makePost({ id: "1", hashtags: TITANOTA, createdAt: 1781697600 }),
      makePost({ id: "2", hashtags: TITANOTA, createdAt: 1781697600 }),
      makePost({ id: "3", hashtags: OBESA, createdAt: 1781697600 }),
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    // 各行はクリックで discover へ飛ぶリンク（#459）。aria-label/件数はこのリンクが持つ。
    const items = within(list).getAllByRole("link");
    expect(items).toHaveLength(2);
    // 全行 NEW。
    expect(within(list).getAllByText("NEW")).toHaveLength(2);
    // 「先週比は来週から」注記。
    expect(screen.getByText(/先週との比較（↑↓）は来週から表示されます/)).toBeInTheDocument();
    // 1位はチタノタ（2件）＝aria-label は学名のみ（#459＝和名は出さない）。
    expect(items[0]).toHaveAttribute("aria-label", expect.stringContaining("1位 Agave titanota"));
  });

  it("先週比で ↑↓ と件数を出す（複数週）", async () => {
    fetchRankingPosts.mockResolvedValue([
      // 先週(W24): チタノタ=2(1位), オベサ=1(2位)
      makePost({ id: "p1", hashtags: TITANOTA, createdAt: W24 }),
      makePost({ id: "p2", hashtags: TITANOTA, createdAt: W24 }),
      makePost({ id: "p3", hashtags: OBESA, createdAt: W24 }),
      // 今週(W25): オベサ=3(1位↑1), チタノタ=2(2位↓1)
      makePost({ id: "c1", hashtags: OBESA }),
      makePost({ id: "c2", hashtags: OBESA }),
      makePost({ id: "c3", hashtags: OBESA }),
      makePost({ id: "c4", hashtags: TITANOTA }),
      makePost({ id: "c5", hashtags: TITANOTA }),
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    const items = within(list).getAllByRole("link");
    // 行リンクの aria-label は学名のみ（#459＝ランキングは学名そのもの・和名は読ませない）。
    expect(items[0]).toHaveAttribute("aria-label", "1位 Euphorbia obesa 3件 1ランクアップ");
    expect(items[1]).toHaveAttribute("aria-label", "2位 Agave titanota 2件 1ランクダウン");
    // 単週注記は出ない（複数週ある）。
    expect(screen.queryByText(/先週との比較（↑↓）は来週から表示されます/)).not.toBeInTheDocument();
  });

  it("後発の週が全 NEW でも初週バナーを出さない（週数で判定・#162 Q2）", async () => {
    // 直前週(W24)には別品種、今週(W25)は全て新規品種＝全行 NEW になるが、データ週は 2 週ある。
    // 旧実装（全 NEW を初週の代理にする）だと誤って初週バナーを出すケース。
    fetchRankingPosts.mockResolvedValue([
      makePost({ id: "p1", hashtags: TITANOTA, createdAt: W24 }), // 直前週
      makePost({ id: "c1", hashtags: OBESA }), // 今週（W25）＝過去に無い NEW
      makePost({ id: "c2", hashtags: GRAKILIS }), // 今週（W25）＝過去に無い NEW
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    // 今週の行は全て NEW（バッジは出る）。
    expect(within(list).getAllByText("NEW")).toHaveLength(2);
    // だが週は 2 週ぶんあるので初週バナーは出さない。
    expect(screen.queryByText(/先週との比較（↑↓）は来週から表示されます/)).not.toBeInTheDocument();
  });

  it("RE（再登場）を出す: 過去週に居て直前週に居ない品種", async () => {
    fetchRankingPosts.mockResolvedValue([
      makePost({ id: "a", hashtags: GRAKILIS, createdAt: W23 }), // 過去に登場
      makePost({ id: "b", hashtags: TITANOTA, createdAt: W24 }), // 直前週（グラキリスは不在）
      makePost({ id: "c", hashtags: GRAKILIS }), // 今週復帰 = RE
    ]);
    render(<RankingBoard />);

    const list = await screen.findByRole("list");
    // aria-label は学名のみ（#459）＝グラキリスの行は学名 Pachypodium … で引く。
    const grakRow = within(list)
      .getAllByRole("link")
      .find((a) => a.getAttribute("aria-label")?.includes("Pachypodium rosulatum var. gracilius"));
    expect(grakRow).toBeDefined();
    expect(within(grakRow!).getByText("RE")).toBeInTheDocument();
  });

  it("学名（SciName）を表示する", async () => {
    fetchRankingPosts.mockResolvedValue([makePost({ id: "1", hashtags: TITANOTA })]);
    render(<RankingBoard />);
    await screen.findByRole("list");
    // SciName はトークンを span で分割描画する（属＋種小名）。属名が出ていれば学名行が描画されている。
    expect(screen.getByText("Agave")).toBeInTheDocument();
  });

  it("取得失敗（reject）でも再読み込み導線を出す（クラッシュしない）", async () => {
    fetchRankingPosts.mockRejectedValue(new Error("relay down"));
    render(<RankingBoard />);
    expect(await screen.findByText(/ランキングを読み込めませんでした/)).toBeInTheDocument();
  });

  it("単週のみのときは途中経過チャートを出さない（週が2未満＝gate）", async () => {
    fetchRankingPosts.mockResolvedValue([
      makePost({ id: "1", hashtags: TITANOTA, createdAt: 1781697600 }),
      makePost({ id: "2", hashtags: OBESA, createdAt: 1781697600 }),
    ]);
    render(<RankingBoard />);
    await screen.findByRole("list");
    expect(screen.queryByTestId("rank-run-chart")).not.toBeInTheDocument();
  });

  it("複数週たまると途中経過チャートを出し、上位品種の系列を渡す", async () => {
    fetchRankingPosts.mockResolvedValue([
      // 先週(W24)
      makePost({ id: "p1", hashtags: TITANOTA, createdAt: W24 }),
      makePost({ id: "p2", hashtags: TITANOTA, createdAt: W24 }),
      makePost({ id: "p3", hashtags: OBESA, createdAt: W24 }),
      // 今週(W25)
      makePost({ id: "c1", hashtags: OBESA }),
      makePost({ id: "c2", hashtags: OBESA }),
      makePost({ id: "c3", hashtags: OBESA }),
      makePost({ id: "c4", hashtags: TITANOTA }),
      makePost({ id: "c5", hashtags: TITANOTA }),
    ]);
    render(<RankingBoard />);
    await screen.findByRole("list");
    const chart = await screen.findByTestId("rank-run-chart");
    // 現在ランキング上位（オベサ・チタノタ）が系列として渡る＝系列の識別子は学名のみ（#459）。
    const series = chart.getAttribute("data-series") ?? "";
    expect(series).toContain("Euphorbia obesa");
    expect(series).toContain("Agave titanota");
  });
});
