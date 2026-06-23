// X（旧 Twitter）シェアの純粋ロジック（#37）。mypace の sns-share から X 部分だけを移植した
// 最小版。Bluesky/Threads/Markdown/位置情報/マガジン/スーパーメンションは持ち込まない。
//
// 役割:
//   - weightedLengthX: twitter-text 準拠の加重長（ASCII=1 / CJK・絵文字=2 / URL=固定23）。
//   - buildXShareParts: caption（インライン #タグ込み）を 280 加重長に収まるよう分割し、
//     `(N/総数)` 採番・先頭にハッシュタグ・最終にパーマリンクを配分した投稿用文字列の配列を返す。
//   - buildNjumpPermalink: 単一投稿ルートが無い hanoba 用の普遍 Nostr パーマリンク（njump）。
//   - openXShare: X intent を新規タブで開く（副作用・テスト対象外）。
//
// relay には触れない（純粋）。permalink 生成は nip19（純粋）のみ使う。

import { encodePostNevent } from "./deep-link.ts";
import type { FeedPost } from "../feed/parse.ts";

/** X の文字数制限（weighted length）。日本語など重み2だけなら最大140字相当。 */
const X_CHAR_LIMIT = 280;

/**
 * X の URL 文字数（t.co 短縮後）。https:// の URL は実長に関わらず一律 23 weighted。
 * これは X 公式仕様（t.co が全 URL を一律短縮する）。実 URL 長を数えるのは誤り。
 */
const X_URL_LENGTH = 23;

/** テキスト内の URL を検出する正規表現。 */
const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * X（twitter-text）準拠の weighted length を計算する。
 * 重み1のコードポイント範囲: 0–4351, 8192–8205, 8208–8223, 8242–8247（ASCII/ラテン/一部記号）。
 * それ以外（CJK・絵文字・多くの非Latin）は重み2。URL は実長に関わらず 23 として加算。
 *
 * 注: 絵文字は「コードポイント単位」で数える（`for...of` の反復が1コードポイント単位のため、
 * ZWJ ファミリ 👨‍👩‍👧‍👦 や旗 🇯🇵 のような複数コードポイント絵文字は twitter-text の
 * 書記素あたり重み2より過大に数える）。これは安全側の誤差＝パートが実際より短く出るので
 * 本物の X で溢れることはない。mypace から意図的にこの近似を移植している。
 */
export function weightedLengthX(text: string): number {
  // URL 部分を除いたテキストの weighted length に、23×URL個数 を加える。
  const urls = text.match(URL_REGEX) ?? [];
  let work = text;
  for (const url of urls) {
    work = work.replace(url, "");
  }

  let weight = 0;
  for (const ch of work) {
    const cp = ch.codePointAt(0) ?? 0;
    const isLight =
      (cp >= 0 && cp <= 4351) ||
      (cp >= 8192 && cp <= 8205) ||
      (cp >= 8208 && cp <= 8223) ||
      (cp >= 8242 && cp <= 8247);
    weight += isLight ? 1 : 2;
  }

  return weight + urls.length * X_URL_LENGTH;
}

/** テキストが X の加重長制限に収まるか。 */
function fitsX(text: string): boolean {
  return weightedLengthX(text) <= X_CHAR_LIMIT;
}

/** 1パート分の組み立てオプション（採番・ハッシュタグ・パーマリンクの配分判定用）。 */
interface PartOpts {
  isFirst: boolean;
  isLast: boolean;
  /** このパートの番号（1始まり）。省略時は total を使う＝予算見積りの worst-case（桁数最大）。 */
  current?: number;
  total: number;
  hashtags: string[];
  permalink: string;
}

/**
 * content スライスを最終的な投稿テキストへ組み立てる。
 * - total>1 なら先頭に `(current/total)\n`。current 省略時は worst-case として total を使う
 *   （予算見積りでは current<=total なので桁数最大の total で過小評価を防ぐ）。
 * - 先頭パートにのみハッシュタグを `\n\n#a #b` で付ける。
 * - 最終パートにのみパーマリンクを `\n\n<url>` で付ける。
 */
function assemblePart(content: string, opts: PartOpts): string {
  let text = content;

  if (opts.total > 1) {
    const current = opts.current ?? opts.total;
    text = `(${current}/${opts.total})\n${text}`;
  }

  if (opts.isFirst && opts.hashtags.length > 0) {
    const tags = opts.hashtags.map((t) => `#${t}`).join(" ");
    // 本文が空ならハッシュタグも区切り無しで出す（先頭の空行2つを残さない）。
    text = text === "" ? tags : `${text}\n\n${tags}`;
  }

  if (opts.isLast && opts.permalink !== "") {
    // 直前の本文が空（caption 無しの写真など）なら区切りの \n\n を付けず、
    // パーマリンクだけを出す（先頭に空行2つが残るのを防ぐ）。
    text = text === "" ? opts.permalink : `${text}\n\n${opts.permalink}`;
  }

  return text;
}

