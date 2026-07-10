// 公開面に出す最小のビルド情報（#543）。
// 版数は他アプリと同じく SemVer ではなく JST のビルド年月日を表示する。
export const HANOBA_BUILD_DATE = __BUILD_DATE__;

// `https://api.nostalgic.llll-ll.com/visit?action=create` で発行済み。
// URL: https://hanoba.llll-ll.com、token は kako-jun 統一値（リポジトリには置かない）。
export const NOSTALGIC_COUNTER_ID = "hanoba-e91c3bd4";
export const NOSTALGIC_COUNTER_ENABLED = !NOSTALGIC_COUNTER_ID.endsWith("PLACEHOLDER");
