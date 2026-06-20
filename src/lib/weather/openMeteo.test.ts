import { describe, expect, it } from "vitest";
import { HANOBA_COORDS, buildCurrentUrl, parseOpenMeteoCurrent } from "./openMeteo.ts";

// Open-Meteo URL 生成とレスポンスパースの正本テスト（#231）。

describe("buildCurrentUrl", () => {
  it("鼓門の固定座標と current パラメータを JST で組む", () => {
    const url = new URL(buildCurrentUrl());
    expect(url.origin + url.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(url.searchParams.get("latitude")).toBe(String(HANOBA_COORDS.latitude));
    expect(url.searchParams.get("longitude")).toBe(String(HANOBA_COORDS.longitude));
    expect(url.searchParams.get("current")).toContain("weather_code");
    expect(url.searchParams.get("current")).toContain("is_day");
    expect(url.searchParams.get("timezone")).toBe("Asia/Tokyo");
  });

  it("座標を渡せば上書きできる（テスト・将来の手動地点用）", () => {
    const url = new URL(buildCurrentUrl({ latitude: 35.0, longitude: 135.0 }));
    expect(url.searchParams.get("latitude")).toBe("35");
    expect(url.searchParams.get("longitude")).toBe("135");
  });
});

describe("parseOpenMeteoCurrent", () => {
  it("正常な応答を HanobaWeather に変換し、取得時刻を刻む", () => {
    const json = {
      current: { weather_code: 61, is_day: 1, temperature_2m: 18.4, precipitation: 0.8 },
    };
    const w = parseOpenMeteoCurrent(json, 1000);
    expect(w).not.toBeNull();
    expect(w!.condition).toBe("rain");
    expect(w!.weatherCode).toBe(61);
    expect(w!.isDay).toBe(true);
    expect(w!.temperature).toBe(18.4);
    expect(w!.precipitation).toBe(0.8);
    expect(w!.fetchedAt).toBe(1000);
  });

  it("is_day=0 は夜（false）", () => {
    const w = parseOpenMeteoCurrent({ current: { weather_code: 0, is_day: 0 } }, 0);
    expect(w!.isDay).toBe(false);
  });

  it("is_day 欠損は昼扱い（安全側＝暗くしない）", () => {
    const w = parseOpenMeteoCurrent({ current: { weather_code: 0 } }, 0);
    expect(w!.isDay).toBe(true);
  });

  it("気温・降水量の欠損は null", () => {
    const w = parseOpenMeteoCurrent({ current: { weather_code: 3 } }, 0);
    expect(w!.temperature).toBeNull();
    expect(w!.precipitation).toBeNull();
  });

  it("current や weather_code が欠ければ null", () => {
    expect(parseOpenMeteoCurrent({}, 0)).toBeNull();
    expect(parseOpenMeteoCurrent({ current: {} }, 0)).toBeNull();
    expect(parseOpenMeteoCurrent(null, 0)).toBeNull();
    expect(parseOpenMeteoCurrent({ current: { weather_code: "61" } }, 0)).toBeNull();
  });
});
