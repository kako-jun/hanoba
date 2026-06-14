import { useEffect, useState } from "react";
import Icon from "./ui/Icon.tsx";

const STORAGE_KEY = "hanoba:disclaimer-dismissed";

/**
 * 断り書きの常設バナー（DESIGN.md §2）。
 * hanoba は mypace（Nostr）のフィードを表示しているだけ。二重投稿でもコピーでもない。
 *
 * dismissible: 「閉じた」を localStorage に記憶し、以後は表示しない。
 * SSR/hydration 不整合を避けるため、初期表示はサーバ/クライアントで一致させ、
 * localStorage の参照は useEffect 内（クライアントのみ）で行う。
 */
export default function DisclaimerNotice() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage 不可（プライベートモード等）は無視して表示する
    }
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 保存できなくても閉じる動作自体は通す
    }
  }

  if (dismissed) {
    return null;
  }

  return (
    <aside role="note" className="glass rounded-2xl text-ha-ink px-4 py-3 flex items-start gap-3">
      <p className="text-sm leading-relaxed flex-1 text-ha-ink/85">
        Nostr のフィードを表示しているだけです。二重投稿でもコピーでもありません。同じ投稿は
        mypace でも見られます。
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="この案内を閉じる"
        className="shrink-0 grid place-items-center rounded-full bg-white/10 text-ha-ink w-7 h-7 hover:bg-ha-green hover:text-ha-white transition-colors"
      >
        <Icon name="close" className="w-4 h-4" />
      </button>
    </aside>
  );
}
