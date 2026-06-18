import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDilution } from "../../lib/feed/dilution.ts";
import { useDilution, useDilutionFor } from "./useDilution.ts";

// 同タブ即時同期に使う自前イベント名（useDilution.ts と一致させる）。
const DILUTION_EVENT = "hanoba:dilution-changed";

// happy-dom には localStorage 実体があるので、各テストの独立性のために毎回クリアする。
describe("useDilution / useDilutionFor（間引き設定の購読フック・#138）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("useDilutionFor.setLevel が localStorage に保存され useDilution の map にも即時反映される（同タブ・カスタムイベント同期）", () => {
    // 同ページの2購読者を同時にマウントし、片方の設定がもう片方へ伝わることを確認する。
    const grid = renderHook(() => useDilution());
    const control = renderHook(() => useDilutionFor("alice"));

    expect(grid.result.current.map).toEqual({});
    expect(control.result.current.level).toBeNull();

    act(() => control.result.current.setLevel(5));

    // 状態の真実（localStorage）に書かれている。
    expect(getDilution("alice")).toBe(5);
    // 設定したコントロール自身も更新される。
    expect(control.result.current.level).toBe(5);
    // 別購読者（グリッド）の map も同タブイベントで再取得されている。
    expect(grid.result.current.map).toEqual({ alice: 5 });
  });

  it("別タブ相当の storage イベントで useDilution の map が再取得される", () => {
    const { result } = renderHook(() => useDilution());
    expect(result.current.map).toEqual({});

    // 別タブが localStorage を直接書き換えた状況を再現する（同タブの set 経路は通らない）。
    window.localStorage.setItem("hanoba:dilution", JSON.stringify({ bob: 10 }));
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "hanoba:dilution" }));
    });

    expect(result.current.map).toEqual({ bob: 10 });
  });

  it("useDilutionFor.setLevel(null) で解除すると useDilution の map からその人が消える（同タブ同期）", () => {
    // 書き込みは useDilutionFor、購読は useDilution。別フックの解除が map に反映されることを見る。
    const grid = renderHook(() => useDilution());
    const control = renderHook(() => useDilutionFor("alice"));

    act(() => control.result.current.setLevel(2));
    expect(grid.result.current.map).toEqual({ alice: 2 });
    expect(control.result.current.level).toBe(2);

    act(() => control.result.current.setLevel(null));
    expect(grid.result.current.map).toEqual({});
    expect(control.result.current.level).toBeNull();
    expect(getDilution("alice")).toBeNull();
  });

  it("アンマウント後にイベントが来ても setState せず警告を増やさない（リスナ cleanup）", () => {
    // unmount 後のイベントで setState すると React が console.error で警告する。
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderHook(() => useDilution());

    unmount();

    // cleanup でリスナが外れていれば、これらのイベントは何の作用も起こさない。
    act(() => {
      window.localStorage.setItem("hanoba:dilution", JSON.stringify({ alice: 5 }));
      window.dispatchEvent(new Event(DILUTION_EVENT));
      window.dispatchEvent(new StorageEvent("storage", { key: "hanoba:dilution" }));
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
