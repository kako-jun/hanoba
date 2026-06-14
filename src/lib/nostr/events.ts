// イベントテンプレート構築の純粋関数。署名・送信はしない（keys / client の責務）。

import { buildAutoTags } from "./tags.ts";
import type { EventTemplate } from "./types.ts";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * 投稿（kind:1 テキストノート）のテンプレートを構築する。
 *
 * - caption.trim() が空なら throw（一言必須＝hanoba の心臓部・DESIGN §1）。
 * - tags は buildAutoTags() のみ（本文 # は t タグ化しない）。
 * - content は「一言」＋画像 URL をインラインのプレーン URL で連結:
 *     caption.trim() の後に各 imageUrl を改行で連結。
 *     例: "開花した #アガベ\nhttps://image.nostr.build/xxx.jpg"
 *   imeta タグは使わない。imageUrls 省略/空なら caption のみ。
 */
export function buildNoteTemplate(input: {
  caption: string;
  imageUrls?: string[];
  createdAt?: number;
}): EventTemplate {
  const caption = input.caption.trim();
  if (caption === "") {
    throw new Error("一言は必須です（写真だけの投稿はできません）");
  }

  const imageUrls = input.imageUrls ?? [];
  const content = imageUrls.length > 0 ? [caption, ...imageUrls].join("\n") : caption;

  return {
    kind: 1,
    created_at: input.createdAt ?? nowSec(),
    tags: buildAutoTags(),
    content,
  };
}

/**
 * NIP-98（HTTP Auth）の認証イベントテンプレートを構築する。
 * 画像アップロード（nostr.build）の Authorization ヘッダ用。
 *
 * - kind:27235
 * - tags: [["u", url], ["method", method]]
 * - content: ""
 */
export function buildNip98AuthEvent(url: string, method: string, createdAt?: number): EventTemplate {
  return {
    kind: 27235,
    created_at: createdAt ?? nowSec(),
    tags: [
      ["u", url],
      ["method", method],
    ],
    content: "",
  };
}

/**
 * 削除イベント（NIP-09・kind:5）のテンプレートを構築する。
 * 対象イベント id を `e` タグで列挙する。relay/クライアント（mypace 含む）はこれを見て
 * 対象投稿を隠す。eventIds が空なら throw（消す対象が無い）。
 *
 * 注意: Nostr の削除は「依頼」であり物理消去の保証はない。写真の実体削除は別途
 * nostr.build NIP-96 で行う（投稿と写真を一蓮托生で消す・#28）。
 */
export function buildDeletionEvent(eventIds: string[], reason = "", createdAt?: number): EventTemplate {
  if (eventIds.length === 0) {
    throw new Error("削除対象のイベントがありません");
  }
  return {
    kind: 5,
    created_at: createdAt ?? nowSec(),
    tags: eventIds.map((id) => ["e", id]),
    content: reason,
  };
}

/** プロフィール（kind:0）の編集可能フィールド（#28/#35 Piece3）。 */
export interface ProfileFields {
  /** 表示名。必須（空は throw）。 */
  name: string;
  /** アバター画像 URL。 */
  picture?: string | null;
  /** 自己紹介。 */
  about?: string | null;
  /** 複数サイト URL（モーダルのサイトリンクに出る）。 */
  websites?: string[];
}

/**
 * プロフィール（NIP-01・kind:0 metadata）のテンプレートを構築する。
 * ユーザー名（表示名）を持たせて「見るだけでなく投稿できる」アカウントにする（#28）。
 * picture/about/websites も載せられる（著者ヘッダ #35）。
 *
 * **kind:0 は replaceable**＝publish すると過去の kind:0 を丸ごと置き換える。よって
 * 呼び出し側は常に「全フィールドをマージした全体」を渡すこと（部分更新で他項目を消さない）。
 *
 * - name.trim() が空なら throw。
 * - 空（trim 後）の picture/about/websites は JSON に入れない（mypace と round-trip）。
 * - websites は mypace 互換の `[{url}]` 形式で出す（parseProfile が解釈できる）。
 */
export function buildProfileEvent(fields: ProfileFields, createdAt?: number): EventTemplate {
  const name = fields.name.trim();
  if (name === "") {
    throw new Error("ユーザー名を入力してください");
  }
  const content: Record<string, unknown> = { name };

  const picture = fields.picture?.trim();
  if (picture !== undefined && picture !== "") content.picture = picture;

  const about = fields.about?.trim();
  if (about !== undefined && about !== "") content.about = about;

  const websites = (fields.websites ?? []).map((w) => w.trim()).filter((w) => w !== "");
  if (websites.length > 0) content.websites = websites.map((url) => ({ url }));

  return {
    kind: 0,
    created_at: createdAt ?? nowSec(),
    tags: [],
    content: JSON.stringify(content),
  };
}
