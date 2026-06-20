// 雨の強度（#231 段階2）。素材を強度で出し分けるための大別。
//
// kako-jun: 密な水滴素材は「大雨」用、疎＋流れる雫の素材は「普通の雨」用。
// Open-Meteo の weather_code（雨の強さを内包）と precipitation(mm) から 3 段に大別する。

export type RainLevel = "light" | "normal" | "heavy";

/** 大雨/豪雨/雷雨を表す WMO code。 */
const HEAVY_CODES = new Set([65, 67, 82, 95, 96, 99]);
/** 霧雨（弱い雨）を表す WMO code。 */
const LIGHT_CODES = new Set([51, 53, 55, 56, 57]);

/** 雨の強度を大別する。precipitation(mm) が十分大きければ code に依らず heavy に寄せる。 */
export function rainLevel(weatherCode: number, precipitation: number | null = null): RainLevel {
  if (HEAVY_CODES.has(weatherCode)) return "heavy";
  if (precipitation != null && precipitation >= 4) return "heavy";
  if (LIGHT_CODES.has(weatherCode)) return "light";
  return "normal";
}
