import { useEffect, useMemo, useState } from "react";
import SciName from "../ui/SciName.tsx";
import { fetchRankingPosts } from "../../lib/nostr/client.ts";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { rankWithDeltas, weeklyCountSeries, type Delta, type RankRow } from "../../lib/feed/ranking.ts";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";

type Status = "loading" | "error" | "loaded";

// sparkline を出す上位件数（軽量さ優先・上位だけ推移を見せる）。
const SPARKLINE_TOP = 10;

/**
 * 植物品種の人気ランキング島（#162・client:load）。
 *
 * バックエンドレス（DESIGN §6）。集計サーバを持たず、取得済みの **t:hanoba 投稿だけ** を
 * クライアントで数える（自分の投稿が見えてチャートが動く＝投稿の動機）。週次・先週比
 * （NEW/RE/↑↓）・週次 sparkline を出す。母集団がまばらでも壊れて見えないよう、空/単週/少数を
 * 正直に扱う（単週なら全 NEW・偽の矢印を出さない）。
 *
 * - マウントで品種カタログを動的 import（PostDetail と同型・初期バンドルに大データを載せない）。
 *   さらに fetchRankingPosts() で投稿を取得し、rankWithDeltas(posts, catalog, nowSec) を計算する。
 *   nowSec はここで Math.floor(Date.now()/1000)（純ロジックには now を渡す＝lib は Date.now を持たない）。
 * - **開発専用プレビュー**: import.meta.env.DEV かつ URL に `?demo`（`?demo=1` 等）があるときだけ、
 *   合成 fixture（ranking.demo.ts）を使う＝relay に publish せずリッチ状態を確認できる。
 *   この分岐は本番ビルドでは import.meta.env.DEV=false によりデッドコードになる（捏造データを本番に出さない）。
 * - relay 取得は client.ts に集約（島から直接リレーを叩かない）。SSR では走らせない。
 */
