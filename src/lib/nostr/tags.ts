// タグ関連の純粋関数。
//
// 確定済みの契約（DESIGN §6）:
//   自動付与タグは [["t","mypace"],["t","hanoba"],["client","hanoba"]] のみ（この順序）。
//   本文の #ハッシュタグは t タグ化しない（mypace と完全一致＝独自化禁止）。
//   集約（読み取り）の二段構え検索は #3/#4 の責務でここには無い（書き込み側だけ）。

import { CLIENT_NAME, TAG_HANOBA, TAG_MYPACE } from "./constants.ts";

/**
 * 全投稿に自動付与するタグを返す。
 * 厳密にこの順序: [["t","mypace"],["t","hanoba"],["client","hanoba"]]。
 * 本文の # は一切含めない。
 */
export function buildAutoTags(): string[][] {
  return [
    ["t", TAG_MYPACE],
    ["t", TAG_HANOBA],
    ["client", CLIENT_NAME],
  ];
}

/**
 * 本文中の #ハッシュタグを抽出する（読み取り用＝#3/#4 のナビ・補完用）。
 * 抽出のみで t タグ化はしない。
 *
 * - 先頭または空白・引用記号（>）の直後の `#` に続く語を拾う
 * - 文字種: 英数・`_`・ラテン拡張・ひらがな・カタカナ・CJK
 * - 大小文字はそのまま保持
 * - 出現順を保ち、重複は除去する
 *
 * 正規表現は mypace 同等。
 */
export function extractHashtags(content: string): string[] {
  const re = /(^|[\s>])#([a-zA-Z0-9_À-ſ぀-ゟ゠-ヿ一-龯]+)/g;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of content.matchAll(re)) {
    const tag = match[2];
    if (tag === undefined) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
  }
  return result;
}

/**
 * 本文から #ハッシュタグ部分だけを取り除いた「読む本文」を返す（表示用・#34/#40）。
 * タグはフィードカードの別UI（右の縦列）に並べるため、本文テキストからは消す。
 *
 * - extractHashtags と同じ規則で `#タグ` を除去（先頭の区切り文字 `\s`/`>` は残す）。
 * - 除去で生じた行内の連続スペースは 1 つに、行頭行末スペースは除去。
 * - 連続改行は 1 つに畳み、前後を trim（parsePost の caption 整形に合わせる）。
 */
export function stripHashtags(content: string): string {
  const re = /(^|[\s>])#([a-zA-Z0-9_À-ſ぀-ゟ゠-ヿ一-龯]+)/g;
  return content
    .replace(re, (_full, lead: string) => lead)
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
