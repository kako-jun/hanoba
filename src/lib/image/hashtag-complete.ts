// 一言入力中の #ハッシュタグ補完（純粋関数）。
//
// DESIGN §3: 入力中の # を過去に使われたタグから補完し、同じ植物のタグへ投稿が自然に集積する
// （emergent taxonomy）。pool（過去使用タグ）は client.fetchKnownHashtags から渡す。
//
// 文字種は extractHashtags（tags.ts）と一致させる:
//   英数・`_`・ラテン拡張・ひらがな・カタカナ・CJK。

/** キャレット直前の #語 を検出した結果。 */
export interface HashtagQuery {
  /** # の後ろの語（# は含まない） */
  query: string;
  /** # の位置（テキスト先頭からのインデックス。補完挿入の置換開始点） */
  start: number;
}

// 1 文字分のタグ文字クラス（extractHashtags の語部分と同一）。
const TAG_CHAR = "[a-zA-Z0-9_À-ſ぀-ゟ゠-ヿ一-龯]";
// キャレット直前を末尾アンカーで見る: (先頭|空白|>) # (タグ文字 0 個以上) $
const QUERY_RE = new RegExp(`(?:^|[\\s>])#(${TAG_CHAR}*)$`);

/**
 * キャレット直前の `#<語>` を検出する。
 *
 * - 先頭、または空白・引用記号(>)の直後の `#` のみを対象（語中の a#b は非該当）
 * - 語はタグ文字（英数 _・ラテン拡張・かな・カナ・CJK）の連なり。空（# 直後）も query="" で検出
 * - キャレット以降は無視（キャレット位置で入力中のトークンだけを見る）
 *
 * 該当しなければ null。
 */
export function detectHashtagQuery(text: string, caret: number): HashtagQuery | null {
  const head = text.slice(0, caret);
  const match = QUERY_RE.exec(head);
  if (match === null) return null;
  const query = match[1] ?? "";
  // match.index は (先頭|空白|>) の開始位置。# はその後の 0〜1 文字後にある。
  const hashIndex = head.indexOf("#", match.index);
  if (hashIndex < 0) return null;
  return { query, start: hashIndex };
}

/**
 * pool（過去使用タグ）から query に前方一致する候補を返す。
 *
 * - 照合は大小無視、表示は pool 内の元の綴りのまま
 * - 重複は除去（最初の綴りを採用）
 * - 最大 limit 件
 *
 * query 自体（freeform）が候補に無くても、UI 側で「そのまま #query を使う」選択肢を
 * 別途出す前提（このロジックは pool 由来の候補だけを返す）。
 */
export function filterHashtagCandidates(pool: string[], query: string, limit = 8): string[] {
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of pool) {
    if (!tag.toLowerCase().startsWith(q)) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * タグを本文挿入用に正規化（前後 trim・先頭 `#` 除去・内部空白→`_`）。空なら ""。
 * 投稿本文（insertTag）と discover の絞り込みタグ（VarietyFilter・#239）で**同じ正規化**を共有する
 * ＝複数語の品種名（例「フィカス ペティオラリス」→`フィカス_ペティオラリス`）が両経路で一致する。
 */
export function normalizeTagForBody(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, "")
    .trim()
    .replace(/\s+/g, "_");
}

/**
 * caption に（正規化後の）tag が独立した `#タグ` として既に含まれるか（大小無視・語境界）。
 * insertTag の二重挿入防止と、ピッカーの「選択済み（満たされた色）」判定で共有する（#144）。
 */
export function captionHasTag(caption: string, tag: string): boolean {
  const norm = normalizeTagForBody(tag);
  if (norm === "") return false;
  const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)#${escaped}(?:\\s|$)`, "i").test(caption);
}

/** caption の最後の改行以降（＝末尾行）に独立した `#タグ` が1つでもあるか（#165）。 */
function lastLineHasTag(caption: string): boolean {
  const lastBreak = caption.lastIndexOf("\n");
  const lastLine = lastBreak < 0 ? caption : caption.slice(lastBreak + 1);
  return /(?:^|\s)#[^\s#]/.test(lastLine);
}

