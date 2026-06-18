// 多軸フィルタ（#131 次の一手 / #139 段階2）の純粋ロジック。
// relay 呼び出しはしない（取得は client.ts の fetchDiscoverFiltered の責務）。
//
// 狙い: discover（みんなの植物）を「誰の × どの品種 × いつ × 並び」の複数軸で同時に絞る。
// 既存の単一 `?q=`（tag/keyword/author を排他モードで分類・#24/#68）は軸を組み合わせられない。
// ここでは軸を持つ DiscoverFilter を定義し、URL ⇄ filter ⇄ canonical 文字列の相互変換と、
// 取得後のクライアント側 AND 絞り込み・並べ替えを純粋関数で提供する。
//
// URL/保存ビュー互換:
// - `?tags=トマト,実生&author=npub1…&q=葉焼け&since=2026-01-01&until=2026-03-31&sort=old`
// - 旧 `?q=`（#タグ / @名前 / npub / キーワード）と旧 `?tag=` は parseFilter が classify で吸収する。
// - SavedViews（#139 段階3）は query 文字列を丸ごと保存・比較する作りなので、filter を
//   serializeFilter で canonical 文字列にして渡せば、views.ts を一切変えずに多軸を保存できる。

import { classifyDiscoverQuery, normalizeTag } from "./discover.ts";
import { findPlantByTerm, plantTagValues } from "../plants/search.ts";
import type { FeedPost } from "./parse.ts";

/** 並び順。new=新着降順 / old=古い昇順 / popular=いいね数降順（同数は新着優先）。 */
export type DiscoverSort = "new" | "old" | "popular";

/**
 * 多軸フィルタの状態。各軸は独立で、空（[]/""/null/"new"）なら無制約。
 * - tags:   正規化済み（先頭 # 除去・trim）タグ群。品種もタグとして扱う。軸間 AND・軸内は別名 OR。
 * - author: npub または `@名前`。空なら著者で絞らない。pubkey 解決は client.ts。
 * - keyword: 本文の素のキーワード（# / @ / npub を含まない）。NIP-50 全文検索。
 * - since/until: 期間（unix 秒・両端含む）。null なら下限/上限なし。
 * - sort:   並び順。
 */
export interface DiscoverFilter {
  tags: string[];
  author: string;
  keyword: string;
  since: number | null;
  until: number | null;
  sort: DiscoverSort;
}

/** 既定（無制約）フィルタ。これは「みんなの植物」既定表示（#plantstr ∪ t:hanoba）に対応する。 */
export const EMPTY_FILTER: DiscoverFilter = {
  tags: [],
  author: "",
  keyword: "",
  since: null,
  until: null,
  sort: "new",
};

const SORTS: readonly DiscoverSort[] = ["new", "old", "popular"];

function isSort(v: string | null): v is DiscoverSort {
  return v !== null && (SORTS as readonly string[]).includes(v);
}

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

