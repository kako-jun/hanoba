import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../../lib/feed/parse.ts";

// #103: 著者プロフィール取得を単発から bounded retry に変えたデグレ修正の回帰テスト。
// relay 取得（fetchProfiles）はモック境界で止め、fake timer で retry を決定的に検証する。
const fetchProfiles = vi.fn<(pubkeys: string[]) => Promise<Map<string, Profile>>>();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchProfiles: (...args: [string[]]) => fetchProfiles(...args),
}));

import { useProfiles } from "./useProfiles.ts";

const PROFILE: Profile = {
  name: "みどり園",
  picture: "https://image.nostr.build/midori.jpg",
  about: null,
  websites: [],
  favoriteVarieties: [],
};
const EMPTY: Profile = { name: null, picture: null, about: null, websites: [], favoriteVarieties: [] };

function mapOf(...entries: [string, Profile][]): Map<string, Profile> {
  return new Map(entries);
}

// 微小経過＝timer 無しの fetch（初回 run）の microtask を流すだけ。
async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

// retry 1 回ぶん（RETRY_DELAY_MS=700）進めて microtask も流す。
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useProfiles (#103 bounded retry)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchProfiles.mockReset();
  });

  afterEach(() => {
    cleanup(); // unmount で alive=false にしてから残 timer を破棄する。
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("初回で取得できれば profile を返し、retry しない", async () => {
    const pk = "a".repeat(64);
    fetchProfiles.mockResolvedValue(mapOf([pk, PROFILE]));

    const { result } = renderHook(() => useProfiles([pk]));
    await flush();

    expect(result.current.get(pk)).toEqual(PROFILE);
    expect(fetchProfiles).toHaveBeenCalledTimes(1);
  });

  it("初回取りこぼし（空 Map）でも retry で取得できれば profile を返す", async () => {
    const pk = "b".repeat(64);
    fetchProfiles
      .mockResolvedValueOnce(new Map()) // 初回ミス（lagging relay）
      .mockResolvedValueOnce(mapOf([pk, PROFILE])); // retry で成功

    const { result } = renderHook(() => useProfiles([pk]));
    await flush();
    // retry 待ちの間は Map に入らない＝呼び出し側は npub フォールバック表示。
    expect(result.current.has(pk)).toBe(false);

    await advance(700);
    expect(result.current.get(pk)).toEqual(PROFILE);
    expect(fetchProfiles).toHaveBeenCalledTimes(2);
  });

  it("一部だけ取得できた場合、取りこぼした著者だけ retry の対象にする", async () => {
    const a = "c".repeat(64);
    const b = "d".repeat(64);
    fetchProfiles
      .mockResolvedValueOnce(mapOf([a, PROFILE])) // a だけ取れた
      .mockResolvedValueOnce(mapOf([b, PROFILE])); // retry で b

    const { result } = renderHook(() => useProfiles([a, b]));
    await flush();
    expect(result.current.get(a)).toEqual(PROFILE);
    expect(result.current.has(b)).toBe(false);

    await advance(700);
    expect(result.current.get(b)).toEqual(PROFILE);
    // retry は取りこぼした著者（b）だけを引き直す（取れた a を巻き込まない）。
    expect(fetchProfiles).toHaveBeenLastCalledWith([b]);
  });

  it("retry 予算を使い切ったら EMPTY 確定し、再取得ループに入らない", async () => {
    const pk = "e".repeat(64);
    fetchProfiles.mockResolvedValue(new Map()); // 常にミス

    const { result } = renderHook(() => useProfiles([pk]));
    await flush(); // 初回 run
    await advance(700 * 3); // RETRY_LIMIT(3) 回の retry

    // 初回 + retry 3 回 = 4 回で打ち切り。
    expect(fetchProfiles).toHaveBeenCalledTimes(4);
    expect(result.current.get(pk)).toEqual(EMPTY);

    // さらに時間が進んでも再取得しない（無限ループ防止が効いている）。
    await advance(5000);
    expect(fetchProfiles).toHaveBeenCalledTimes(4);
  });

  it("EMPTY 確定後の著者は引き直さないが、新しい著者は新しい予算で引き直す", async () => {
    const stale = "1".repeat(64);
    const fresh = "2".repeat(64);
    fetchProfiles.mockResolvedValue(new Map()); // stale は常にミス

    const { result, rerender } = renderHook(({ keys }) => useProfiles(keys), {
      initialProps: { keys: [stale] },
    });
    await flush();
    await advance(700 * 3); // 予算消化 → stale は EMPTY 確定
    expect(result.current.get(stale)).toEqual(EMPTY);

    // 新しい著者が混ざって effect が再走しても、EMPTY 確定済みの stale は対象に入れない
    // （#103 の loop-breaker）。新著者 fresh だけを新しい予算で引き直す。
    fetchProfiles.mockReset().mockResolvedValue(mapOf([fresh, PROFILE]));
    rerender({ keys: [stale, fresh] });
    await flush();
    expect(fetchProfiles).toHaveBeenCalledTimes(1);
    expect(fetchProfiles).toHaveBeenLastCalledWith([fresh]);
    expect(result.current.get(fresh)).toEqual(PROFILE);
    expect(result.current.get(stale)).toEqual(EMPTY); // stale は再取得されない
  });

  it("fetchProfiles が（万一）reject しても hook は落ちず retry で回復する", async () => {
    // 本番の fetchProfiles は内部で握り潰して空 Map を返す＝reject しない。これは
    // 防御的に足した `.catch(() => new Map())`（依存が reject しても hook が壊れない）の検証。
    const pk = "f".repeat(64);
    fetchProfiles
      .mockRejectedValueOnce(new Error("relay down")) // 依存が reject しても
      .mockResolvedValueOnce(mapOf([pk, PROFILE])); // retry で回復する

    const { result } = renderHook(() => useProfiles([pk]));
    await flush();
    expect(result.current.has(pk)).toBe(false);

    await advance(700);
    expect(result.current.get(pk)).toEqual(PROFILE);
  });
});
