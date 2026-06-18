import { useCallback, useEffect, useState } from "react";
import {
  getAllDilutions,
  getDilution,
  setDilution as persistDilution,
  type DilutionLevel,
  type DilutionMap,
} from "../../lib/feed/dilution.ts";

// 間引き設定が変わったことを島の間で伝えるカスタムイベント名（#138）。
// 拡大モーダル（PostDetail）で設定すると、同ページのグリッド（PostGrid）が即座に再間引きできる。
// storage イベントは「別タブ」でしか発火しないので、同タブ内の即時反映には自前イベントを使う。
const DILUTION_EVENT = "hanoba:dilution-changed";

/**
 * 間引き設定（pubkey → level）の状態を購読するフック（#138）。
 *
 * - `map`: 現在の全設定。
 * - `setDilution(pubkey, level|null)`: 設定を保存し、同ページの全購読者へ即時通知する。
 * - 別タブでの変更（storage イベント）も拾って同期する。
 *
 * 状態の真実は localStorage（dilution.ts）。このフックはその薄い React ビュー。
 */
export function useDilution(): {
  map: DilutionMap;
  setDilution: (pubkey: string, level: DilutionLevel | null) => void;
} {
  // SSR では localStorage が無く空。マウント後に sync で実値へ寄せる。
  const [map, setMap] = useState<DilutionMap>({});

  const sync = useCallback(() => setMap(getAllDilutions()), []);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    window.addEventListener(DILUTION_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(DILUTION_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [sync]);

  const setDilution = useCallback((pubkey: string, level: DilutionLevel | null) => {
    persistDilution(pubkey, level);
    sync();
    // 同タブの他購読者（開いているグリッド等）へ通知する。
    window.dispatchEvent(new Event(DILUTION_EVENT));
  }, [sync]);

  return { map, setDilution };
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
    window.addEventListener(DILUTION_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(DILUTION_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [sync]);

  const setLevel = useCallback((next: DilutionLevel | null) => {
    persistDilution(pubkey, next);
    sync();
    window.dispatchEvent(new Event(DILUTION_EVENT));
  }, [pubkey, sync]);

  return { level, setLevel };
}
