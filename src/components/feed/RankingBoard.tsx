import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import SciName from "../ui/SciName.tsx";
import { fetchRankingPosts } from "../../lib/nostr/client.ts";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { bucketByWeek, rankRunData, rankWithDeltas, type Delta, type RankRow } from "../../lib/feed/ranking.ts";
import { discoverTagsHref } from "../../lib/feed/discoverFilter.ts";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { useT, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale, type MessageKey, type TParams } from "../../lib/i18n/index.ts";

type Status = "loading" | "error" | "loaded";

// 推移チャートに重ねる上位件数（軽量さ・識別性優先で上位だけ＝RankRunChart のトークン色 5 と整合）。
const CHART_TOP = 5;

// uPlot を使う推移チャートは遅延ロードする（チャートを出すときだけ uplot チャンクを取得＝初期描画を軽く）。
const RankRunChart = lazy(() => import("./RankRunChart.tsx"));

/**
 * 植物品種の人気ランキング島（#162・client:load）。
 *
 * バックエンドレス（DESIGN §6）。集計サーバを持たず、取得済みの **t:hanoba 投稿だけ** を
 * クライアントで数える（自分の投稿が見えてチャートが動く＝投稿の動機）。週次・先週比
 * （NEW/RE/↑↓）の表と、上位 N 品種の **途中経過（変動）チャート**（uPlot・遅延ロード・client-only）を
 * 出す。表が正本でチャートは補助。母集団がまばらでも壊れて見えないよう、空/単週/少数を
 * 正直に扱う（単週なら全 NEW・偽の矢印を出さない／週が2未満ならチャートは注記に差し替える）。
 *
 * - マウントで品種カタログを動的 import（PostDetail と同型・初期バンドルに大データを載せない）。
 *   さらに fetchRankingPosts() で投稿を取得し、rankWithDeltas(posts, catalog, nowSec) を計算する。
 *   nowSec はここで Math.floor(Date.now()/1000)（純ロジックには now を渡す＝lib は Date.now を持たない）。
 * - **開発専用プレビュー**: import.meta.env.DEV かつ URL に `?demo`（`?demo=1` 等）があるときだけ、
 *   合成 fixture（ranking.demo.ts）を使う＝relay に publish せずリッチ状態を確認できる。
 *   この分岐は本番ビルドでは import.meta.env.DEV=false によりデッドコードになる（捏造データを本番に出さない）。
 * - relay 取得は client.ts に集約（島から直接リレーを叩かない）。SSR では走らせない。
 */
