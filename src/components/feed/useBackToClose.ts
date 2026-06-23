import { useEffect, useRef } from "react";

/**
 * モーダルが開いている間、スマホ/ブラウザの「戻る」で**ページを離れずモーダルだけ閉じる**フック（#454）。
 *
 * 開いた時に**同一 URL** の履歴エントリを1つ積み（`pushState`・URL は変えない）、戻る（popstate）で
 * `onClose` を呼ぶ＝戻る1回でモーダルが閉じ、ページには留まる。✕/Esc 等 popstate 以外で閉じた時は、
 * 積んだエントリを `history.back` で消費する（残すと次の戻るが「閉じ済みモーダルの空振り」になり1回無駄になる）。
 *
 * **deep-link（共有可能 URL）は持たせない**（URL 不変）＝`/me`（あなたの植物・MyGrid）のような非共有モーダル向け。
 * feed/discover/u は共有用の `?p=` を `usePostDeepLink` で積むので、そちらはこのフックを使わない（二重に積まない）。
 *
 * SSR 安全: `window` は effect 内でのみ触る。`onClose` は ref 経由で最新を読む（リスナ貼り直しを避ける）。
 */
export function useBackToClose(isOpen: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    let closedByPop = false;
    try {
      // 戻る用のエントリを1つ積む（URL は変えない＝deep-link にしない）。
      window.history.pushState({ haModal: true }, "");
    } catch {
      return; // 履歴に積めない環境では「戻るで閉じる」機能だけ無効（モーダル自体は従来どおり動く）。
    }
    const onPop = () => {
      // 戻るで積んだエントリが消えた＝モーダルを閉じる（ページは離れない）。
      closedByPop = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // ✕/Esc など popstate 以外で閉じた時は積んだエントリが残るので back で消費する。
      // popstate で閉じた場合は既に消費済みなので戻らない（二重 back を避ける）。
      if (!closedByPop) {
        try {
          window.history.back();
        } catch {
          /* back 不能でも実害なし（履歴に余分が残るだけ）。 */
        }
      }
    };
  }, [isOpen]);
}
