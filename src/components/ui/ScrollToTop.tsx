import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
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

  function toTop() {
    // モーション抑制設定を尊重する（DESIGN §5.2）。共有ヘルパに一本化（#275）。
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="一番上へ戻る"
      // 操作要素の慣習に合わせ rest=ha-green / hover=ha-green-deep（明）＋focus リング。
      className="fixed bottom-5 right-5 z-40 grid place-items-center w-11 h-11 rounded-full glass-strong text-ha-green shadow-lg hover:text-ha-green-deep transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
    >
      <Icon name="chevron" className="w-5 h-5 rotate-180" />
    </button>
  );
}
