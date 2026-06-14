// Nostr 関連の定数。リレー・タグ・アップロード先を一元管理する。

/** 検索（NIP-50 全文検索）に使うリレー。本文ハッシュタグの集約に使う（読み取りは #3/#4）。 */
export const SEARCH_RELAYS = ["wss://search.nos.today"] as const;

/** 一般の publish / subscribe 用リレー。 */
export const GENERAL_RELAYS = ["wss://relay.damus.io", "wss://nos.lol"] as const;

/** 全リレー（検索＋一般）。publish はここ全体へ送る。 */
export const RELAYS = [...SEARCH_RELAYS, ...GENERAL_RELAYS];

/** mypace タイムライン出現の必須タグ値。 */
export const TAG_MYPACE = "mypace";

/** hanoba フィードの絞り込みタグ値。 */
export const TAG_HANOBA = "hanoba";

/** client タグの値。可視性には影響しない。 */
export const CLIENT_NAME = "hanoba";

/** nostr.build の画像アップロードエンドポイント（NIP-98 認証）。EXIF はサーバ側で自動削除。 */
export const NOSTR_BUILD_UPLOAD_URL = "https://nostr.build/api/v2/upload/files";

/** nostr.build の画像削除（NIP-96）ベース。`<base>/<sha256>` を DELETE する（#28）。 */
export const NOSTR_BUILD_DELETE_BASE = "https://nostr.build/api/v2/nip96/upload";
