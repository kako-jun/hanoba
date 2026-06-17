// 植物品種の人気ランキングの純粋ロジック（#162・定義先行・fixture テスト対象）。
//
// hanoba はバックエンドレス（DESIGN §6）なので集計サーバを持たない。ランキングは
// 取得済みの **t:hanoba 投稿だけ**（自分の投稿が見えてチャートを動かす＝投稿の動機になる）を
// クライアントで集計する「読むたびに数える」方式にする。relay 呼び出しはここではしない
// （取得は client.ts の責務・guidelines §3）。Date.now() もここでは呼ばない（now を引数で受ける
// ＝週の境界判定をテスト可能にする）。
//
// 集計単位は投稿の「品種」。品種の同定は #182/#23 の buildFuda に一本化する（属/品種の畳み込み・
// alias の canonical 寄せ・dedupe を再実装しない）。1投稿が複数品種を持てば各品種に1票ずつ。
// 同一投稿内で alias 違いの同一品種は buildFuda が1枚に畳むので二重計上しない。

import { buildFuda } from "../plants/fuda.ts";
import type { VarietyCategory } from "../plants/variety-catalog.ts";
import type { FeedPost } from "./parse.ts";

/** ランキングの1行（順位・差分を付ける前の集計結果）。 */
export interface RankedVariety {
  /** dedupe・React key 用（buildFuda の Fuda.key＝canonical 品種名 or 属名）。 */
  key: string;
  /** 和名（最も具体的な著名表記＝品種名 or 属名）。 */
  name: string;
  /** 学名（catalog 優先 → dictionary lookup → 引けなければ null）。 */
  sci: string | null;
  /** その週（または集計対象）の投稿数（票）。 */
  count: number;
}

/**
 * 先週比の差分。
 * - up/down/same: 先週との順位変化（by＝動いた順位数。same は by:0）。
 * - new: この週より前のどの週にも一度も載っていない（新規）。
 * - re: 過去に載ったことはあるが、直前の週には居なかった（再浮上）。
 *
 * NEW/RE は**取得済みの直近ウィンドウ内**での判定（`fetchRankingPosts` の上限＝現状およそ
 * 直近 500 投稿）。全履歴に対する絶対判定ではない（過去にウィンドウ外で載っていれば NEW に出うる）。
 */
export type Delta = { kind: "up" | "down" | "same"; by: number } | { kind: "new" } | { kind: "re" };

/** ランキングの1行（順位・差分つき）。 */
export interface RankRow extends RankedVariety {
  /** 1始まりの順位（同数でも連番。安定タイブレークは tally の初出順）。 */
  rank: number;
  delta: Delta;
}

/**
 * 投稿群の品種を buildFuda で同定して票数で集計する純粋関数。
 *
 * - 各投稿の hashtags を buildFuda にかけ、得られた品種（Fuda）ごとに +1。
 * - 1投稿内の重複（alias 違いの同一品種）は buildFuda が畳むので1票。
 * - 同一品種が複数投稿に出れば投稿ごとに加算する。
 * - 並びは票数の降順。同数は**初出順**（最初にその品種を含む投稿が現れた順）で安定させる。
 *
 * catalog は引数で受ける（variety-catalog を静的 import せず code-split を壊さない・fuda.ts と同方針）。
 */
