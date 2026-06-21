// 撮影日（#324）の表示フォーマット純関数。植物に依らない汎用＝🐱写真SNS（tail-roll）でも流用する。
//
// 撮影日は `YYYY-MM-DD`（TZ 無しのカメラ現地暦日）。#347 で**撮影日の完全表記は全言語で保存形式と
// 同じ `YYYY-MM-DD` 固定**にした（`Intl.DateTimeFormat(locale)` で ja「2024年6月15日」/ en「June 15,
// 2024」と割れていたのを統一・locale による年月日順・月名・区切りの変換をしない）。`formatShotDate` は
// locale を取らず暦日文字列をそのまま返す（TZ 変換も無し＝前後日ズレも起きない）。レンジの月/日短縮
// （`formatMonthDay`）は別物なので従来どおり Intl numeric で整形する（`timeZone:"UTC"` で前後日ズレ防止）。

import { type Locale } from "../i18n/locale.ts";

function parseYmd(ymd: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (m === null) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
}

function utcMs(p: { y: number; mo: number; d: number }): number {
  return Date.UTC(p.y, p.mo - 1, p.d);
}

/**
 * 撮影日の完全表記。全言語で保存形式と同じ `YYYY-MM-DD` をそのまま返す（#347）。locale を取らず、
 * 年月日順・月名・区切りを変換しない＝写真オーバーレイ等で言語によらず `2026-05-21` で揃う。
 * 不正な入力（形式違い・範囲外）はそのまま返す。
 */
export function formatShotDate(ymd: string): string {
  const p = parseYmd(ymd);
  if (p === null) return ymd;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** `YYYY-MM-DD` を月/日の短縮表記に（ja/en とも「6/15」相当）。レンジ表示用。 */
function formatMonthDay(ymd: string, locale: Locale): string {
  const p = parseYmd(ymd);
  if (p === null) return ymd;
  return new Intl.DateTimeFormat(locale, { month: "numeric", day: "numeric", timeZone: "UTC" }).format(utcMs(p));
}

/**
 * 写真ごとの撮影日（per-photo・null 混在可）から「撮影期間」を1行に。カードの表紙表記用（#324・kako-jun A案）。
 * - 妥当な日付が無ければ null（表示しない）。
 * - 1 種類だけ → その日（完全表記＝#347 で `YYYY-MM-DD` 固定）。
 * - 複数 → 最古〜最新を月/日で「6/1〜6/22」。
 */
export function shotDateRange(dates: ReadonlyArray<string | null>, locale: Locale): string | null {
  const valid = dates.filter((d): d is string => d !== null && parseYmd(d) !== null).sort();
  if (valid.length === 0) return null;
  const min = valid[0]!;
  const max = valid[valid.length - 1]!;
  if (min === max) return formatShotDate(min);
  return `${formatMonthDay(min, locale)}〜${formatMonthDay(max, locale)}`;
}
