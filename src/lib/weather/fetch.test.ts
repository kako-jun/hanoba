import { afterEach, describe, expect, it, vi } from "vitest";
import { getHanobaWeather } from "./fetch.ts";
import { writeWeatherCache } from "./cache.ts";

// getHanobaWeather の正本テスト（#231）。fetch をモックして
// キャッシュ優先・更新・失敗時フォールバックの分岐を固定する。

function okResponse(weatherCode: number) {
  return {
    ok: true,
    json: async () => ({ current: { weather_code: weatherCode, is_day: 1 } }),
  } as Response;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("getHanobaWeather", () => {
  it("鮮度内のキャッシュがあれば fetch せずそれを返す", async () => {
    writeWeatherCache({
      condition: "snow",
      weatherCode: 71,
      isDay: true,
      temperature: 1,
      precipitation: 0,
      fetchedAt: 1000,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const w = await getHanobaWeather(1500);
    expect(w?.condition).toBe("snow");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("キャッシュが古ければ取得して更新する", async () => {
    writeWeatherCache({
      condition: "snow",
      weatherCode: 71,
      isDay: true,
      temperature: 1,
      precipitation: 0,
      fetchedAt: 0,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(61));
    const now = 999_999_999;
    const w = await getHanobaWeather(now);
    expect(w?.condition).toBe("rain");
    expect(w?.fetchedAt).toBe(now);
  });

  it("キャッシュが無ければ取得する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(okResponse(0));
    const w = await getHanobaWeather(123);
    expect(w?.condition).toBe("clear");
  });

  it("ネットワーク失敗時は古いキャッシュにフォールバックする", async () => {
    writeWeatherCache({
      condition: "cloudy",
      weatherCode: 3,
      isDay: true,
      temperature: 10,
      precipitation: 0,
      fetchedAt: 0,
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const w = await getHanobaWeather(999_999_999);
    expect(w?.condition).toBe("cloudy");
  });

  it("キャッシュも無くネットワークも失敗なら null", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await getHanobaWeather(1)).toBeNull();
  });
});
