import Icon from "./Icon.tsx";

/**
 * 投稿フローティングボタン（#283）。全ページ常駐（MainLayout が /compose では出さない）。
 * 右下隅の「一番上へ戻る」（ScrollToTop）の左隣に固定スロットで置く。
 * ScrollToTop の表示/非表示で位置がジャンプしないよう、隅は ScrollToTop 専用に空け、
 * 投稿 FAB は常に左スロット（right-[4.75rem] = 20px+44px+12px gap）に固定する。
 * 塗りの緑（ヘッダ「投稿する」と同トーン）で控えめな glass の ScrollToTop より目立たせる。
 * ただのリンク遷移（SSR 安全・window 参照なし・reduced-motion 配慮不要）。
 */
export default function PostFAB() {
  return (
    <a
      href="/compose"
      aria-label="投稿する"
      className="fixed bottom-5 right-[4.75rem] z-40 grid place-items-center w-11 h-11 rounded-full bg-ha-green text-ha-white shadow-lg hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
    >
      <Icon name="sprout" className="w-5 h-5" />
    </a>
  );
}