export function tallyVarieties(posts: FeedPost[], catalog: VarietyCategory[]): RankedVariety[] {
  // key → 集計値。Map は挿入順を保つので、初出順（安定タイブレーク）の素データになる。
  const acc = new Map<string, RankedVariety & { firstSeen: number }>();
  let order = 0;
  for (const post of posts) {
    for (const fuda of buildFuda(post.hashtags, catalog)) {
      const cur = acc.get(fuda.key);
      if (cur === undefined) {
        acc.set(fuda.key, {
          key: fuda.key,
          name: fuda.name,
          sci: fuda.sci,
          count: 1,
          firstSeen: order++,
        });
      } else {
        cur.count += 1;
      }
    }
  }
  // 票数降順 → 同数は初出順（firstSeen 昇順）。sort は不安定な実装もあるので firstSeen で明示的に縛る。
  return [...acc.values()]
    .sort((a, b) => (b.count - a.count) || (a.firstSeen - b.firstSeen))
    .map(({ firstSeen: _firstSeen, ...rest }) => rest);
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** ISO 週は月曜始まり＝7 日。週ステップ（unix 秒）。 */
const WEEK_SEC = 7 * 24 * 60 * 60;

/**
 * unix 秒（UTC）が属する ISO 週の**月曜 00:00 UTC**を unix 秒で返す純粋関数。
 *
 * 週は ISO 8601 の曜日規約（月曜始まり・UTC・タイムゾーンを持たない）で切る。週キーと週の範囲
 * 生成（rankRunData の連続週軸）の双方をこの**月曜タイムスタンプ**に一本化する＝週番号の算術や
 * 年またぎ補正を介さず 7 日（WEEK_SEC）刻みで安全に列挙できる（isoWeekKey もこの月曜から導出する）。
 */
export function isoWeekMondayUtc(unixSec: number): number {
  const date = new Date(unixSec * 1000);
  // その日の 00:00 UTC（日付のみに正規化）を unix 秒で。
  const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 1000;
  // ISO 曜日（月=1 … 日=7）。
  const isoDow = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
  // 月曜まで巻き戻す（月曜=1 なので 0 日、日曜=7 なら 6 日ぶん）。
  return dayStart - (isoDow - 1) * (DAY_MS / 1000);
}

/**
 * unix 秒（UTC）を ISO 週キー（例 "2026-W25"）に変換する純粋関数。
 *
 * 週は**月曜始まり・UTC**で切る（ISO 8601 の曜日規約に合わせる・isoWeekMondayUtc と同じ月曜から導出）。
 * 年・週番号は ISO 8601 に従う（その週の**木曜が属する年**が ISO 年・年の最初の木曜を含む週を W01）。
 * 表示・比較はキーの**文字列としての昇順**が時系列昇順になるよう、週番号をゼロ埋め2桁にする。
 *
 * 実装は標準アルゴリズム: 週の月曜から木曜（ISO 年を決める日）へ +3 日ずらし、ISO 年の元日からの
 * 通日で週番号を割る。すべて UTC で計算するので DST の影響を受けない。
 */
export function isoWeekKey(unixSec: number): string {
  // この週の木曜（ISO 年・週番号を決める日）。月曜 + 3 日。
  const thursday = new Date((isoWeekMondayUtc(unixSec) + 3 * (DAY_MS / 1000)) * 1000);
  const isoYear = thursday.getUTCFullYear();
  // ISO 年の元日からの通日で週番号を割る。
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * 投稿群を isoWeekKey(createdAt) でバケット分けする純粋関数。
 * 戻り値の Map は**週キー昇順（古い→新しい）**で並べ替えて返す（sparkline・差分計算の前提）。
 */
export function bucketByWeek(posts: FeedPost[]): Map<string, FeedPost[]> {
  const byWeek = new Map<string, FeedPost[]>();
  for (const post of posts) {
    const week = isoWeekKey(post.createdAt);
    const arr = byWeek.get(week);
    if (arr === undefined) byWeek.set(week, [post]);
    else arr.push(post);
  }
  // キー昇順（文字列比較が時系列昇順になるキー設計）に並べ直す。
  return new Map([...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/**
 * 「現在の週」のランキングを、先週比の差分つきで返す純粋関数（#162 の核）。
 *
 * `now`（unix 秒）が指す ISO 週を「現在の週」とする。現在の週に投稿が1件も無くても、
 * isoWeekKey(now) の週を現在週として扱い、その週の集計（＝空なら空ランキング）を返す。
 *
 * 差分（Delta）のルール（NEW/RE はいずれも**取得済みの直近ウィンドウ内**＝`fetchRankingPosts` の
 * 上限ぶん・現状およそ直近 500 投稿での判定。全履歴に対する絶対判定ではない）:
 * - **NEW**: その品種が、現在週より前の（ウィンドウ内の）**どの週にも**一度も載っていない。
 * - **RE**: （ウィンドウ内で）過去に載ったことはあるが、**直前の週**には居なかった（再浮上）。
 * - **up/down/same**: 直前の週にも居た品種の、直前週との順位変化（by＝順位差・same は 0）。
 * - **先週（直前の過去週）が存在しない**（データが現在週ぶんしか無い＝初週）なら、
 *   全行を NEW にする（偽の up/down を出さない）。
 *
 * 「直前の週」は現在週より前で**最も新しい、投稿のある週**（カレンダー上の連続でなく、
 * データのある直近の過去週）とする。まばらなデータでも「前回チャート」と素直に比較できる。
 */
export function rankWithDeltas(
  posts: FeedPost[],
  catalog: VarietyCategory[],
  now: number,
): RankRow[] {
  const currentWeek = isoWeekKey(now);
  const byWeek = bucketByWeek(posts);

  const currentPosts = byWeek.get(currentWeek) ?? [];
  const current = tallyVarieties(currentPosts, catalog);

  // 過去週（現在週より前のキー）を昇順で集める。先週＝その中で最も新しい週。
  const pastWeeks = [...byWeek.keys()].filter((w) => w < currentWeek);
  const prevWeek = pastWeeks.length > 0 ? pastWeeks[pastWeeks.length - 1]! : null;

  // 先週のランキング順位（key → rank）。先週が無ければ null。
  const prevRankByKey =
    prevWeek === null
      ? null
      : (() => {
          const prev = tallyVarieties(byWeek.get(prevWeek) ?? [], catalog);
          const m = new Map<string, number>();
          prev.forEach((row, i) => m.set(row.key, i + 1));
          return m;
        })();

  // 「これまでに（取得済みウィンドウ内・現在週より前のどこかで）載ったことのある品種」の集合＝NEW/RE 判定用。
  const everChartedBefore = new Set<string>();
  for (const week of pastWeeks) {
    for (const row of tallyVarieties(byWeek.get(week) ?? [], catalog)) {
      everChartedBefore.add(row.key);
    }
  }

  return current.map((row, i) => {
    const rank = i + 1;
    let delta: Delta;
    if (prevRankByKey === null) {
      // 先週（過去週）が1つも無い＝初週。偽の矢印を出さず全て NEW。
      delta = { kind: "new" };
    } else {
      const prevRank = prevRankByKey.get(row.key);
      if (prevRank === undefined) {
        // 直前週に居ない。過去のどこかに居れば RE、一度も無ければ NEW。
        delta = everChartedBefore.has(row.key) ? { kind: "re" } : { kind: "new" };
      } else if (prevRank > rank) {
        delta = { kind: "up", by: prevRank - rank };
      } else if (prevRank < rank) {
        delta = { kind: "down", by: rank - prevRank };
      } else {
        delta = { kind: "same", by: 0 };
      }
    }
    return { ...row, rank, delta };
  });
}

/** 推移チャート（uPlot）用の1品種ぶんの系列。`counts` は `RankRunData.weeks` と同じ長さ・同じ順序に整列する。 */
export interface RankRunSeries {
  /** dedupe・凡例の安定キー（buildFuda の Fuda.key＝canonical 品種名 or 属名）。 */
  key: string;
  /** 凡例に出す和名（最も具体的な著名表記）。 */
  name: string;
  /** 週ごとの票数（`weeks[i]` の週の票数。その週に居なければ 0）。 */
  counts: number[];
}

/** 推移チャート（uPlot）の入力。x 軸＝`weeks`（古い→新しい）、y 軸＝週次票数、1品種1系列。 */
export interface RankRunData {
  /**
   * 最古〜最新の投稿週までを**カレンダー上で連続**させた ISO 週キー（古い→新しい）。
   * 投稿のある週だけでなく、**間に投稿が無い空週も漏れなく**並べる（その週の各系列 `counts` は 0）。
   * x 軸を等間隔の週ステップに保つため（空週を詰めると軸が歪み、まばらな launch 期に誤解を生む）。
   */
  weeks: string[];
  /** 指定した品種ごとの系列（`counts` は `weeks` に整列）。 */
  series: RankRunSeries[];
}

/**
 * 指定品種（keys）の週次票数マトリクスを、uPlot 推移チャート用に組む純粋関数（#162）。
 *
 * x 軸＝最古〜最新の投稿週までの**連続した週列**（`isoWeekKey`・古い→新しい）。投稿のある週だけでなく、
 * **間に投稿が無い空週も 0 埋めで補完**する＝チャートが週インデックス 0..N-1 に等間隔で点を打つので、
 * 空週を詰めると 1 週ステップと複数週ギャップが同じ幅で描かれ軸が歪む（まばらな launch 期に顕著）。
 * 連続軸は**月曜タイムスタンプ刻み**で作る（`isoWeekMondayUtc` で各投稿の週月曜を求め、最古〜最新を
 * 7 日刻みで列挙＝週番号算術や年またぎ補正を避ける）。各系列の `counts` はこの週列に 1:1 で整列し、
 * その週に当該品種が居なければ 0（**線が途切れず連続**）。`keys` の順序を `series` の順序として保つ。
 *
 * 旧・行ごとの sparkline（品種ごとに別系列）と違い、週列を全系列で共有するので、線同士を同じ x 軸で
 * 重ねられる（チャートの主目的）。投稿が無ければ `{weeks:[],series:[]}`。now は使わず（純粋）、
 * 範囲はすべて投稿のタイムスタンプから導く。
 *
 * catalog は引数で受ける（variety-catalog を静的 import せず code-split を壊さない・他関数と同方針）。
 */
export function rankRunData(
  posts: FeedPost[],
  catalog: VarietyCategory[],
  keys: string[],
): RankRunData {
  const byWeek = bucketByWeek(posts); // 既に週キー昇順（古い→新しい）
  if (byWeek.size === 0) return { weeks: [], series: [] };

  // 投稿のある各週の「月曜 unix 秒」を求め、最古〜最新を 7 日刻みで列挙して連続な週軸を作る。
  // （週番号の算術や年またぎ補正を介さず、月曜タイムスタンプの加算だけで安全に連続させる。）
  const mondays = posts.map((p) => isoWeekMondayUtc(p.createdAt));
  const minMonday = Math.min(...mondays);
  const maxMonday = Math.max(...mondays);
  const weeks: string[] = [];
  for (let m = minMonday; m <= maxMonday; m += WEEK_SEC) weeks.push(isoWeekKey(m));

  // 投稿のある週だけ「key → 票数」を集計してキャッシュする（空週は当然 0）。
  const countByWeek = new Map<string, Map<string, number>>();
  for (const [week, weekPosts] of byWeek) {
    const m = new Map<string, number>();
    for (const row of tallyVarieties(weekPosts, catalog)) m.set(row.key, row.count);
    countByWeek.set(week, m);
  }

  const series: RankRunSeries[] = keys.map((key) => ({
    key,
    // 和名はその key が出た最初の週の tally から拾う（出なければ key を名前に使う＝フォールバック）。
    name: nameForKey(byWeek, catalog, key),
    // 連続週列に整列。投稿の無い週（countByWeek に無い）も 0 で埋める。
    counts: weeks.map((week) => countByWeek.get(week)?.get(key) ?? 0),
  }));

  return { weeks, series };
}

/** key に対応する和名を、投稿のある週の tally から探す（見つからなければ key 自体を返す）。 */
function nameForKey(byWeek: Map<string, FeedPost[]>, catalog: VarietyCategory[], key: string): string {
  for (const weekPosts of byWeek.values()) {
    const found = tallyVarieties(weekPosts, catalog).find((r) => r.key === key);
    if (found !== undefined) return found.name;
  }
  return key;
}