// 日付 ⇄ unix 秒は UTC で扱う（決定論的に round-trip するため。JST との境界ずれは v1 では許容＝
// 期間絞りは「日付」粒度の粗いフィルタとして使う）。since は当日 0 時、until は当日 23:59:59 を含む。
function dateToUnix(date: string | null, endOfDay: boolean): number | null {
  if (date === null || date.trim() === "") return null;
  const iso = `${date.trim()}T${endOfDay ? "23:59:59" : "00:00:00"}Z`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

/** <input type="date"> の値（YYYY-MM-DD）を since（当日 0 時・unix 秒）にする。空/不正は null。 */
export function sinceFromDateInput(date: string): number | null {
  return dateToUnix(date, false);
}

/** <input type="date"> の値（YYYY-MM-DD）を until（当日 23:59:59 を含む・unix 秒）にする。空/不正は null。 */
export function untilFromDateInput(date: string): number | null {
  return dateToUnix(date, true);
}

/** unix 秒（UTC）を `YYYY-MM-DD` にする（serialize / <input type=date> 用）。null は ""。 */
export function unixToDate(unix: number | null): string {
  if (unix === null) return "";
  const iso = new Date(unix * 1000).toISOString();
  return iso.slice(0, 10);
}

/**
 * URLSearchParams を DiscoverFilter に解く（マウント・popstate・保存ビュー共用）。
 *
 * - 構造化パラメータ（tags/author/since/until/sort）を素直に読む。
 * - 旧 `?tag=` は tags に合流（後方互換）。
 * - `?q=` は classify で吸収して該当軸へ振り分ける（#タグ→tags / npub→author / @名前→author /
 *   それ以外→keyword）。新 UI は keyword だけを `q` に書くので round-trip は安定する。
 */
export function parseFilter(params: URLSearchParams): DiscoverFilter {
  const tags = parseTagList(params.get("tags"));
  for (const t of parseTagList(params.get("tag"))) {
    if (!hasTag(tags, t)) tags.push(t); // 旧 ?tag= を合流
  }
  let author = (params.get("author") ?? "").trim();
  let keyword = "";

  const q = (params.get("q") ?? "").trim();
  if (q !== "") {
    const { mode, term } = classifyDiscoverQuery(q);
    if (mode === "tag") {
      if (term !== "" && !hasTag(tags, term)) tags.push(term);
    } else if (mode === "author") {
      if (author === "") author = term; // npub
    } else if (mode === "author-name") {
      if (author === "") author = `@${term}`;
    } else {
      keyword = term;
    }
  }

  const sortRaw = params.get("sort");
  return {
    tags,
    author,
    keyword,
    since: dateToUnix(params.get("since"), false),
    until: dateToUnix(params.get("until"), true),
    sort: isSort(sortRaw) ? sortRaw : "new",
  };
}

/**
 * 文字列（保存ビューの query・URL の search 部）を DiscoverFilter に解く。
 * - 既知キー（tags/author/q/since/until/sort/tag）を含めば構造化クエリとして parse。
 * - 含まなければ「旧・単一クエリ」（保存ビューの多軸化前の値＝`#トマト`/`葉焼け`/`npub1…`/`@kako`）
 *   とみなして classify する。
 */
export function parseFilterFromString(s: string): DiscoverFilter {
  const str = s.trim();
  if (str === "") return { ...EMPTY_FILTER };
  const params = new URLSearchParams(str.startsWith("?") ? str.slice(1) : str);
  const KNOWN = ["tags", "author", "q", "since", "until", "sort", "tag"];
  if (KNOWN.some((k) => params.has(k))) return parseFilter(params);
  return parseFilter(new URLSearchParams([["q", str]]));
}

/**
 * DiscoverFilter を canonical な query 文字列（先頭 ? 無し）にする。
 * 既定（空）は ""（＝既定表示）。キー順は固定（tags→author→q→since→until→sort）＝決定論。
 * SavedViews の保存・active 判定、および URL 反映の値として使う。
 */
export function serializeFilter(f: DiscoverFilter): string {
  const params = new URLSearchParams();
  if (f.tags.length > 0) params.set("tags", f.tags.join(","));
  if (f.author !== "") params.set("author", f.author);
  if (f.keyword !== "") params.set("q", f.keyword);
  if (f.since !== null) params.set("since", unixToDate(f.since));
  if (f.until !== null) params.set("until", unixToDate(f.until));
  if (f.sort !== "new") params.set("sort", f.sort);
  return params.toString();
}

/**
 * 既存の URLSearchParams に filter を反映する（DiscoverGrid の URL 書き込み用）。
 * 空の軸は削除する。旧 `?tag=` も削除する（重複を残さない）。filter 以外のパラメータは触らない。
 */
export function applyFilterToParams(params: URLSearchParams, f: DiscoverFilter): void {
  const setOrDel = (key: string, value: string) => {
    if (value === "") params.delete(key);
    else params.set(key, value);
  };
  params.delete("tag");
  setOrDel("tags", f.tags.length > 0 ? f.tags.join(",") : "");
  setOrDel("author", f.author);
  setOrDel("q", f.keyword);
  setOrDel("since", f.since !== null ? unixToDate(f.since) : "");
  setOrDel("until", f.until !== null ? unixToDate(f.until) : "");
  setOrDel("sort", f.sort !== "new" ? f.sort : "");
}

/** 既定（無制約）フィルタか＝「すべて」がアクティブで既定表示に戻る状態か。 */
export function isDefaultFilter(f: DiscoverFilter): boolean {
  return serializeFilter(f) === "";
}

/**
 * 取得を要する「絞り込み軸」を持つか（tags/author/keyword のいずれか）。
 * これが false なら取得側は既定母集団（#plantstr ∪ t:hanoba）を引く（since/until/sort は別途適用）。
 */
export function hasQueryConstraint(f: DiscoverFilter): boolean {
  return f.tags.length > 0 || f.author !== "" || f.keyword !== "";
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
// 多軸取得（relay #t OR）と applyClientFilter（投稿ごとの AND 照合）で同じタグを何度も引く分を畳む。
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

/** applyClientFilter の入力。author は client 側で解決済みの pubkey 群（null=著者無制約）。 */
export interface ClientFilterInput {
  tags: string[];
  keyword: string;
  authorPubkeys: string[] | null;
  since: number | null;
  until: number | null;
  /** タグ→別名集合（小文字）。既定は恒等（tag 自身のみ）。本番は tagAliasValues を渡す。 */
  resolveTagAliases?: (tag: string) => string[];
}

/**
 * 取得済み投稿にクライアント側の確定フィルタを当てる純粋関数。
 * リレーは #t を OR で・NIP-50 をゆるく返すため、ここで AND・部分一致・期間・画像のみを確定する。
 *
 * - 画像なし（imageUrl===null）は除外（写真 SNS）。
 * - authorPubkeys 指定時はその pubkey のみ（検索リレーが authors を無視しても防御）。
 * - since/until は createdAt の両端含む範囲（relay 適用済みでも防御的に再確認）。
 * - tags は軸間 AND・軸内は別名集合の OR（投稿の hashtags にいずれか一致）。
 * - keyword は caption ＋ hashtags の小文字連結に部分一致（タグ取得分との AND を保証）。
 */
export function applyClientFilter(posts: FeedPost[], f: ClientFilterInput): FeedPost[] {
  const resolve = f.resolveTagAliases ?? ((t: string) => [t.toLowerCase()]);
  const tagSets = f.tags.map((t) => new Set(resolve(t)));
  const kw = f.keyword.trim().toLowerCase();
  const authors = f.authorPubkeys !== null ? new Set(f.authorPubkeys) : null;

  return posts.filter((p) => {
    if (p.imageUrl === null) return false;
    if (authors !== null && !authors.has(p.pubkey)) return false;
    if (f.since !== null && p.createdAt < f.since) return false;
    if (f.until !== null && p.createdAt > f.until) return false;
    if (tagSets.length > 0) {
      const hs = p.hashtags.map((h) => h.toLowerCase());
      for (const set of tagSets) {
        if (!hs.some((h) => set.has(h))) return false; // 軸間 AND
      }
    }
    if (kw !== "") {
      const hay = `${p.caption.toLowerCase()} ${p.hashtags.join(" ").toLowerCase()}`;
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/**
 * 並べ替える純粋関数（新しい配列を返す）。
 * - new: createdAt 降順 / old: 昇順 / popular: counts 降順（同数は新着優先）。
 * counts は popular のときだけ要る（id→いいね数。無い id は 0 扱い）。
 */
export function sortPosts(
  posts: FeedPost[],
  sort: DiscoverSort,
  counts?: Map<string, number>,
): FeedPost[] {
  const arr = [...posts];
  if (sort === "old") return arr.sort((a, b) => a.createdAt - b.createdAt);
  if (sort === "popular") {
    const c = counts ?? new Map<string, number>();
    return arr.sort((a, b) => {
      const diff = (c.get(b.id) ?? 0) - (c.get(a.id) ?? 0);
      return diff !== 0 ? diff : b.createdAt - a.createdAt;
    });
  }
  return arr.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * フィルタを人間可読の短い要約にする（loading/empty 文言・チップ説明用）。
 * 例: "トマト・実生 / @kako / 葉焼け"。既定（空）は "みんなの植物"。
 */
export function filterSummary(f: DiscoverFilter): string {
  const parts: string[] = [];
  if (f.tags.length > 0) parts.push(f.tags.join("・"));
  if (f.author !== "") parts.push(f.author);
  if (f.keyword !== "") parts.push(f.keyword);
  return parts.length > 0 ? parts.join(" / ") : "みんなの植物";
}
