import { useEffect, useRef } from "react";
import type { RankRunData } from "../../lib/feed/ranking.ts";
// uPlot のスタイルシート。CSS は副作用 import（window に触れない＝SSG ハザード無し）。本コンポーネント自体が
// RankingBoard から遅延ロードされるので、この CSS もチャートを出すときに初めて読まれる（CropFrame の
// react-image-crop CSS と同方式＝動的 import より確実にチャンクへ束ねられる）。
import "uplot/dist/uPlot.min.css";

/**
 * ランキングの「途中経過（変動）」推移チャート（#162・uPlot）。
 *
 * 旧・行ごとのインライン SVG sparkline を置き換え、上位 N 品種を **1枚の折れ線チャート**に重ねる
 * （x＝ISO 週・古い→新しい、y＝その週の票数、1品種1線）。維持者の方針「変動はグラフなら uPlot
 * のような軽量 lib を使う」に従い、軽量・MIT・依存ゼロ・canvas の uPlot を採用する。
 *
 * **クライアント専用**: uPlot の JS は `window`/canvas に触れるので、静的 Astro ビルド（SSG）中に走る
 * モジュールトップでは import しない。マウント後の useEffect で **動的 import** し、ref した div に
 * インスタンスを構築、アンマウントで破棄する。CSS（スタイルだけ＝window 非依存）は上部で副作用 import する
 * （動的 import より確実にチャンクの CSS へ束ねられる）。RankingBoard 側でも React.lazy で遅延ロードするので、
 * チャートを出すまで uplot チャンク自体を取得しない。
 *
 * a11y: canvas は装飾として `aria-hidden`。意味（順位・品種・件数・先週比）は上の表が持つ＝表が正本。
 * 図全体には説明的な `aria-label` を付け、概要だけ支援技術に伝える。
 * reduced-motion: uPlot は既定でアニメーションしない（再描画も即時）。新たな動きは足さない。
 *
 * sparse: `weeks.length < 2`（点が1つ以下）では退化したグラフを描かず、静かな注記を出す
 * （線にならない・潰れる）。RankingBoard 側でも同条件で gate するが、ここでも安全側に倒す。
 */

// 系列の線色＝**すべて global.css のトークン値**だけで構成する（新色を足さない・DESIGN §5.1）。
// 緑（葉）→ オレンジ（照明）→ 黄（花）→ 明るい葉色 → ink の 5 色。暗いシック地で互いに識別しやすい
// （RankingBoard の CHART_TOP=5 と整合＝上位 5 系列までに抑え循環せず使い切る）。
const SERIES_COLORS = [
  "#6cba38", // --color-ha-green（葉）
  "#e89a4c", // --color-ha-orange（照明）
  "#f2c84b", // --color-ha-yellow（花）
  "#aee07f", // --color-ha-green-deep（明るい葉）
  "#ece6da", // --color-ha-ink（暖白）
];

// 暗いシック地に合わせた軸/グリッド/ラベル色（global.css のトークンに準拠）。
const AXIS_INK = "#ece6da"; // ラベル＝ha-ink
const AXIS_STROKE = "rgba(236, 230, 218, 0.45)"; // 軸線＝ink を薄く
const GRID_STROKE = "rgba(236, 230, 218, 0.10)"; // グリッド＝ごく薄い ink
const TICK_STROKE = "rgba(236, 230, 218, 0.22)"; // 目盛り

/** ISO 週キー（"2026-W25"）を軸ラベル用の短い表記（"W25"）にする。年は省いてコンパクトに。 */
function weekLabel(weekKey: string): string {
  const i = weekKey.indexOf("W");
  return i >= 0 ? weekKey.slice(i) : weekKey;
}

