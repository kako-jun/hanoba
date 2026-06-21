// ヘッダ/フッタの「/about」リンクの表記（#262）。
//
// 訪問者(L0・名乗り前)には世界観の入口「Hanōba とは」を、名乗り済みの市民(L1+)には
// 自分のための本「市民手帳」を見せる。/about の中身は市長ボタニクスの声で語る『ハノーバ市民手帳』
// そのものなので、移住済みの人には「とは（=これは何か）」より「手帳」の方が実体に合う。
//
// L1↔L2（古参）の細分はクライアント判定にネットワーク（投稿数・在籍日数）が要り、ナビ文言には
// 過剰でちらつく。名乗り有無（getDisplayName・同期 localStorage）だけで 2 状態に切り替える
// ＝フラッシュ最小・backendless。SSG は訪問者表記で焼き、クライアントで市民なら差し替える。
//
// 文言は #147 で i18n カタログ（about.label.*）へ移管。locale を受けて t() で引く（aboutLabel）。
// 後方互換のため DEFAULT_LOCALE で解決した定数も従来どおり export する（SiteHeader/SiteFooter）。

import { t } from "../i18n/t.ts";
import { DEFAULT_LOCALE, type Locale } from "../i18n/locale.ts";

/** 訪問者（L0・名乗り前）向けの /about ラベル。 */
export function aboutLabelVisitor(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "about.label.visitor");
}

/** 市民（L1+・名乗り済み）向けの /about ラベル。 */
export function aboutLabelCitizen(locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, "about.label.citizen");
}

/** 後方互換 const（ja 既定）。SiteHeader/SiteFooter が import する。 */
export const ABOUT_LABEL_VISITOR = aboutLabelVisitor(DEFAULT_LOCALE);
export const ABOUT_LABEL_CITIZEN = aboutLabelCitizen(DEFAULT_LOCALE);
