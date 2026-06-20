import { afterEach, describe, expect, it } from "vitest";
import type { HanobaWeather } from "./types.ts";
import { WEATHER_TTL_MS, isFresh, readWeatherCache, writeWeatherCache } from "./cache.ts";

// 天気キャッシュの正本テスト（#231）。鮮度判定と localStorage 往復を固定する。

const CACHE_KEY = "hanoba:weather";

function sample(over: Partial<HanobaWeather> = {}): HanobaWeather {
  return {
    condition: "rain",
    weatherCode: 61,
    isDay: true,
    temperature: 18,
    precipitation: 0.5,
    fetchedAt: 1000,
    ...over,
  };
}

afterEach(() => {
  localStorage.clear();
});

describe("isFresh", () => {
  it("TTL 未満は鮮度内", () => {
    const w = sample({ fetchedAt: 1000 });
    expect(isFresh(w, 1000 + WEATHER_TTL_MS - 1)).toBe(true);
  });

  it("TTL ちょうど・超過は鮮度切れ", () => {
    const w = sample({ fetchedAt: 1000 });
    expect(isFresh(w, 1000 + WEATHER_TTL_MS)).toBe(false);
    expect(isFresh(w, 1000 + WEATHER_TTL_MS + 1)).toBe(false);
  });
});

describe("readWeatherCache / writeWeatherCache", () => {
  it("書いて読むと同じ値に戻る", () => {
    const w = sample();
    writeWeatherCache(w);
    expect(readWeatherCache()).toEqual(w);
  });

  it("未保存は null", () => {
    expect(readWeatherCache()).toBeNull();
  });

  it("壊れた JSON は null（次の取得で上書きされる）", () => {
    localStorage.setItem(CACHE_KEY, "{not json");
    expect(readWeatherCache()).toBeNull();
  });

  it("形が欠けた JSON は null", () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ foo: 1 }));
    expect(readWeatherCache()).toBeNull();
  });

  it("weatherCode を欠くエントリは null（素材選択が使う必須項目）", () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ condition: "rain", fetchedAt: 1000 }));
    expect(readWeatherCache()).toBeNull();
  });
});
