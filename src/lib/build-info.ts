// 公開面に出す最小のビルド情報（#543）。
// package.json と二重管理に見えるが、Astro/TS の JSON import 設定を増やさず
// 静的表示だけに使うためここに閉じる。
export const HANOBA_VERSION = "0.1.0";

// `https://api.nostalgic.llll-ll.com/visit?action=create` で発行済み。
// URL: https://hanoba.llll-ll.com、token は private 側の運用メモにだけ残す。
export const NOSTALGIC_COUNTER_ID = "hanoba-e91c3bd4";
export const NOSTALGIC_COUNTER_ENABLED = !NOSTALGIC_COUNTER_ID.endsWith("PLACEHOLDER");
