// ハノーバ（＝金沢駅・鼓門）の天気の型（#231）。
//
// 「天気＝明るさ」ではなく「天気＝ガラス面に起きる現象」で表す方針なので、
// 表示側が必要とするのは大別した condition。原コード（weatherCode）と is_day は
// 後段（昼夜演出・状態細分化）のために保持しておく。

/** 大別した天気状態。前面レイヤ（AmbientWeather）はこの値で演出を切り替える。 */
export type WeatherCondition = "clear" | "cloudy" | "rain" | "snow" | "fog" | "thunder";

export interface HanobaWeather {
  /** 大別した天気状態。 */
  condition: WeatherCondition;
  /** WMO weather code（原データ。後段の細分化用に保持）。 */
  weatherCode: number;
  /** 昼か（Open-Meteo is_day=1）。昼夜演出は後段なので今は保持のみ。 */
  isDay: boolean;
  /** 気温（℃）。取得不能なら null。 */
  temperature: number | null;
  /** 直近の降水量（mm）。取得不能なら null。 */
  precipitation: number | null;
  /** 取得時刻（epoch ms）。キャッシュ鮮度判定に使う。 */
  fetchedAt: number;
}
