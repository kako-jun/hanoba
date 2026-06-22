// タグ関連の純粋関数。
//
// 確定済みの契約（DESIGN §6）:
//   自動付与タグは [["t","mypace"],["t","hanoba"],["t","plantstr"],["client","hanoba"]]（この順序）。
//   t:plantstr は mypace 完全一致からの意図的逸脱（#383）＝Nostr 全体の #plantstr 界隈へ
//   自分の投稿も露出させ discover の read/write 非対称を解消する reciprocity。
//   コミュニティ・ハッシュタグの自動付与であって、本文の # を t タグ化するルールではない。
//   本文の #ハッシュタグは依然 t タグ化しない（別軸のルール・独自化禁止）。
//   集約（読み取り）の二段構え検索は #3/#4 の責務でここには無い（書き込み側だけ）。

import { CLIENT_NAME, TAG_HANOBA, TAG_MYPACE, TAG_PLANTSTR } from "./constants.ts";

/**
 * 全投稿に自動付与するタグを返す。
 * 厳密にこの順序: [["t","mypace"],["t","hanoba"],["t","plantstr"],["client","hanoba"]]。
 * t:plantstr は Nostr 全体の植物界隈への露出（reciprocity・#383）で、本文 # の t 化とは別軸。
 * 本文の # は一切含めない。
 */
export function buildAutoTags(): string[][] {
  return [
    ["t", TAG_MYPACE],
    ["t", TAG_HANOBA],
    ["t", TAG_PLANTSTR],
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
    // 除去で生じた連続スペース（全角 U+3000 含む）を 1 つに、行頭行末の空白も除く。
    .replace(/[ \t　]{2,}/g, " ")
    .replace(/[ \t　]*\n[ \t　]*/g, "\n")
    // 空行（段落区切り）は残す。過剰な連続改行（3つ以上）だけ空行1つに抑える。
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