export default function RankingBoard() {
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  // 計算の基準時刻（unix 秒）。マウント時に確定して以降固定する（再レンダーで週が動かないように）。
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000));
  // 開発専用デモか（本番は常に false 相当＝import.meta.env.DEV が false）。
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let alive = true;

    // 開発専用 ?demo の判定（本番ビルドでは DEV が false で、この分岐ごとデッドコード）。
    const isDemo =
      import.meta.env.DEV &&
      (() => {
        try {
          return new URLSearchParams(window.location.search).has("demo");
        } catch {
          return false;
        }
      })();
    if (alive) setDemo(isDemo);

    // 品種カタログを動的 import（初期バンドルに大データを載せない・PostDetail と同型）。
    const catalogPromise = import("../../lib/plants/variety-catalog.ts").then((mod) => mod.VARIETY_CATALOG);

    // 投稿の取得元: 本番/通常は relay（client.ts）。開発専用 ?demo のときだけ合成 fixture。
    const postsPromise = isDemo
      ? import("../../lib/feed/ranking.demo.ts").then((mod) => mod.buildDemoRankingPosts(nowSec))
      : fetchRankingPosts();

    Promise.all([catalogPromise, postsPromise])
      .then(([cat, ps]) => {
        if (!alive) return;
        setCatalog(cat);
        setPosts(ps);
        setStatus("loaded");
      })
      .catch(() => {
        if (alive) setStatus("error");
      });

    return () => {
      alive = false;
    };
  }, [nowSec]);

  // 現在週のランキング（先週比つき）。catalog 未ロード時は空。
  const rows = useMemo<RankRow[]>(
    () => (catalog === null ? [] : rankWithDeltas(posts, catalog, nowSec)),
    [posts, catalog, nowSec],
  );

  // 先週（直前の過去週）が無い＝初週かどうか（全行 NEW のときの案内に使う）。
  // rows が空でなく、かつ全行が NEW なら「先週比は来週から」の注記を出す。
  const isFirstWeek = rows.length > 0 && rows.every((r) => r.delta.kind === "new");

  if (status === "loading") {
    return <p className="py-12 text-center text-ha-ink/60">読み込み中…</p>;
  }

  if (status === "error") {
    return (
      <div className="py-12 flex flex-col items-center gap-4 text-center">
        <p className="text-ha-ink/70">ランキングを読み込めませんでした。</p>
        <a
          href="/ranking"
          className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
        >
          再読み込み
        </a>
      </div>
    );
  }

  // 空状態（投稿/品種が集まっていない）＝壊れて見えないよう正直に案内する。
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-ha-ink/70 [word-break:auto-phrase]">
          まだランキングを出すほどの投稿が集まっていません。
        </p>
        <a
          href="/compose"
          className="inline-flex items-center rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
        >
          最初の一鉢を投稿する
        </a>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {import.meta.env.DEV && demo && (
        // 開発専用デモであることを画面にも明示する。import.meta.env.DEV で本番ビルドからは
        // このノード自体が消える（banner 文字列ごとデッドコード化＝本番に痕跡を残さない）。
        <p className="rounded-xl bg-ha-green-soft px-4 py-2 text-sm text-ha-green-deep">
          開発プレビュー（?demo）— 合成データです。実際の投稿ではありません。
        </p>
      )}

      {isFirstWeek && (
        // 単週のみ＝全 NEW。偽の矢印を出さない代わりに、比較が来週から始まることを正直に伝える。
        <p className="text-sm text-ha-ink/60 [word-break:auto-phrase]">
          今週が集計の最初の週です。先週との比較（↑↓）は来週から表示されます。
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li
            key={row.key}
            className="ha-rise glass rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
            aria-label={rowSummary(row)}
          >
            {/* 順位 */}
            <span
              className="shrink-0 w-8 text-center font-display text-xl font-extrabold tabular-nums text-ha-green-deep"
              aria-hidden="true"
            >
              {row.rank}
            </span>

            {/* 品種名（和名）＋学名 */}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-medium text-ha-ink truncate">{row.name}</span>
                <DeltaBadge delta={row.delta} />
              </div>
              {row.sci !== null && (
                <SciName sci={row.sci} className="block text-sm text-ha-ink/55 truncate" />
              )}
            </div>

            {/* sparkline（上位のみ）。装飾なので aria-hidden（意味は行の aria-label が持つ）。 */}
            {i < SPARKLINE_TOP && catalog !== null && (
              <Sparkline series={weeklyCountSeries(posts, catalog, row.key).map((s) => s.count)} />
            )}

            {/* 投稿数（票） */}
            <span className="shrink-0 text-right tabular-nums text-ha-ink/80">
              <span className="font-semibold text-ha-ink">{row.count}</span>
              <span className="text-xs text-ha-ink/55">件</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 先週比 Delta を読み上げ用の短い日本語にする（行の aria-label に使う）。 */
function deltaText(delta: Delta): string {
  switch (delta.kind) {
    case "new":
      return "新登場";
    case "re":
      return "再登場";
    case "same":
      return "順位変わらず";
    case "up":
      return `${delta.by}ランクアップ`;
    case "down":
      return `${delta.by}ランクダウン`;
  }
}

/** 行全体の読み上げ要約（順位・品種・件数・先週比）。sparkline は aria-hidden なのでここに含める。 */
function rowSummary(row: RankRow): string {
  return `${row.rank}位 ${row.name} ${row.count}件 ${deltaText(row.delta)}`;
}

/** 先週比バッジ（テキストで意味を持たせる＝色だけに頼らない・a11y）。 */
function DeltaBadge({ delta }: { delta: Delta }) {
  // パレット内に収める: up/new は緑、down/same は控えめ ink（新色は足さない）。
  if (delta.kind === "new") {
    return (
      <span className="shrink-0 rounded-full bg-ha-green-soft px-2 py-0.5 text-xs font-semibold text-ha-green-deep">
        NEW
      </span>
    );
  }
  if (delta.kind === "re") {
    return (
      <span className="shrink-0 rounded-full bg-ha-green-soft px-2 py-0.5 text-xs font-semibold text-ha-green-deep">
        RE
      </span>
    );
  }
  // 視覚バッジ（読み上げ名は行の aria-label が担うので、ここはテキストグリフのみ）。
  if (delta.kind === "same") {
    return <span className="shrink-0 text-xs font-medium text-ha-ink/45">—</span>;
  }
  if (delta.kind === "up") {
    return <span className="shrink-0 text-xs font-semibold text-ha-green">↑{delta.by}</span>;
  }
  // down
  return <span className="shrink-0 text-xs font-medium text-ha-ink/55">↓{delta.by}</span>;
}

/**
 * 週次票数の sparkline（軽量インライン SVG polyline）。装飾なので aria-hidden で隠し
 * （数値と順位が意味を持つ）、行側に aria-label の要約を付ける。
 * 1点しか無い・全部同値のときは中央の水平線を引く（高さの基準が無いと潰れるため）。
 */
function Sparkline({ series }: { series: number[] }) {
  // データ点が無ければ何も描かない。
  if (series.length === 0) return null;

  const W = 56;
  const H = 18;
  const PAD = 2;
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min;

  // x 座標は等間隔。1点のときは中央。
  const xOf = (i: number) => (series.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (series.length - 1));
  // y は上が大（票数が多いほど上）。span が 0（全同値）なら中央線。
  const yOf = (v: number) => (span === 0 ? H / 2 : H - PAD - ((v - min) * (H - PAD * 2)) / span);

  const points = series.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="shrink-0 hidden sm:block text-ha-green"
      aria-hidden="true"
    >
      {series.length === 1 ? (
        <circle cx={xOf(0)} cy={yOf(series[0]!)} r={2} fill="currentColor" />
      ) : (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
