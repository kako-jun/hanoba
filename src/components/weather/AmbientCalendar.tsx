import { useEffect } from "react";
import { jstHour, timeOfDay, type TimeOfDay } from "../../lib/weather/timeOfDay.ts";
import { solarPhaseOf, SOLAR_PHASES, type SolarPhase } from "../../lib/weather/solarPhase.ts";

// 暦由来の環境状態を <html> 属性に反映する島（#231 後段②/①）。何も描画しない behavior 島。
//
// - data-time（時間帯・鼓門 JST）→ CSS が背景オーバーレイの暗さ・色温度を変調（後段②）
// - data-sekki（八節・鼓門 JST の暦日）→ CSS が背景写真そのものを差し替え（後段①・季節）
//
// どちらも初期ペイントは MainLayout の head inline script が描画前に設定（flash 回避）、
// ここでは確定値の再設定＋長時間セッションの境界またぎ更新（5分ごと）を担う。
// 天気の前面演出（AmbientWeather）とは独立軸＝3軸（季節=地／時刻=明るさ／天気=水滴）が合成される。

const TIMES: TimeOfDay[] = ["morning", "day", "evening", "night"];

/** 現在の時間帯（鼓門の JST）。?time= で強制（dev/blink 用）。 */
function currentTimeOfDay(): TimeOfDay {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("time");
    if (q && (TIMES as string[]).includes(q)) return q as TimeOfDay;
  }
  return timeOfDay(jstHour(new Date()));
}

/** 現在の八節（鼓門の JST 暦日）。?sekki= で強制（dev/blink 用）。 */
function currentSolarPhase(): SolarPhase {
  if (typeof window !== "undefined") {
    const q = new URLSearchParams(window.location.search).get("sekki");
    if (q && (SOLAR_PHASES as string[]).includes(q)) return q as SolarPhase;
  }
  return solarPhaseOf(new Date());
}

export default function AmbientCalendar() {
  useEffect(() => {
    const apply = () => {
      const root = document.documentElement;
      root.dataset.time = currentTimeOfDay();
      root.dataset.sekki = currentSolarPhase();
    };
    apply();
    const id = window.setInterval(apply, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  return null;
}
