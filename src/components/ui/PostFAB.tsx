/**
 * 投稿フローティングボタン（#283）。全ページ常駐（MainLayout が /compose では出さない）。
 * 右下隅の「一番上へ戻る」（ScrollToTop）の左隣に固定スロットで置く。
 * ScrollToTop の表示/非表示で位置がジャンプしないよう、隅は ScrollToTop 専用に空け、
 * 投稿 FAB は常に左スロット（right-[4.75rem] = 20px+44px+12px gap）に固定する。
 * 塗りの緑（ヘッダ「投稿する」と同トーン）で控えめな glass の ScrollToTop より目立たせる。
 * ただのリンク遷移（SSR 安全・window 参照なし・reduced-motion 配慮不要）。
 *
 * アイコンは「横から見た綿毛（タンポポの種1粒）」＝投稿＝写真を風に乗せて世界へ放つメタファ（#148/#283）。
 * 真上ビューの放射状（＊状）と紛れない太め抽象グリフを gpt-image-2 で生成し、白い透過 webp に焼いた
 * もの（`public/post-fab.webp`）。線アイコン集（Icon.tsx）は currentColor の SVG だが、これは綿毛の
 * 柔らかさを出すため例外的にラスタ。装飾なので alt 空（リンク側 aria-label が読み上げを担う）。
 *
 * lang は MainLayout がページの locale を流す（#147）＝SSR/初期描画の種（ja）。
 * マウント後に resolveClientLocale() で表示言語を確定する（en を選んでいれば en で描き直す）。
 * leaf 島も殻と同じ言語に揃える（hydration mismatch を避けるため初期は ja、post-mount で正す）。
 */
import { useEffect, useState } from "react";
import { useT, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";

export default function PostFAB({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
  return (
    <a
      href="/compose"
      aria-label={t("fab.compose.aria")}
      className="fixed bottom-5 right-[4.75rem] z-40 grid place-items-center w-11 h-11 rounded-full bg-ha-green text-ha-white shadow-lg hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
    >
      <img src="/post-fab.webp" alt="" className="h-7 w-auto" draggable={false} />
    </a>
  );
}
