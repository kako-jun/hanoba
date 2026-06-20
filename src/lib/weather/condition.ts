// WMO weather code → 大別した天気状態（#231）。
//
// Open-Meteo は WMO 4677 の weather_code を返す。前面演出は状態を 6 種に大別すれば足りる
// （明るさは動かさず、水滴・雪粒・もや等のテクスチャで語るため）。
// 参照: https://open-meteo.com/en/docs（WMO Weather interpretation codes）。

import type { WeatherCondition } from "./types.ts";

/** WMO weather_code を演出用の状態に大別する。未知コードは安全側で曇り扱い。 */
export function wmoToCondition(code: number): WeatherCondition {
  // 0=快晴, 1=ほぼ快晴。
  if (code === 0 || code === 1) return "clear";
  // 2=部分的に雲, 3=曇天。
  if (code === 2 || code === 3) return "cloudy";
  // 45=霧, 48=着氷性の霧。
  if (code === 45 || code === 48) return "fog";
  // 95/96/99=雷雨。降水より雷を優先して見せる。
  if (code >= 95 && code <= 99) return "thunder";
  // 71-75=降雪, 77=霧雪, 85/86=にわか雪。
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  // 51-57=霧雨/着氷性霧雨, 61-67=雨/着氷性の雨, 80-82=にわか雨。
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  return "cloudy";
}
