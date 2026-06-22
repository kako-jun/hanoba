// 撮影日（#324）の表示フォーマット純関数。植物に依らない汎用＝🐱写真SNS（tail-roll）でも流用する。
//
// 撮影日は `YYYY-MM-DD`（TZ 無しのカメラ現地暦日）。#347 で**撮影日の表示は全言語で保存形式と同じ
// `YYYY-MM-DD` に固定**した（`Intl.DateTimeFormat(locale)` で ja「2024年6月15日」/ en「June 15, 2024」と
// 割れていたのを統一・locale による年月日順・月名・区切りの変換をしない）。レンジも**両端フル ISO**
// `2024-06-01～2024-06-22`（kako-jun「スラッシュ `M/D` は M/D⇔D/M で曖昧＝近視」「年も入れればいい」＝
// 年を省かずハイフンの ISO 順に）。locale を取らず暦日文字列をそのまま組む（TZ 変換も無し＝前後日ズレ無し）。

function parseYmd(ymd: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (m === null) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 撮影期間レンジのセパレータ＝全角チルダ ～(U+FF5E)。em box に左右対称に描かれる標準字（#397）。
 * 波ダッシュ 〜(U+301C) はフォント/OS により左に余白・右に詰まる非対称な描画になりやすい（Windows 系で顕著）ため避ける。
 * **producer（`shotDateRange`）と consumer（`PostCard` の split/再挿入＝長レンジの改行位置）でこの定数を共有し、
 * 文字のドリフト（producer だけ変えて consumer の split が外れる回帰）を防ぐ。**
 */
export const SHOT_DATE_RANGE_SEP = "～";

/**
 * 撮影日の完全表記。全言語で保存形式と同じ `YYYY-MM-DD` をそのまま返す（#347）。locale を取らず、
 * 年月日順・月名・区切りを変換しない＝写真オーバーレイ等で言語によらず `2026-05-21` で揃う。
 * 不正な入力（形式違い・範囲外）はそのまま返す。
 */
export function formatShotDate(ymd: string): string {
  const p = parseYmd(ymd);
  if (p === null) return ymd;
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}`;
}

/**
 * 写真ごとの撮影日（per-photo・null 混在可）から「撮影期間」を1行に。カードの表紙表記用（#324・kako-jun A案）。
 * - 妥当な日付が無ければ null（表示しない）。
 * - 1 種類だけ → その日（`YYYY-MM-DD`）。
 * - 複数 → 最古〜最新を両端フル ISO で「2024-06-01～2024-06-22」（#347・年も入れる・スラッシュ不可）。
 * 全言語で同じ表記＝locale を取らない。
 */
export function shotDateRange(dates: ReadonlyArray<string | null>): string | null {
  const valid = dates.filter((d): d is string => d !== null && parseYmd(d) !== null).sort();
  if (valid.length === 0) return null;
  const min = valid[0]!;
  const max = valid[valid.length - 1]!;
  if (min === max) return formatShotDate(min);
  return `${formatShotDate(min)}${SHOT_DATE_RANGE_SEP}${formatShotDate(max)}`;
}
