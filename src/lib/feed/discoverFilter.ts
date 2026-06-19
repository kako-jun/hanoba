// discover（みんなの植物）の絞り込みロジック（#239: 品種タグで絞るだけ）の純粋関数。
// relay 呼び出しはしない（取得は client.ts の fetchDiscoverFiltered の責務）。
//
// 狙い: discover を「どの品種（タグ）で絞るか」だけにする。多軸（誰の × いつ × 並び）は撤去し、
// 母集団は常に新着順。フィルタはタグ群のみを持ち、URL ⇄ filter の相互変換と、
// 取得後のクライアント側 AND 絞り込み（タグ・画像のみ）を純粋関数で提供する。
//
// URL 互換:
// - `?tags=トマト,実生`（カンマ区切り）。
// - 旧 `?tag=` は parseFilter が tags に合流する（後方互換）。旧 `?q=` は無視（applyFilterToParams が削除）。

import { normalizeTag } from "./discover.ts";
import { normalizeTagForBody } from "../image/hashtag-complete.ts";
import { findPlantByTerm, plantTagValues } from "../plants/search.ts";
import type { FeedPost } from "./parse.ts";

/**
 * タグ名から discover の絞り込み URL（`/discover?tags=…`）を作る（#239・植物札のリンク等）。
 * 本文と同じ正規化（normalizeTagForBody＝内部空白→`_`）をかけて、複数語の品種名（例
 * 「フィカス ペティオラリス」→`フィカス_ペティオラリス`）でも投稿のタグと一致させる。
 */
export function discoverTagHref(tag: string): string {
  return `/discover?tags=${encodeURIComponent(normalizeTagForBody(tag))}`;
}

/**
 * 絞り込みの状態。tags が空なら無制約＝「みんなの植物」既定表示（#plantstr ∪ t:hanoba）。
 * tags は正規化済み（先頭 # 除去・trim）タグ群。品種もタグとして扱う。軸間 AND・軸内は別名 OR。
 */
export interface DiscoverFilter {
  tags: string[];
}

/** 既定（無制約）フィルタ。これは「みんなの植物」既定表示（#plantstr ∪ t:hanoba）に対応する。 */
export const EMPTY_FILTER: DiscoverFilter = {
  tags: [],
};

/** tags 配列に t（大小無視）が既にあるか。 */
function hasTag(tags: string[], t: string): boolean {
  const needle = t.toLowerCase();
  return tags.some((x) => x.toLowerCase() === needle);
}

/**
 * カンマ区切りのタグ列を正規化して配列にする。
 * 各要素を normalizeTag（trim・先頭 # 除去）し、空は捨て、大小無視で重複排除（最初を残す）。
 */
export function parseTagList(raw: string | null): string[] {
  if (raw === null || raw === "") return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const tag = normalizeTag(part);
    if (tag !== "" && !hasTag(out, tag)) out.push(tag);
  }
  return out;
}

/**
 * URLSearchParams を DiscoverFilter に解く（マウント・popstate 共用）。
 * - `tags`（カンマ区切り）を読む。
 * - 旧 `?tag=` は tags に合流する（後方互換）。
 */
export function parseFilter(params: URLSearchParams): DiscoverFilter {
  const tags = parseTagList(params.get("tags"));
  for (const t of parseTagList(params.get("tag"))) {
    if (!hasTag(tags, t)) tags.push(t); // 旧 ?tag= を合流
  }
  return { tags };
}

/**
 * 既存の URLSearchParams に filter を反映する（DiscoverGrid の URL 書き込み用）。
 * tags が空なら削除する。旧 `?tag=`・`?q=` も削除する（重複・レガシーを残さない）。
 * filter 以外のパラメータは触らない。
 */
export function applyFilterToParams(params: URLSearchParams, f: DiscoverFilter): void {
  params.delete("tag");
  params.delete("q");
  if (f.tags.length > 0) params.set("tags", f.tags.join(","));
  else params.delete("tags");
}

/** 既定（無制約）フィルタか＝「すべて」がアクティブで既定表示に戻る状態か。 */
export function isDefaultFilter(f: DiscoverFilter): boolean {
  return f.tags.length === 0;
}

/** tags 配列に正規化タグを足した新配列を返す（既存・空は無変化）。 */
export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (tag === "" || hasTag(tags, tag)) return tags;
  return [...tags, tag];
}

/** tags 配列から指定タグ（大小無視）を除いた新配列を返す。 */
export function removeTag(tags: string[], raw: string): string[] {
  const needle = normalizeTag(raw).toLowerCase();
  return tags.filter((t) => t.toLowerCase() !== needle);
}

// tagAliasValues の結果キャッシュ（タグ→別名集合）。findPlantByTerm は PLANTS 全件の線形走査なので、
// タグ取得（relay #t OR）と applyClientFilter（投稿ごとの AND 照合）で同じタグを何度も引く分を畳む。
// 純粋関数なのでプロセス内キャッシュで安全（辞書は不変）。
const tagAliasCache = new Map<string, string[]>();

/**
 * フィルタタグの別名集合（小文字）を返す純粋関数。植物辞書（#23）に当たれば名前/学名/別名を、
 * 当たらなければタグ自身を返す。client.ts の relay #t OR 取得と applyClientFilter の AND 照合で共用。
 * 例: "パキポ" → {"パキポ","pachypodium","グラキリス",…}。結果はタグ単位でメモ化する。
 */
export function tagAliasValues(tag: string): string[] {
  const cached = tagAliasCache.get(tag);
  if (cached !== undefined) return cached;
  const plant = findPlantByTerm(tag);
  const base = plant ? plantTagValues(plant) : [tag];
  const result = base.map((v) => v.toLowerCase());
  tagAliasCache.set(tag, result);
  return result;
}

/** applyClientFilter の入力。 */
export interface ClientFilterInput {
  tags: string[];
  /** タグ→別名集合（小文字）。既定は恒等（tag 自身のみ）。本番は tagAliasValues を渡す。 */
  resolveTagAliases?: (tag: string) => string[];
}

/**
 * 取得済み投稿にクライアント側の確定フィルタを当てる純粋関数。
 * リレーは #t を OR で・NIP-50 をゆるく返すため、ここで AND・画像のみを確定する。
 *
 * - 画像なし（imageUrl===null）は除外（写真 SNS）。
 * - tags は軸間 AND・軸内は別名集合の OR（投稿の hashtags にいずれか一致）。
 */
export function applyClientFilter(posts: FeedPost[], f: ClientFilterInput): FeedPost[] {
  const resolve = f.resolveTagAliases ?? ((t: string) => [t.toLowerCase()]);
  const tagSets = f.tags.map((t) => new Set(resolve(t)));

  return posts.filter((p) => {
    if (p.imageUrl === null) return false;
    if (tagSets.length > 0) {
      const hs = p.hashtags.map((h) => h.toLowerCase());
      for (const set of tagSets) {
        if (!hs.some((h) => set.has(h))) return false; // 軸間 AND
      }
    }
    return true;
  });
}

/**
 * フィルタを人間可読の短い要約にする（loading/empty 文言・共有テキスト用）。
 * 例: "トマト・実生"。タグが無ければ "みんなの植物"。
 */
export function filterSummary(f: DiscoverFilter): string {
  return f.tags.length > 0 ? f.tags.join("・") : "みんなの植物";
}
