// 撮影日（#324）の表示フォーマット純関数。植物に依らない汎用＝🐱写真SNS（tail-roll）でも流用する。
//
// 撮影日は `YYYY-MM-DD`（TZ 無しのカメラ現地暦日）。表示は Intl で locale 正に整形する
// （ja=「2024年6月15日」/ en=「June 15, 2024」）。bare な暦日に TZ を持ち込まないよう、
// 必ず timeZone:"UTC" で Date.UTC から整形する（ローカル TZ で前後日にズレないため）。

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

/** `YYYY-MM-DD` を locale の完全表記に（ja「2024年6月15日」/ en「June 15, 2024」）。不正はそのまま返す。 */
export function formatShotDate(ymd: string, locale: Locale): string {
  const p = parseYmd(ymd);
  if (p === null) return ymd;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcMs(p));
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
 * - 1 種類だけ → その日（完全表記）。
 * - 複数 → 最古〜最新を月/日で「6/1〜6/22」。
 */
export function shotDateRange(dates: ReadonlyArray<string | null>, locale: Locale): string | null {
  const valid = dates.filter((d): d is string => d !== null && parseYmd(d) !== null).sort();
  if (valid.length === 0) return null;
  const min = valid[0]!;
  const max = valid[valid.length - 1]!;
  if (min === max) return formatShotDate(min, locale);
  return `${formatMonthDay(min, locale)}〜${formatMonthDay(max, locale)}`;
}
