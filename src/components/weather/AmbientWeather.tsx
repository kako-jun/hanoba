import { useEffect, useState } from "react";
import { getHanobaWeather } from "../../lib/weather/fetch.ts";
import type { WeatherCondition } from "../../lib/weather/types.ts";
import { rainLevel, type RainLevel } from "../../lib/weather/rainLevel.ts";
import { jstHour, timeOfDay, type TimeOfDay } from "../../lib/weather/timeOfDay.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";

// 天気の前面環境レイヤ（#231 段階2 / #132 段階4）。
//
// ハノーバ（＝金沢駅・鼓門）の今の天気を取得し、暗い部屋写真と本文パネルの間（z-index:-1）に
// 環境演出を重ねる。明度は上げない＝「天気＝明るさ」でなく「天気＝ガラス面に起きる現象」で表す
// （暗色シック＝DESIGN §5 を崩さない）。段階2 はまず雨（ガラスの水滴）だけ。
//
// 雨は強度で素材を出し分ける（kako-jun）: 大雨＝密な水滴、普通＝疎な玉＋流れ落ちる雫。
// 本文の手前ではなく奥（z-index:-1）に置くので可読性は無傷・pointer-events:none で操作も妨げない。

const ALLOWED: WeatherCondition[] = ["clear", "cloudy", "rain", "snow", "fog", "thunder"];

interface Forced {
  condition: WeatherCondition;
  level: RainLevel;
}

/** 開発・blink 用に ?weather=rain / heavy / drizzle 等で天気を強制する（実際の鼓門の天気に依らず確認）。 */
function forced(): Forced | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("weather");
  if (!q) return null;
  // 雨の強度ショートカット（テスト用）。
  if (q === "heavy") return { condition: "rain", level: "heavy" };
  if (q === "drizzle") return { condition: "rain", level: "light" };
  if ((ALLOWED as string[]).includes(q)) {
    return { condition: q as WeatherCondition, level: "normal" };
  }
  return null;
}

const TIMES: TimeOfDay[] = ["morning", "day", "evening", "night"];

/** 現在の時間帯（鼓門の JST）。?time=morning|day|evening|night で強制（dev/blink 用）。 */
function currentTimeOfDay(): TimeOfDay {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("time");
    if (q && (TIMES as string[]).includes(q)) return q as TimeOfDay;
  }
  return timeOfDay(jstHour(new Date()));
}

export default function AmbientWeather() {
  const [state, setState] = useState<Forced | null>(null);
  const [reduced, setReduced] = useState(false);

  // 時間帯（鼓門の JST）を <html data-time> に反映する。背景写真は差し替えず、CSS が
  // この属性でオーバーレイの暗さ・色温度だけを変調する（#231 後段②）。初期ペイントは
  // MainLayout の inline script が描画前に設定（flash 回避）、ここでは確定値の再設定＋
  // 長時間セッションが時間帯境界をまたいだときの更新（5分ごと）を担う。
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.time = currentTimeOfDay();
    };
    apply();
    const id = window.setInterval(apply, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setReduced(prefersReducedMotion());

    const f = forced();
    if (f) {
      setState(f);
      return;
    }

    let alive = true;
    getHanobaWeather().then((w) => {
      if (!alive || !w) return;
      setState({ condition: w.condition, level: rainLevel(w.weatherCode, w.precipitation) });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!state) return null;

  // 段階2 は雨だけ（雷雨も水滴として見せる）。他状態は後段で順次追加する。
  const isRain = state.condition === "rain" || state.condition === "thunder";
  if (!isRain) return null;

  // 大雨は密な素材、それ以外（普通・霧雨）は疎＋流れる素材。
  const heavy = state.level === "heavy";
  const className = [
    "ha-weather-rain",
    heavy ? "ha-weather-rain--heavy" : "",
    reduced ? "ha-weather-rain--still" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div aria-hidden="true" data-weather={state.condition} data-rain={state.level} className={className} />;
}
