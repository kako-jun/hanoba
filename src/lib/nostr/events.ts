// イベントテンプレート構築の純粋関数。署名・送信はしない（keys / client の責務）。

import { CLIENT_NAME, TAG_MYPACE } from "./constants.ts";
import { buildAutoTags } from "./tags.ts";
import type { EventTemplate } from "./types.ts";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** http(s) の絶対 URL か（プロフィールの picture/websites の安全確認・#78）。 */
function isHttpUrl(u: string): boolean {
  try {
    const proto = new URL(u).protocol;
    return proto === "http:" || proto === "https:";
  } catch {
    return false;
  }
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
  /** 写真の撮影日（#324・`YYYY-MM-DD`）。distinct を `["shot_date", 日付]` タグで載せる（本文は汚さない）。 */
  shotDates?: string[];
}): EventTemplate {
  const caption = input.caption.trim();
  if (caption === "") {
    throw new Error("一言は必須です（写真だけの投稿はできません）");
  }

  const imageUrls = input.imageUrls ?? [];
  const content = imageUrls.length > 0 ? [caption, ...imageUrls].join("\n") : caption;

  // 撮影日（#324）: `YYYY-MM-DD` の妥当なものを distinct で `["shot_date", 日付]` タグにする
  // （活動の草を撮影日基準にするため・本文は汚さない・他クライアントは未知タグとして無視）。
  const shotDateTags = [
    ...new Set((input.shotDates ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))),
  ].map((d) => ["shot_date", d]);

  return {
    kind: 1,
    created_at: input.createdAt ?? nowSec(),
    tags: [...buildAutoTags(), ...shotDateTags],
    content,
  };
}

/**
 * コメント（kind:1 リプライ）のテンプレートを構築する（#142）。
 * 投稿へのコメントを Nostr のリプライ（NIP-10）として表現する。
 *
 * - content.trim() が空なら throw（空コメントは送らない）。
 * - parentEventId が空なら throw（リプライ先が無い）。
 * - kind:1・content は trim 済みのコメント本文。
 * - tags:
 *   - `["e", parentEventId, "", "root"]` … NIP-10 の direct reply。親投稿を root に印付ける
 *     （コメントは投稿への1段リプライなので reply=root で十分。relay ヒントは空）。
 *   - `["t","mypace"]` … mypace タイムラインに乗せる（hanoba の投稿と同じ Nostr 空間に出す）。
 *   - `["client","hanoba"]` … 由来表示用（可視性には影響しない）。
 *
 * **`p` タグ（@呼びかけ）は付けない**: hanoba は静かな観賞 SNS で、コメントは投稿者を名指しで
 * 呼び出す通知ではなく「その投稿にそっと添える一言」（仕様＝@呼びかけなし・p タグなし）。
 * **`t:hanoba` も付けない**: hanoba フィード/ハッシュタグ分析は `#t:hanoba` で絞って画像投稿だけを
 * 集める（fetchHanobaFeed / fetchPopularHashtags）ため、文章だけのコメントに t:hanoba を付けると
 * フィードのノイズ・タグ集計の汚染になる。コメントは親投稿の `e` タグ経由（`{"#e":[postId]}`）で
 * 読むので t:hanoba は不要。
 */
export function buildReplyTemplate(content: string, parentEventId: string, createdAt?: number): EventTemplate {
  const trimmed = content.trim();
  if (trimmed === "") {
    throw new Error("コメントを入力してください");
  }
  if (parentEventId === "") {
    throw new Error("コメント先の投稿がありません");
  }
  return {
    kind: 1,
    created_at: createdAt ?? nowSec(),
    tags: [
      ["e", parentEventId, "", "root"],
      ["t", TAG_MYPACE],
      ["client", CLIENT_NAME],
    ],
    content: trimmed,
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
  /** 好きな品種（#141・kind:0 カスタム `favorite_varieties`・同好の士の手がかり）。 */
  favoriteVarieties?: string[];
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

  // picture/websites は他所で href/src に出るので http(s) の絶対 URL だけ載せる（#78 レビュー S1）。
  const picture = fields.picture?.trim();
  if (picture !== undefined && picture !== "" && isHttpUrl(picture)) content.picture = picture;

  const about = fields.about?.trim();
  if (about !== undefined && about !== "") content.about = about;

  const websites = (fields.websites ?? []).map((w) => w.trim()).filter((w) => isHttpUrl(w));
  if (websites.length > 0) content.websites = websites.map((url) => ({ url }));

  // 好きな品種（#141）。カタログ品種名の素の文字列配列を hanoba 独自キーで載せる
  // （他クライアントは未知キーとして無視）。空は載せない（mypace round-trip と同方針）。
  const favoriteVarieties = (fields.favoriteVarieties ?? []).map((v) => v.trim()).filter((v) => v !== "");
  if (favoriteVarieties.length > 0) content.favorite_varieties = [...new Set(favoriteVarieties)];

  return {
    kind: 0,
    created_at: createdAt ?? nowSec(),
    tags: [],
    content: JSON.stringify(content),
  };
}
