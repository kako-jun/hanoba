import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSavedViews, KEY as VIEWS_KEY } from "../../lib/feed/views.ts";
import { useSavedViews } from "./useSavedViews.ts";

// 同タブ即時同期に使う自前イベント名（useSavedViews.ts と一致させる）。
const VIEWS_EVENT = "hanoba:saved-views-changed";

// happy-dom には localStorage 実体があるので、各テストの独立性のために毎回クリアする。
describe("useSavedViews（名前付きビューの購読フック・#139 段階3）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("add(label,query) が localStorage に保存され別インスタンスの views へ同タブ即時同期される（カスタムイベント）", () => {
    // 同ページの2購読者を同時にマウントし、片方の add がもう片方へ伝わることを確認する。
    const writer = renderHook(() => useSavedViews());
    const reader = renderHook(() => useSavedViews());

    expect(writer.result.current.views).toEqual([]);
    expect(reader.result.current.views).toEqual([]);

    act(() => writer.result.current.add("実生", "#実生"));

    // 状態の真実（localStorage）に書かれている。
    const persisted = getSavedViews();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]!).toMatchObject({ label: "実生", query: "#実生" });
    // 追加した本人も更新される。
    expect(writer.result.current.views).toHaveLength(1);
    expect(writer.result.current.views[0]!).toMatchObject({ label: "実生", query: "#実生" });
    // 別インスタンス（同タブ別購読者）の views も自前イベントで再取得されている。
    expect(reader.result.current.views).toHaveLength(1);
    expect(reader.result.current.views[0]!).toMatchObject({ label: "実生", query: "#実生" });
  });

  it("別タブ相当の storage イベント（自キー hanoba:saved-views）で views が再取得される", () => {
    const { result } = renderHook(() => useSavedViews());
    expect(result.current.views).toEqual([]);

    // 別タブが localStorage を直接書き換えた状況を再現する（同タブの add 経路は通らない）。
    window.localStorage.setItem(
      VIEWS_KEY,
      JSON.stringify([{ id: "v1", label: "外から", query: "#外" }]),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: VIEWS_KEY }));
    });

    expect(result.current.views).toEqual([{ id: "v1", label: "外から", query: "#外" }]);
  });

  it("無関係キーの storage イベントでは views を再取得しない（絞り込み）", () => {
    const { result } = renderHook(() => useSavedViews());
    expect(result.current.views).toEqual([]);

    // 別タブがビューと無関係なキーを書き換えても、ビュー側は読み直さない。
    window.localStorage.setItem(
      VIEWS_KEY,
      JSON.stringify([{ id: "v1", label: "拾わない", query: "#拾" }]),
    );
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "hanoba:dilution" }));
    });

    // ビューキーには値が入っているが、無関係イベントなので state は空のまま（sync しない）。
    expect(result.current.views).toEqual([]);
  });

  it("remove(id) でそのビューが views から消える", () => {
    const { result } = renderHook(() => useSavedViews());

    act(() => result.current.add("実生", "#実生"));
    act(() => result.current.add("胴切り", "#胴切り"));
    expect(result.current.views).toHaveLength(2);
    const target = result.current.views[0]!;

    act(() => result.current.remove(target.id));

    expect(result.current.views).toHaveLength(1);
    expect(result.current.views.some((v) => v.id === target.id)).toBe(false);
    expect(result.current.views[0]!.label).toBe("胴切り");
  });

  it("rename(id,label) でラベルが付け替わる（query は変えない）", () => {
    const { result } = renderHook(() => useSavedViews());

    act(() => result.current.add("実生", "#実生"));
    const target = result.current.views[0]!;

    act(() => result.current.rename(target.id, "実生っ子"));

    expect(result.current.views[0]!).toMatchObject({
      id: target.id,
      label: "実生っ子",
      query: "#実生", // query は不変
    });
  });

  it("アンマウント後にイベントが来ても setState せず警告を増やさない（リスナ cleanup）", () => {
    // unmount 後のイベントで setState すると React が console.error で警告する。
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderHook(() => useSavedViews());

    unmount();

    // cleanup でリスナが外れていれば、これらのイベントは何の作用も起こさない。
    act(() => {
      window.localStorage.setItem(
        VIEWS_KEY,
        JSON.stringify([{ id: "v1", label: "後から", query: "#後" }]),
      );
      window.dispatchEvent(new Event(VIEWS_EVENT));
      window.dispatchEvent(new StorageEvent("storage", { key: VIEWS_KEY }));
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
