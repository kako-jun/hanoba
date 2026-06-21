// 市民の活動（投稿の頻度/継続）の純粋ロジック（#272 段階4・脱ゲーム化）。
//
// #310 の「緑の総面積」（緑の貢献量・per-post）とは別軸で、**いつ・どれだけ投稿したか**を
// 日別ヒートマップ（GitHub の草風カレンダー）と連続記録で静かに見せる。バッジ/演出は付けない
// （脱ゲーム化＝事実の可視化だけ・#272）。すべて t:hanoba 投稿からのクライアント集計＝backendless。
//
// 日の境界は **鼓門 JST**（hanoba の時刻基準・天気/時刻演出と同じ）。`now` は引数で受け決定的
// （Date.now を内部で呼ばない＝テスト容易・citizen.ts/ranking.ts と同方針）。

import type { FeedPost } from "./parse.ts";

const JST_OFFSET_SEC = 9 * 3600;
const DAY_SEC = 86400;

/** unix 秒 → 鼓門 JST の暦日インデックス（1970-01-01 JST = 0）。 */
export function jstDayIndex(unixSec: number): number {
  return Math.floor((unixSec + JST_OFFSET_SEC) / DAY_SEC);
}

/** 暦日インデックスの曜日（0=日 … 6=土）。1970-01-01 は木曜なので +4 オフセット。 */
export function weekdayOf(dayIndex: number): number {
  return (((dayIndex + 4) % 7) + 7) % 7;
}

/** ヒートマップの1マス（day=null は週頭/週末のパディング＝表示しない空きマス）。 */
export interface HeatCell {
  /** 暦日インデックス（パディングは null）。 */
  day: number | null;
  /** その日の t:hanoba 投稿数（パディングは 0）。 */
  count: number;
}

/** ヒートマップの濃淡段階（GitHub の草と同じ 0〜4・0=投稿なし）。 */
export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * 直近 `weeks` 週の**日別投稿数**を GitHub 風の週列×7曜日グリッドで返す純関数（#272 段階4）。
 * - 各列＝1週（日曜始まり）、各行＝曜日（0=日 … 6=土）。今日を含む週が末尾列。
 * - 範囲外（最初の週の今日より前・最終週の今日より後）はパディング（day:null）。
 */
export function activityHeatmap(posts: FeedPost[], now: number, weeks = 13): HeatCell[][] {
  const today = jstDayIndex(now);
  const firstDay = today - (weeks * 7 - 1); // 表示する最古日
  const firstSunday = firstDay - weekdayOf(firstDay); // その週の日曜まで遡る（列の起点）
  const counts = new Map<number, number>();
  for (const p of posts) {
    const d = jstDayIndex(p.createdAt);
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const numWeeks = Math.ceil((today - firstSunday + 1) / 7);
  const cols: HeatCell[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    const col: HeatCell[] = [];
    for (let r = 0; r < 7; r++) {
      const d = firstSunday + w * 7 + r;
      if (d < firstDay || d > today) col.push({ day: null, count: 0 });
      else col.push({ day: d, count: counts.get(d) ?? 0 });
    }
    cols.push(col);
  }
  return cols;
}

/** 連続投稿記録（日数）。 */
export interface Streaks {
  /** 現在の連続投稿日数（今日 or 昨日から遡る連続。今日未投稿でも昨日まで続いていれば生存）。 */
  current: number;
  /** 観測範囲での最長連続投稿日数。 */
  longest: number;
}

/**
 * 連続投稿記録を求める純関数（#272 段階4）。投稿のある JST 暦日の集合から、
 * - longest: 連続した暦日の最長ラン。
 * - current: 今日（投稿あれば）または昨日から遡って連続している日数。今日も昨日も無ければ 0。
 *   （日付をまたいだ直後＝今日まだ未投稿でも、昨日まで続いていれば連続は途切れていない扱い。）
 */
export function streaks(posts: FeedPost[], now: number): Streaks {
  const days = new Set<number>();
  for (const p of posts) days.add(jstDayIndex(p.createdAt));
  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = [...days].sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]! + 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  const today = jstDayIndex(now);
  let cursor = days.has(today) ? today : today - 1; // 今日未投稿なら昨日から数える（連続は生存）
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor--;
  }
  return { current, longest };
}