/**
 * 一言（caption）にタグを1つ**末尾に**挿入する（#22/#165/#282・ピッカーから選んだとき）。
 * - tag を正規化: 前後 trim・先頭 `#` 除去・**内部の空白は `_`**（タグのスペース→アンダースコア）。
 * - 既に同じタグがあれば二重に足さない（大小無視・語境界）。
 * - 散文（本文）とタグ群は**空行（1行）で分ける**（#282＝末尾に追記された見た目にする）。挿入規則:
 *   - caption が空なら `#tag `。
 *   - **末尾行に既に `#タグ` があれば**（タグ行が継続中）スペース区切りで追記して同じ行に積む
 *     ＝タグ群は1行にまとめる（空行は増やさない）。
 *   - **末尾行が散文（タグ無し）なら**空行を1つ挟んでタグ行へ＝`本文\n\n#tag `。caption が
 *     既に `\n\n`（空行）で終わっていれば改行は足さない／`\n`（1つ）で終わっていれば `\n` を1つ
 *     足す／改行で終わっていなければ `\n\n` を足す。
 *   ＝文章を打っている最中でも常に本文の一番下にタグ行として固定追加される（キャレット位置に割り込まない）。
 * 空タグ（正規化後 ""）は caption をそのまま返す。
 */
export function insertTag(caption: string, tag: string): string {
  const norm = normalizeTagForBody(tag);
  if (norm === "") return caption;
  if (captionHasTag(caption, norm)) return caption;
  if (caption === "") return `#${norm} `;

  // 末尾行がタグ行（既に #タグ を含む）ならスペースで継続、散文なら空行で新しいタグ行へ。
  let sep: string;
  if (lastLineHasTag(caption)) {
    sep = /\s$/.test(caption) ? "" : " ";
  } else if (/\n\n$/.test(caption)) {
    sep = "";
  } else if (/\n$/.test(caption)) {
    sep = "\n";
  } else {
    sep = "\n\n";
  }
  return `${caption}${sep}#${norm} `;
}

/**
 * caption から独立した `#タグ` を1つ外す（ピッカーで選択済みチップを再タップ＝トグル解除・#144/#165）。
 * - tag を正規化して語境界で一致する箇所を除去。前後どちらかの空白も一緒に畳んで二重空白を残さない。
 * - 末尾は insertTag の規約（`#tag ` で終わる）に合わせ、タグが残るうちは末尾空白1つを保つ。
 * - タグを外した結果**末尾のタグ行が空になったら、その直前のぶら下がり改行（空行含む）も除去**して
 *   散文だけが `prose\n` や `prose\n\n` で終わらないようにする（#165/#282＝散文とタグ群は空行で
 *   分けるので、最後のタグを外すと `本文\n\n` が残る＝末尾の連続改行＋空白をまとめて畳む）。
 *   無関係な散文中の改行・連続スペースには触れない。
 * 一致が無ければ caption をそのまま返す。
 */
export function removeTag(caption: string, tag: string): string {
  const norm = normalizeTagForBody(tag);
  if (norm === "") return caption;
  const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // 直前の境界（空白 or 先頭）ごと #tag を外す。語境界は後続の空白/終端で担保。
  // 先頭の `(?:^|\s)` で隣の空白を一緒に飲むので二重空白は生じず、無関係な散文の
  // 連続スペースには触れない（global collapse はしない）。
  const removed = caption.replace(new RegExp(`(?:^|\\s)#${escaped}(?=\\s|$)`, "gi"), "");
  // タグ行が空（最後の改行以降が空白だけ）になったら、ぶら下がり改行（空行含む）ごと末尾を畳む。
  // 散文とタグ群は空行（\n\n）で分けるので、最後のタグを外すと末尾に連続改行が残る＝まとめて畳む。
  // 散文中の改行は #タグ を含まない行なので触れない（末尾行が空白のみのときだけ働く）。
  if (removed !== caption) {
    return removed.replace(/\n+[ \t]*$/, "");
  }
  return removed;
}
