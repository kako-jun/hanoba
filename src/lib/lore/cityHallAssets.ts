// ハノーバ市民手帳（CityHallBook）が使う静的画像アセットのパス（#484 should-2）。
//
// 元は CityHallBook.tsx（MAYOR_AVATAR_SRC 定数・inline style の url(...) リテラル）・
// about.astro（preload href）・MainLayout.headSlot.test.ts（PRELOAD_IMAGES）の3箇所に
// 同じパス文字列が独立にハードコードされていた。CityHallBook.tsx 側だけパスを変えると、
// preload は無関係な旧パスを先取りし続け、テストも自身の古いハードコード値と一致して
// 緑のまま通ってしまう（偽陰性）。ここを唯一の正本にし、3箇所とも import して使う。

/** 和綴じ本の枠（border-image・CityHallBook 本体パネル）。 */
export const BOOK_FRAME_SRC = "/book-frame-washi-v1.webp";

/** 和綴じ本の頁地（background-image・CityHallBook 本体パネル）。 */
export const BOOK_PAGE_SRC = "/book-page-washi-v1.webp";

/** 市長ボタニクス・フォン・ハノーバの肖像（顔は秘密という世界観のため、ジョウロの写真・#219①）。 */
export const MAYOR_AVATAR_SRC = "/mayor-botanics-watering-can.webp";

/** P2 街の地図の挿絵（葉形・葉脈川入り・#137/#504）。 */
export const MAP_IMAGE_SRC = "/hanoba-map.webp";

/** P1 移住案内の挿絵（街の俯瞰ビスタ・段落間に挟む・#504）。 */
export const WELCOME_VISTA_SRC = "/hanoba-welcome-vista.webp";

/** about.astro が head slot で preload する3枚（順序固定・#484）。 */
export const CITY_HALL_PRELOAD_IMAGES = [BOOK_FRAME_SRC, BOOK_PAGE_SRC, MAYOR_AVATAR_SRC] as const;