export default function RankRunChart({ data }: { data: RankRunData }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  // weeks が2未満なら退化グラフを描かない（静かな注記のみ）。フックは常に同数呼ぶため早期 return せず分岐は描画側で。
  const enoughWeeks = data.weeks.length >= 2 && data.series.length > 0;

  useEffect(() => {
    if (!enoughWeeks) return;
    const host = hostRef.current;
    if (host === null) return;

    let alive = true;
    let chart: { destroy(): void; setSize(o: { width: number; height: number }): void } | null = null;
    let ro: ResizeObserver | null = null;

    // uPlot 本体をクライアントでのみ動的 import（SSG 中は走らない・初期バンドルに載せない）。CSS は上部で済み。
    import("uplot")
      .then((mod) => {
        if (!alive || hostRef.current === null) return;
        const UPlot = mod.default;

        // AlignedData: [x(週インデックス), ...各系列の票数]。x は 0..N-1 の数値（ラベルは values で週名に差し替え）。
        const xs = data.weeks.map((_, i) => i);
        const alignedData: number[][] = [xs, ...data.series.map((s) => s.counts)];

        const measuredWidth = Math.max(host.clientWidth, 160);

        const opts = {
          width: measuredWidth,
          height: 240,
          // 凡例は表が正本なので uPlot 既定の凡例に頼り切らないが、品種名を出すために series.label を使う。
          legend: { show: true },
          cursor: { show: true, points: { show: true } },
          scales: {
            x: { time: false as const },
            y: { range: yRange(data.series.map((s) => s.counts)) },
          },
          axes: [
            {
              stroke: AXIS_STROKE,
              grid: { stroke: GRID_STROKE, width: 1 },
              ticks: { stroke: TICK_STROKE, width: 1 },
              font: "12px system-ui, sans-serif",
              // x 値（週インデックス）を週ラベル（"W25"）に差し替える。
              values: (_u: unknown, splits: number[]) =>
                splits.map((v) => {
                  const wk = data.weeks[Math.round(v)];
                  return wk === undefined ? "" : weekLabel(wk);
                }),
              labelFont: "12px system-ui, sans-serif",
            },
            {
              stroke: AXIS_STROKE,
              grid: { stroke: GRID_STROKE, width: 1 },
              ticks: { stroke: TICK_STROKE, width: 1 },
              font: "12px system-ui, sans-serif",
              // y は整数（票数）。小数の目盛りラベルを出さない。
              values: (_u: unknown, splits: number[]) =>
                splits.map((v) => (Number.isInteger(v) ? String(v) : "")),
              labelFont: "12px system-ui, sans-serif",
            },
          ],
          series: [
            {}, // x 系列（プレースホルダ）
            ...data.series.map((s, i) => ({
              label: s.name, // 凡例＝和名
              stroke: SERIES_COLORS[i % SERIES_COLORS.length],
              width: 2,
              // 重い塗りはしない（fill 無し）。点は小さく。
              points: { show: true, size: 5, stroke: SERIES_COLORS[i % SERIES_COLORS.length] },
            })),
          ],
        };

        // 文字色を CSS で ink に寄せる（uPlot の凡例/軸ラベルは host の color を継承する）。
        host.style.color = AXIS_INK;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chart = new UPlot(opts as any, alignedData as any, host);

        // コンテナのリサイズに追従（クリーンアップで切る）。
        ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const w = Math.max(Math.floor(entry.contentRect.width), 160);
            chart?.setSize({ width: w, height: 240 });
          }
        });
        ro.observe(host);
      })
      .catch(() => {
        // 読み込み失敗時はチャートを出さない（表が正本なので致命ではない）。静かに諦める。
      });

    return () => {
      alive = false;
      ro?.disconnect();
      ro = null;
      chart?.destroy();
      chart = null;
    };
    // data の同一性が変わったら作り直す（uPlot を in-place 更新せず破棄→再構築で単純に保つ）。
  }, [data, enoughWeeks]);

  if (!enoughWeeks) {
    return (
      <p className="text-sm text-ha-ink/55 [word-break:auto-phrase]">
        推移グラフは週が2つ以上たまると表示されます。
      </p>
    );
  }

  return (
    <figure className="flex flex-col gap-2" aria-label={chartSummary(data)}>
      {/* canvas は装飾（意味は上の表が持つ）＝aria-hidden。 */}
      <div ref={hostRef} aria-hidden="true" className="w-full" />
      <figcaption className="text-xs text-ha-ink/55 [word-break:auto-phrase]">
        途中経過（変動）— 週ごとの投稿数の推移。詳しい順位は上の表をご覧ください。
      </figcaption>
    </figure>
  );
}

/** 図全体の読み上げ要約（表が正本なので概要のみ）。 */
function chartSummary(data: RankRunData): string {
  const names = data.series.map((s) => s.name).join("・");
  return `上位品種（${names}）の週ごとの投稿数の推移グラフ。詳しくは上の表を参照。`;
}

/**
 * y 軸の表示レンジ。最大値に少し余白を足し、最小は 0 固定（票数は非負・0 起点で比較しやすい）。
 * 全系列が 0 のときは [0,1]（潰れない）。
 */
function yRange(seriesCounts: number[][]): [number, number] {
  let max = 0;
  for (const counts of seriesCounts) for (const c of counts) if (c > max) max = c;
  return [0, max <= 0 ? 1 : max + 1];
}
