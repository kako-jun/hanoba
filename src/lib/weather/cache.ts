// 天気キャッシュ（#231）。
//
// 鼓門の空はそう急変しないので localStorage に短期キャッシュして再取得を抑える
// （Open-Meteo への負荷も下げる）。SSR 安全: localStorage は関数内でのみ参照する。

import type { HanobaWeather } from "./types.ts";
import { getAppStorage, updateAppStorage } from "../storage/appStorage.ts";

/** 再取得間隔。20 分以内のキャッシュは鮮度内とみなす。 */
export const WEATHER_TTL_MS = 20 * 60 * 1000;

/** キャッシュが鮮度内か（純関数）。fetchedAt から TTL 以内なら true。 */
export function isFresh(weather: HanobaWeather, nowMs: number, ttlMs = WEATHER_TTL_MS): boolean {
  return nowMs - weather.fetchedAt < ttlMs;
}

/** 集約 localStorage（appStorage）の天気キャッシュを読む（無い・壊れていれば null）。 */
export function readWeatherCache(): HanobaWeather | null {
  const w = getAppStorage().weather;
  // weatherCode は素材選択（rainLevel）が使う必須項目なので形に含めて検証する
  // （旧スキーマ・改竄で欠けたエントリは捨てて次の取得で上書きさせる）。
  if (
    typeof w?.fetchedAt === "number" &&
    typeof w?.condition === "string" &&
    typeof w?.weatherCode === "number"
  ) {
    return w;
  }
  return null;
}

/** 集約 localStorage（appStorage）に天気を書く。 */
export function writeWeatherCache(weather: HanobaWeather): void {
  updateAppStorage((s) => ({ ...s, weather }));
}
