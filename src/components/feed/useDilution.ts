import { useCallback, useEffect, useState } from "react";
import {
  getAllDilutions,
  getDilution,
  KEY as DILUTION_KEY,
  setDilution as persistDilution,
  type DilutionLevel,
  type DilutionMap,
} from "../../lib/feed/dilution.ts";

// 間引き設定が変わったことを島の間で伝えるカスタムイベント名（#138）。
// 拡大モーダル（PostDetail）で設定すると、同ページのグリッド（PostGrid）が即座に再間引きできる。
// storage イベントは「別タブ」でしか発火しないので、同タブ内の即時反映には自前イベントを使う。
const DILUTION_EVENT = "hanoba:dilution-changed";

// 別タブの storage イベントは「あらゆる」localStorage 変更で飛んでくる。間引きキー
// （または clear() を表す key===null）だけに反応し、無関係な書き込みでは再同期しない。
function isDilutionStorageEvent(e: StorageEvent): boolean {
  return e.key === null || e.key === DILUTION_KEY;
}

/**
 * 間引き設定（pubkey → level）の状態を購読するフック（#138）。
 *
 * - `map`: 現在の全設定（live な購読・読み取り専用ビュー）。
 * - 別タブでの変更（storage イベント）も拾って同期する。
 *
 * 書き込みは {@link useDilutionFor} 経由で行う（このフックは購読のみ）。
 * 状態の真実は localStorage（dilution.ts）。このフックはその薄い React ビュー。
 */
export function useDilution(): { map: DilutionMap } {
  // SSR では localStorage が無く空。マウント後に sync で実値へ寄せる。
  const [map, setMap] = useState<DilutionMap>({});

  const sync = useCallback(() => setMap(getAllDilutions()), []);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (isDilutionStorageEvent(e)) sync();
    };
    window.addEventListener(DILUTION_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DILUTION_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  return { map };
}

// 単独の pubkey の level だけが欲しい場合の薄いラッパ（モーダルのコントロール用）。
// グローバル map を購読せず、変更通知だけ受けて自分の値を引き直す。
export function useDilutionFor(pubkey: string): {
  level: DilutionLevel | null;
  setLevel: (level: DilutionLevel | null) => void;
} {
  const [level, setLevelState] = useState<DilutionLevel | null>(null);

  const sync = useCallback(() => setLevelState(getDilution(pubkey)), [pubkey]);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (isDilutionStorageEvent(e)) sync();
    };
    window.addEventListener(DILUTION_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(DILUTION_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [sync]);

  const setLevel = useCallback((next: DilutionLevel | null) => {
    persistDilution(pubkey, next);
    sync();
    window.dispatchEvent(new Event(DILUTION_EVENT));
  }, [pubkey, sync]);

  return { level, setLevel };
}
