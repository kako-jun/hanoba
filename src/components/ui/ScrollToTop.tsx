import { useEffect, useState } from "react";
import Icon from "./Icon.tsx";

/**
 * 「一番上へ戻る」フローティングボタン（#110）。全ページ共通（MainLayout）。
 * 一定量スクロールしたら右下に出現し、押すと最上部へスムーズスクロール。
 * 暗地グラスの世界観に合わせ控えめに。スクロール監視は passive。
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll(); // 初期位置を反映（リロード時に下にいる場合）。
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="一番上へ戻る"
      className="fixed bottom-5 right-5 z-40 grid place-items-center w-11 h-11 rounded-full glass-strong text-ha-green-deep shadow-lg hover:text-ha-green hover:brightness-110 transition-colors"
    >
      <Icon name="chevron" className="w-5 h-5 rotate-180" />
    </button>
  );
}
