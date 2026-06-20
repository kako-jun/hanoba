// ハノーバの現在天気を取得する（#231）。
//
// キャッシュ優先 → 古ければ Open-Meteo を直叩き → 失敗時は古いキャッシュ→null の順でフォールバック。
// 純関数（URL生成・パース・鮮度判定）は openMeteo.ts / cache.ts 側にあり、ここは副作用の薄い殻。

import type { HanobaWeather } from "./types.ts";
import { buildCurrentUrl, parseOpenMeteoCurrent } from "./openMeteo.ts";
import { isFresh, readWeatherCache, writeWeatherCache } from "./cache.ts";

/** ハノーバ（鼓門）の現在天気。鮮度内のキャッシュがあればそれを、無ければ取得して更新する。
 *  ネットワーク失敗・オフライン時は古いキャッシュ（無ければ null）を返す。 */
export async function getHanobaWeather(nowMs: number = Date.now()): Promise<HanobaWeather | null> {
  const cached = readWeatherCache();
  if (cached && isFresh(cached, nowMs)) return cached;
  try {
    const res = await fetch(buildCurrentUrl());
    if (!res.ok) return cached;
    const json = await res.json();
    const weather = parseOpenMeteoCurrent(json, nowMs);
    if (!weather) return cached;
    writeWeatherCache(weather);
    return weather;
  } catch {
    return cached;
  }
}
