import { useEffect } from "react";
import { jstHour, timeOfDay, type TimeOfDay } from "../../lib/weather/timeOfDay.ts";

// 時間帯（鼓門の JST）を <html data-time> に反映する島（#231 後段②）。
//
// 背景写真は差し替えず、CSS がこの属性でオーバーレイの暗さ・色温度だけを変調する。
// 初期ペイントは MainLayout の head inline script が描画前に設定（flash 回避）、ここでは
// 確定値の再設定＋長時間セッションが時間帯境界をまたいだときの更新（5分ごと）だけを担う。
// 何も描画しない（属性を立てるだけの behavior 島）。天気の前面演出（AmbientWeather）とは独立軸。

const TIMES: TimeOfDay[] = ["morning", "day", "evening", "night"];

/** 現在の時間帯（鼓門の JST）。?time=morning|day|evening|night で強制（dev/blink 用）。 */
function currentTimeOfDay(): TimeOfDay {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("time");
    if (q && (TIMES as string[]).includes(q)) return q as TimeOfDay;
  }
  return timeOfDay(jstHour(new Date()));
}

export default function TimeOfDayController() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.time = currentTimeOfDay();
    };
    apply();
    const id = window.setInterval(apply, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
