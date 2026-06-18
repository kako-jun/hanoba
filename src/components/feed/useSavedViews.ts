import { useCallback, useEffect, useState } from "react";
import {
  addSavedView as persistAdd,
  getSavedViews,
  KEY as VIEWS_KEY,
  removeSavedView as persistRemove,
  type SavedView,
} from "../../lib/feed/views.ts";

// 名前付きビューが変わったことを島の間で伝えるカスタムイベント名（#139 段階3・dilution と同型）。
// storage イベントは「別タブ」でしか発火しないので、同タブ内の即時反映には自前イベントを使う。
const VIEWS_EVENT = "hanoba:saved-views-changed";

// 別タブの storage イベントは「あらゆる」localStorage 変更で飛んでくる。ビューのキー
// （または clear() を表す key===null）だけに反応し、無関係な書き込みでは再同期しない。
function isViewsStorageEvent(e: StorageEvent): boolean {
  return e.key === null || e.key === VIEWS_KEY;
}

/**
 * 保存済みビュー（配列）の状態を購読し、追加・削除を行うフック（#139 段階3）。
 *
 * - `views`: 現在の全ビュー（live な購読・配列順）。SSR では空、マウント後に実値へ寄せる。
 * - `add` / `remove`: localStorage を更新し、同タブ（カスタムイベント）・別タブ（storage）
 *   の両方へ変更を通知する。状態の真実は localStorage（views.ts）。このフックはその薄い React ビュー。
 */
export function useSavedViews(): {
  views: SavedView[];
  add: (label: string, query: string) => void;
  remove: (id: string) => void;
} {
  const [views, setViews] = useState<SavedView[]>([]);

  const sync = useCallback(() => setViews(getSavedViews()), []);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (isViewsStorageEvent(e)) sync();
    };
    window.addEventListener(VIEWS_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(VIEWS_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  const notify = useCallback(() => {
    sync();
    window.dispatchEvent(new Event(VIEWS_EVENT));
  }, [sync]);

  const add = useCallback((label: string, query: string) => {
    persistAdd(label, query);
    notify();
  }, [notify]);

  const remove = useCallback((id: string) => {
    persistRemove(id);
    notify();
  }, [notify]);

  return { views, add, remove };
}
