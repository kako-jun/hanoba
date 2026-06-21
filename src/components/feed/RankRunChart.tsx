import { useEffect, useRef } from "react";
import type { RankRunData } from "../../lib/feed/ranking.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";
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
 * 図全体には説明的な `aria-label` を付け、概要だけ支援技術に伝える。凡例も装飾（名前は表と aria-label が持つ）
 * ＝`aria-hidden`。uPlot 既定凡例（□マーカー＝線＋点の実体と不一致・スマホで改行崩れ）は使わず、
 * 線＋丸点の自前凡例を canvas の下に出す（#261）。
 * reduced-motion: uPlot は既定でアニメーションしない（再描画も即時）。新たな動きは足さない。
 *
 * sparse: `weeks.length < 2`（点が1つ以下）では退化したグラフを描かず、静かな注記を出す
 * （線にならない・潰れる）。RankingBoard 側でも同条件で gate するが、ここでも安全側に倒す。
 */

// 系列の線色＝**すべて global.css のトークン値**だけで構成する（新色を足さない・DESIGN §5.1）。
// 緑（葉）→ ピンク（差し色）→ オレンジ（照明）→ ink（暖白）→ 黄（花）の 5 色。旧配色は
// green/orange/yellow/green-deep/ink で **緑系が3つ**並び互いに見分けづらかったので、未使用だった
// pink を入れて分離を上げ、暖色で最も近い orange↔yellow を隣り合わせない順に並べた（#261）。
// RankingBoard の CHART_TOP=5 と整合＝上位 5 系列までに抑え循環せず使い切る。
const SERIES_COLORS = [
  "#6cba38", // --color-ha-green（葉）
  "#ff5d6a", // --color-ha-pink（差し色・最も分離する）
  "#e89a4c", // --color-ha-orange（照明）
  "#ece6da", // --color-ha-ink（暖白）
  "#f2c84b", // --color-ha-yellow（花）
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

/**
 * x 軸の目盛り位置＝**整数の週インデックスだけ**を返す（半端な位置を一切作らない）。
 * uPlot 自動目盛りは 0.5 刻みも打つので、週indexへ丸めると隣同士が同じ週に潰れて "W25" が2回出る
 * （#261 の重複バグ）。ここで整数だけに固定して根を断つ。週が多いときは ~8 本に間引き、最新週は必ず含める。
 */
function weekSplits(weekCount: number): number[] {
  const last = weekCount - 1;
  if (last <= 0) return [0];
  const step = Math.max(1, Math.ceil(weekCount / 8));
  const out: number[] = [];
  for (let i = 0; i <= last; i += step) out.push(i);
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

export default function RankRunChart({ data }: { data: RankRunData }) {
  const t = useT(useLocale());
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
        const lastIdx = data.weeks.length - 1; // 末尾の週インデックス（range pin と splits に使う）。
        const alignedData: number[][] = [xs, ...data.series.map((s) => s.counts)];

        const measuredWidth = Math.max(host.clientWidth, 160);

        const opts = {
          width: measuredWidth,
          height: 240,
          // 凡例は uPlot 既定（□マーカー＝実体と不一致・スマホで改行崩れ）を使わず、canvas の下に
          // React の自前凡例（線＋丸点）を出す（#261）。ここでは既定凡例を無効化する。
          legend: { show: false },
          cursor: { show: true, points: { show: true } },
          scales: {
            // x は 0..N-1 の週インデックス。range を端ぴったりに pin して左右の自動パディング（隙間）を詰める。
            // 点（半径2.5px）が切れないだけの僅かな余白（±0.15）を残す（#261・「左右の隙間を小さく」）。
            x: { time: false as const, range: [-0.15, lastIdx + 0.15] as [number, number] },
            y: { range: yRange(data.series.map((s) => s.counts)) },
          },
          axes: [
            {
              stroke: AXIS_STROKE,
              grid: { stroke: GRID_STROKE, width: 1 },
              ticks: { stroke: TICK_STROKE, width: 1 },
              font: "12px system-ui, sans-serif",
              // 目盛りは整数の週インデックスだけに固定（weekSplits）。半端な位置を作らないので、
              // 丸めで隣同士が同じ週に潰れる "W24/W25 重複" が起きない（#261）。
              splits: () => weekSplits(data.weeks.length),
              // x 値（整数週インデックス）を週ラベル（"W25"）に差し替える。範囲外/欠落は空に。
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
        {t("ranking.chart.sparse")}
      </p>
    );
  }

  return (
    <figure className="flex flex-col gap-2" aria-label={t("ranking.chart.summary", { names: data.series.map((s) => s.name).join("・") })}>
      {/* canvas は装飾（意味は上の表が持つ）＝aria-hidden。 */}
      <div ref={hostRef} aria-hidden="true" className="w-full" />
      {/* 自前の凡例。マーカーは「線＋丸点」でグラフ本体（線＋点）と実体を一致させる（□は使わない）。
          左揃え＋「マーカー＋和名」を whitespace-nowrap の塊にして、スマホで折り返してもユニットが割れない。
          名前は表と figure の aria-label が持つので、この凡例は装飾＝aria-hidden。 */}
      <ul aria-hidden="true" className="flex flex-wrap justify-start gap-x-4 gap-y-1">
        {data.series.map((s, i) => (
          <li
            key={`${i}-${s.name}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-ha-ink/80"
          >
            <LegendMark color={SERIES_COLORS[i % SERIES_COLORS.length] ?? AXIS_INK} />
            <span>{s.name}</span>
          </li>
        ))}
      </ul>
      <figcaption className="text-xs text-ha-ink/55 [word-break:auto-phrase]">
        {t("ranking.chart.caption")}
      </figcaption>
    </figure>
  );
}

/** 凡例マーカー＝「短い線＋丸点」。グラフ本体（線 width2 ＋ 丸点）と見た目を一致させる（□は使わない・#261）。 */
function LegendMark({ color }: { color: string }) {
  return (
    <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="5" x2="25" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="13" cy="5" r="3" fill={color} />
    </svg>
  );
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
