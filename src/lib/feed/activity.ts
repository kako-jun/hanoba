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

/** `YYYY-MM-DD`（撮影日・#324）→ JST 暦日インデックス。不正は null。 */
export function ymdToJstDayIndex(ymd: string): number | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m === null) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Math.floor(Date.UTC(y, mo - 1, d) / (DAY_SEC * 1000));
}

/**
 * 投稿の「活動した暦日」を返す（#324・kako-jun「撮影日で数える」）。**写真の撮影日があればそれ**
 * （per-photo・毎日撮って週末まとめ投稿でも撮った日数が点く）、無ければ created_at 日にフォールバック
 * （撮影日タグの無い既存/他クライアント投稿も従来どおり数える）。同一投稿内の重複日は畳まない
 * （その日に複数枚撮れば濃くなる＝ヒートマップの count に効く）。
 */
export function postActiveDays(post: FeedPost): number[] {
  if (post.shotDates.length > 0) {
    const days = post.shotDates.map(ymdToJstDayIndex).filter((d): d is number => d !== null);
    if (days.length > 0) return days;
  }
  return [jstDayIndex(post.createdAt)];
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

/** ヒートマップの濃淡段階（0〜2・0=投稿なし / 1=少し〔1〜2件〕 / 2=多い〔3件〜〕）。 */
export function activityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  return 2;
}

/**
 * 直近 `weeks` 週の**日別投稿数**を GitHub 風の週列×7曜日グリッドで返す純関数（#272 段階4）。
 * - 各列＝1週（日曜始まり）、各行＝曜日（0=日 … 6=土）。今日を含む週が末尾列。
 * - 範囲外（最初の週の今日より前・最終週の今日より後）はパディング（day:null）。
 */
export function activityHeatmap(posts: FeedPost[], now: number, weeks = 12): HeatCell[][] {
  const today = jstDayIndex(now);
  const firstDay = today - (weeks * 7 - 1); // 表示する最古日
  const firstSunday = firstDay - weekdayOf(firstDay); // その週の日曜まで遡る（列の起点）
  const counts = new Map<number, number>();
  for (const p of posts) {
    for (const d of postActiveDays(p)) counts.set(d, (counts.get(d) ?? 0) + 1);
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
  for (const p of posts) for (const d of postActiveDays(p)) days.add(d);
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