// lang は ranking.astro がページの locale を流す（#147）。今は既定（ja）固定＝挙動不変。
export default function RankingBoard({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  // lang は SSR/初期描画の種（ja）。マウント後にクライアント解決値（en を選んでいれば en）へ寄せる。
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
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

  // 投稿が落ちている「データのある週」の数。全 NEW を代理に使うと、後発の週がたまたま新規品種
  // ばかりのときも初週と誤判定する。実際の週数で「集計の最初の週」を判定する（catalog 非依存）。
  const dataWeekCount = useMemo(() => bucketByWeek(posts).size, [posts]);

  // データのある週が実質 1 週以下なら初週＝「先週比は来週から」の注記を出す（rows が空のときは出さない）。
  const isFirstWeek = rows.length > 0 && dataWeekCount <= 1;

  // 途中経過チャート用データ。現在のランキング上位 N の key を全週に整列した票数マトリクスにする。
  const runData = useMemo(
    () => (catalog === null ? { weeks: [], series: [] } : rankRunData(posts, catalog, rows.slice(0, CHART_TOP).map((r) => r.key))),
    [posts, catalog, rows],
  );
  // 週が2つ以上たまっているか（チャートを出すか・ここでも gate して uplot チャンクを無駄に取らない）。
  const showChart = runData.weeks.length >= 2 && runData.series.length > 0;

  if (status === "loading") {
    return (
      <LocaleProvider value={loc}>
        <p className="py-12 text-center text-ha-ink/60">{t("ranking.board.loading")}</p>
      </LocaleProvider>
    );
  }

  if (status === "error") {
    return (
      <LocaleProvider value={loc}>
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">{t("ranking.board.error")}</p>
          <a
            href="/ranking"
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            {t("ranking.board.reload")}
          </a>
        </div>
      </LocaleProvider>
    );
  }

  // 空状態（投稿/品種が集まっていない）＝壊れて見えないよう正直に案内する。
  if (rows.length === 0) {
    return (
      <LocaleProvider value={loc}>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-ha-ink/70 [word-break:auto-phrase]">
            {t("ranking.board.empty")}
          </p>
          <a
            href="/compose"
            className="inline-flex items-center rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            {t("ranking.board.firstPost")}
          </a>
        </div>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider value={loc}>
    <section className="flex flex-col gap-4">
      {import.meta.env.DEV && demo && (
        // 開発専用デモであることを画面にも明示する。import.meta.env.DEV で本番ビルドからは
        // このノード自体が消える（banner 文字列ごとデッドコード化＝本番に痕跡を残さない）。
        <p className="rounded-xl bg-ha-green-soft px-4 py-2 text-sm text-ha-green-deep">
          {t("ranking.board.demo")}
        </p>
      )}

      {isFirstWeek && (
        // 単週のみ＝全 NEW。偽の矢印を出さない代わりに、比較が来週から始まることを正直に伝える。
        <p className="text-sm text-ha-ink/60 [word-break:auto-phrase]">
          {t("ranking.board.firstWeek")}
        </p>
      )}

      {/* 広幅（md+）は「よくあるランキング」の2段組＝列ファースト（左列が上位 1..⌈n/2⌉、右列が残り）。
          grid-flow-col ＋ 行数 ⌈n/2⌉ ＋ 2列で、10件なら 1-5 が左・6-10 が右に縦に並ぶ。データは隠さない
          （件数に応じて行数が伸びるだけ）。狭幅は従来どおり1列の縦並び。ha-rise/--i 演出は各行で維持。 */}
      <ol
        className="grid grid-cols-1 gap-2 md:grid-cols-2 md:grid-flow-col md:[grid-template-rows:repeat(var(--rank-rows),auto)]"
        style={{ "--rank-rows": Math.ceil(rows.length / 2) } as React.CSSProperties}
      >
        {rows.map((row, i) => (
          <li key={row.key} className="ha-rise" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            {/* 行クリックで discover（その品種の写真）へ＝「聞いたことない学名→クリックで正体が判明」の
                発見導線（#459）。filterTags は札と同じ [属,品種]／[属]（ja 正準・cross-language フィルタ不変）。 */}
            <a
              href={discoverTagsHref(row.filterTags)}
              aria-label={rowSummary(row, t)}
              className="glass rounded-xl px-4 py-3 flex items-center gap-3 transition-colors hover:bg-ha-green-soft/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
            >
              {/* 順位 */}
              <span
                className="shrink-0 w-8 text-center font-display text-xl font-extrabold tabular-nums text-ha-green-deep"
                aria-hidden="true"
              >
                {row.rank}
              </span>

              {/* 学名のみ（#459＝学名を覚える/発見の導線・和名は出さない）。学名が無い少数だけ和名に fallback。 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {/* 学名のみ（#459＝ランキングは学名そのもの。学名のある品種だけが行になる）。 */}
                  <SciName sci={row.sci} className="font-display font-medium text-ha-green-deep" />
                  <DeltaBadge delta={row.delta} />
                </div>
              </div>

              {/* 投稿数（票）。1000超でも読めるよう3桁区切り（#kako-jun）。 */}
              <span className="shrink-0 text-right tabular-nums text-ha-ink/80">
                <span className="font-semibold text-ha-ink">{row.count.toLocaleString("en-US")}</span>
                <span className="text-xs text-ha-ink/55">{t("ranking.board.count.unit")}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>

      {/* 途中経過（変動）チャート。表（上）が正本で、これはその補助。週が2つ以上たまったときだけ出す。
          uPlot は遅延ロード（チャートを出すときだけ uplot チャンクを取得）。読み込み中は静かに空。 */}
      {showChart && (
        <div className="ha-rise glass rounded-xl px-4 py-4" style={{ "--i": 1 } as React.CSSProperties}>
          <Suspense fallback={<p className="text-sm text-ha-ink/55">{t("ranking.board.chart.loading")}</p>}>
            <RankRunChart data={runData} />
          </Suspense>
        </div>
      )}
    </section>
    </LocaleProvider>
  );
}

/** 先週比 Delta を読み上げ用の短い文言にする（行の aria-label に使う・#147）。 */
function deltaText(delta: Delta, t: (key: MessageKey, params?: TParams) => string): string {
  switch (delta.kind) {
    case "new":
      return t("ranking.board.delta.new");
    case "re":
      return t("ranking.board.delta.re");
    case "same":
      return t("ranking.board.delta.same");
    case "up":
      return t("ranking.board.delta.up", { by: delta.by });
    case "down":
      return t("ranking.board.delta.down", { by: delta.by });
  }
}

/** 行全体の読み上げ要約（順位・学名・件数・先週比・#459＝ランキングは学名のみ）。 */
function rowSummary(row: RankRow, t: (key: MessageKey, params?: TParams) => string): string {
  return t("ranking.board.rowSummary", { rank: row.rank, sci: row.sci, count: row.count, delta: deltaText(row.delta, t) });
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
