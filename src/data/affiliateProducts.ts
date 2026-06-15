// #27: Hanoba アフィリエイト（道具棚）データ層。orber の affiliateProducts.ts を
// 横展開したもの。UI 層は `src/components/AffiliateGrid.astro`。
//
// 商品・キャプションはすべて kako-jun の **実際の Amazon アソシエイト選定品**
// （ハイドロ・液体肥料系）。アソシエイト ID は `ultimate-battle-22` で、
// **amzn.to 短縮リンクに既に焼き込み済み**（Associates ダッシュボードで生成）。
// → tag を URL に追記・変更してはいけない。amzn.to をそのまま使う。
//
// 画像 URL は Amazon CDN（m.media-amazon.com/images/I/{IMAGEID}.jpg）を生で使う。
// 2 件目の URL に含まれる `+` は Amazon のパスの一部なので、そのまま残すこと。
//
// **差し替えはこのファイルだけ編集すれば済む**。スロット全体を一時的に消すなら
// `AFFILIATE_ENABLED = false` にする。フィード/discover への配置は v1 では未実施
// （密度は kako-jun の判断待ち）。

export interface AffiliateProduct {
  /** 商品ページへの amzn.to 短縮 URL（Associates ダッシュボードで生成・tag 焼き込み済み）。 */
  url: string;
  /** Amazon 商品の正式タイトル（短縮可）。 */
  title: string;
  /** Amazon CDN の商品メイン画像 URL。 */
  imageUrl: string;
  /** kako-jun が商品ごとに書く一言コメント（実際の使用感）。 */
  caption: string;
}

/** スロット全体の ON/OFF。false にすると道具棚は一切描画されない。 */
export const AFFILIATE_ENABLED = true;

export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [
  {
    url: "https://amzn.to/4vtUFDT",
    title: "メネデール 植物活力剤 200ml",
    imageUrl: "https://m.media-amazon.com/images/I/71CSkHQv3UL._AC_SL1500_.jpg",
    caption: "小さいほうがスポイトと合います",
  },
  {
    url: "https://amzn.to/4eHbt3X",
    title: "ハイポネックス原液 450ml",
    imageUrl: "https://m.media-amazon.com/images/I/61+YKcbhVyL._AC_SL1500_.jpg",
    caption: "色がつくので水と区別しやすい",
  },
  {
    url: "https://amzn.to/4uyViKI",
    title: "協和ハイポニカ 液体肥料 500ml（A・Bセット）",
    imageUrl: "https://m.media-amazon.com/images/I/81POgAxvkVL._AC_SL1500_.jpg",
    caption: "遮光しないとすぐ緑水になるくらいガチ",
  },
];
