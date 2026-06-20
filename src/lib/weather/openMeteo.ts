// Open-Meteo current 取得（#231）。
//
// backendless: クライアントから Open-Meteo を直叩きする（APIキー不要・無料・CORS可）。
// 位置はユーザー位置を一切使わず、ハノーバ＝金沢駅・鼓門の固定座標だけを使う
// （身バレ論点ごと消滅。全員が「ハノーバの今の空」を共有して見る）。

import type { HanobaWeather } from "./types.ts";
import { wmoToCondition } from "./condition.ts";

export interface Coords {
  latitude: number;
  longitude: number;
}

/** ハノーバの座標＝金沢駅・鼓門（金沢駅東口広場）。 */
export const HANOBA_COORDS: Coords = { latitude: 36.5781, longitude: 136.6478 };

const API_BASE = "https://api.open-meteo.com/v1/forecast";

/** Open-Meteo の current 取得 URL。weather_code/is_day/気温/降水量を JST で取る。 */
export function buildCurrentUrl(coords: Coords = HANOBA_COORDS): string {
  const params = new URLSearchParams({
    latitude: String(coords.latitude),
    longitude: String(coords.longitude),
    current: "weather_code,is_day,temperature_2m,precipitation",
    timezone: "Asia/Tokyo",
  });
  return `${API_BASE}?${params.toString()}`;
}

interface OpenMeteoCurrent {
  current?: {
    weather_code?: number;
    is_day?: number;
    temperature_2m?: number;
    precipitation?: number;
  };
}

/** Open-Meteo 応答 → HanobaWeather（純関数・取得時刻は呼び出し側が渡す）。
 *  current や weather_code が欠けていれば null（呼び出し側でフォールバック）。 */
export function parseOpenMeteoCurrent(json: unknown, nowMs: number): HanobaWeather | null {
  const cur = (json as OpenMeteoCurrent)?.current;
  if (!cur || typeof cur.weather_code !== "number") return null;
  return {
    condition: wmoToCondition(cur.weather_code),
    weatherCode: cur.weather_code,
    // 1=昼,0=夜。欠損は昼扱い（安全側＝暗くしない）。
    isDay: cur.is_day !== 0,
    temperature: typeof cur.temperature_2m === "number" ? cur.temperature_2m : null,
    precipitation: typeof cur.precipitation === "number" ? cur.precipitation : null,
    fetchedAt: nowMs,
  };
}