/**
 * content スライスが、組み立て後に X 制限へ収まるか判定する（採番/タグ/URL のオーバーヘッド込み）。
 * current は渡さない＝worst-case（total と同桁）で見積もるので、3桁採番でも過小評価しない。
 */
function partFits(content: string, opts: { isFirst: boolean; isLast: boolean; total: number; hashtags: string[]; permalink: string }): boolean {
  return fitsX(assemblePart(content, opts));
}

/**
 * コードポイント単位の cut 位置を、書記素（grapheme）境界の手前へ丸める。
 * 強制分割で書記素クラスタ（ZWJ 絵文字・結合文字・サロゲートペア）が割れるのを防ぐ。
 * cutCp 近傍の窓（±WINDOW）だけを segment して相対境界を求める（長文での O(parts×len) を避ける）。
 * 最低でも1コードポイントは前進させる（無限ループ防止）。
 */
function snapToGraphemeBoundary(chars: string[], cutCp: number): number {
  if (cutCp >= chars.length) return cutCp;
  if (cutCp <= 0) return Math.min(1, chars.length);
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return Math.max(1, cutCp);
  }
  const WINDOW = 64;
  const windowStart = Math.max(0, cutCp - WINDOW);
  const windowEnd = Math.min(chars.length, cutCp + WINDOW);
  const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });

  const relCut = cutCp - windowStart;
  let rel = 0;
  const boundaries: number[] = [];
  for (const { segment } of seg.segment(chars.slice(windowStart, windowEnd).join(""))) {
    boundaries.push(rel);
    rel += Array.from(segment).length;
  }
  boundaries.push(rel); // 窓末尾も境界。

  let snappedRel = 0;
  for (const b of boundaries) {
    if (b <= relCut) snappedRel = b;
    else break;
  }
  const snapped = windowStart + snappedRel;
  return Math.max(1, snapped);
}

/**
 * 1パート分の content スライスを、組み立て後の実パートが制限に収まる最大長で切り出す。
 * 二分探索で「収まる最大のコードポイント数」を求め、その範囲で意味的な区切り位置を探す。
 * 区切り優先度: 空行 `\n\n` → 単一改行 `\n` → 句読点（。！？.!?）→ 強制分割（書記素境界スナップ）。
 */
