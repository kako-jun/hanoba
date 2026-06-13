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
