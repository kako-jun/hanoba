// 天気キャッシュ（#231）。
//
// 鼓門の空はそう急変しないので localStorage に短期キャッシュして再取得を抑える
// （Open-Meteo への負荷も下げる）。SSR 安全: localStorage は関数内でのみ参照する。

import type { HanobaWeather } from "./types.ts";

const CACHE_KEY = "hanoba:weather";

/** 再取得間隔。20 分以内のキャッシュは鮮度内とみなす。 */
export const WEATHER_TTL_MS = 20 * 60 * 1000;

/** キャッシュが鮮度内か（純関数）。fetchedAt から TTL 以内なら true。 */
export function isFresh(weather: HanobaWeather, nowMs: number, ttlMs = WEATHER_TTL_MS): boolean {
  return nowMs - weather.fetchedAt < ttlMs;
}

function getLS(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** localStorage の天気キャッシュを読む（無い・壊れていれば null）。 */
export function readWeatherCache(): HanobaWeather | null {
  const raw = getLS()?.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    const w = JSON.parse(raw) as HanobaWeather;
    // weatherCode は素材選択（rainLevel）が使う必須項目なので形に含めて検証する
    // （旧スキーマ・改竄で欠けたエントリは捨てて次の取得で上書きさせる）。
    if (
      typeof w?.fetchedAt === "number" &&
      typeof w?.condition === "string" &&
      typeof w?.weatherCode === "number"
    ) {
      return w;
    }
  } catch {
    /* 壊れた JSON は無視（次の取得で上書きされる） */
  }
  return null;
}

/** localStorage に天気を書く。 */
export function writeWeatherCache(weather: HanobaWeather): void {
  getLS()?.setItem(CACHE_KEY, JSON.stringify(weather));
}