function cutOnePart(remaining: string, opts: { isFirst: boolean; total: number; hashtags: string[]; permalink: string }): number {
  const chars = Array.from(remaining);

  // 実パートが収まる最大のコードポイント数を二分探索。どのパートも最後になり得る（URL が付く）
  // ものとして isLast:true で予算を確保し、最後にパーマリンクを積んでも収まることを保証する。
  let left = 0;
  let right = chars.length;
  while (left < right) {
    const mid = Math.ceil((left + right) / 2);
    const slice = chars.slice(0, mid).join("");
    if (partFits(slice, { isFirst: opts.isFirst, isLast: true, total: opts.total, hashtags: opts.hashtags, permalink: opts.permalink })) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  // 何も入らない場合でも前進させるため最低1コードポイントは進める。
  const maxChars = Math.max(1, left);
  // 残り全体が1パートに収まるなら区切り探索で無駄に分割しない。
  if (maxChars >= chars.length) {
    return chars.length;
  }
  const searchEnd = maxChars;
  const searchRange = chars.slice(0, searchEnd).join("");
  // 区切り位置が searchEnd の前30%より手前なら短すぎるパートを避け、次の候補へフォールバック。
  const minLength = Math.floor(searchEnd * 0.3);

  // 区切り候補はコードポイント数で評価して chars index に揃える。
  const toCharIndex = (strLen: number): number => Array.from(searchRange.slice(0, strLen)).length;

  // 1. 空行で区切る。
  const doubleNewline = searchRange.lastIndexOf("\n\n");
  if (doubleNewline >= 0 && toCharIndex(doubleNewline) > minLength) {
    return toCharIndex(doubleNewline + 2);
  }

  // 2. 単一改行で区切る。
  const singleNewline = searchRange.lastIndexOf("\n");
  if (singleNewline >= 0 && toCharIndex(singleNewline) > minLength) {
    return toCharIndex(singleNewline + 1);
  }

  // 3. 句読点で区切る（。！？.!?）。
  const punctuationMatch = searchRange.match(/.*[。！？.!?]/s);
  if (punctuationMatch && toCharIndex(punctuationMatch[0].length) > minLength) {
    return toCharIndex(punctuationMatch[0].length);
  }

  // 4. 強制分割（最終手段）。書記素境界へスナップして ZWJ 絵文字・結合文字の分断を防ぐ。
  return snapToGraphemeBoundary(chars, searchEnd);
}

/** 指定 total を前提に content を分割し、各パートの content スライス文字列を返す。 */
function splitWithTotal(content: string, assumedTotal: number, hashtags: string[], permalink: string): string[] {
  const parts: string[] = [];
  let remaining = content;
  let isFirst = true;

  while (remaining.length > 0) {
    const cutChars = cutOnePart(remaining, { isFirst, total: assumedTotal, hashtags, permalink });
    const chars = Array.from(remaining);
    const head = chars.slice(0, cutChars).join("").trim();
    parts.push(head);
    remaining = chars.slice(cutChars).join("").trim();
    isFirst = false;
  }

  return parts.filter((p) => p.length > 0);
}

/** 各パート content スライスを最終投稿テキストへ組み立てる（採番・タグ・パーマリンク配分）。 */
function formatParts(parts: string[], hashtags: string[], permalink: string): string[] {
  const total = parts.length;
  return parts.map((part, index) =>
    assemblePart(part, {
      isFirst: index === 0,
      isLast: index === total - 1,
      current: index + 1,
      total,
      hashtags,
      permalink,
    }),
  );
}

/** 全パートが組み立て後に X 制限へ収まっているか検証する。 */
function allPartsFit(parts: string[], hashtags: string[], permalink: string): boolean {
  return formatParts(parts, hashtags, permalink).every(fitsX);
}

/**
 * caption（インライン #タグ込み）を X 制限に収まる投稿テキスト配列へ分割・整形する。
 *
 * @param caption    投稿の一言（画像 URL は除去済み・#タグはインラインで残す）。
 * @param hashtags   先頭パートに追記する追加ハッシュタグ（hanoba ではインライン済みのため通常 []）。
 * @param permalink  最終パートに付けるパーマリンク（njump URL）。空なら付けない。
 * @returns 投稿用文字列の配列。total>1 のときのみ `(N/総数)` 採番が付く。1パートなら採番なし。
 *
 * 分割優先度: 空行 → 改行 → 句読点 → 強制分割（書記素境界スナップ）。
 * total はパート番号の桁数に影響するため、実個数が仮定を超えたら total を上げて再分割する
 * （桁あふれ安全）。最大 64 反復のガードを置く。
 */
export function buildXShareParts(caption: string, hashtags: string[], permalink: string): string[] {
  const content = caption.trim();
  // 空 caption でもパーマリンク（最終パート扱い）だけは出す。
  if (content === "") {
    return [assemblePart("", { isFirst: true, isLast: true, total: 1, hashtags, permalink })];
  }

  // 分割不要なら1パートにまとめる（採番なし）。
  const single = assemblePart(content, { isFirst: true, isLast: true, total: 1, hashtags, permalink });
  if (fitsX(single)) {
    return [single];
  }

  // total はパート番号の桁数に影響するため、収束まで仮定 total を上げて再分割する。
  let assumedTotal = 2;
  let parts = splitWithTotal(content, assumedTotal, hashtags, permalink);

  for (let guard = 0; guard < 64; guard++) {
    const actualTotal = parts.length;
    const effectiveTotal = Math.max(assumedTotal, actualTotal);

    if (effectiveTotal !== assumedTotal) {
      assumedTotal = effectiveTotal;
      parts = splitWithTotal(content, assumedTotal, hashtags, permalink);
      continue;
    }

    if (allPartsFit(parts, hashtags, permalink)) {
      return formatParts(parts, hashtags, permalink);
    }

    assumedTotal += 1;
    parts = splitWithTotal(content, assumedTotal, hashtags, permalink);
  }

  // 上限到達時も現時点の分割を整形して返す（pathological 入力の保険）。
  return formatParts(parts, hashtags, permalink);
}

/**
 * 「全文」（無分割）の投稿テキストを返す。X が長すぎて切り詰めても、本人が編集して
 * 投げ直せる原文として使う。採番なし・先頭にタグ・末尾にパーマリンク。
 */
export function buildXShareWhole(caption: string, hashtags: string[], permalink: string): string {
  return assemblePart(caption.trim(), { isFirst: true, isLast: true, total: 1, hashtags, permalink });
}

/** X intent URL を生成する。 */
export function getXIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/**
 * 投稿（FeedPost）への普遍 Nostr パーマリンク（njump）を生成する。hanoba は単一投稿ルートを
 * 持たない（モーダル島）ので、nip19 nevent（リレーヒント込み）で `https://njump.me/<nevent>` を作る。
 * njump が画像を OGP に出すので X 上でも写真プレビューが出る＝写真 SNS として正しいリンクバック。
 *
 * nevent 生成のロジックは `encodePostNevent`（deep-link.ts）に集約した正本を使う（重複排除・#386）。
 * 64桁小文字 hex でない id・encode 不能（壊れた id）は null になるので、その場合はリンク無し（""）を返す。
 */
export function buildNjumpPermalink(post: Pick<FeedPost, "id" | "pubkey">): string {
  const nevent = encodePostNevent(post);
  return nevent ? `https://njump.me/${nevent}` : "";
}

/** X intent を新規タブで開く（副作用）。noopener,noreferrer で開く。 */
export function openXShare(text: string): void {
  window.open(getXIntentUrl(text), "_blank", "noopener,noreferrer");
}
