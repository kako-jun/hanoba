// 最近使ったタグ（#144 ドリルダウンUIの「最近使った」段）。
//
// 投稿で選んだタグを localStorage に貯め、次回 0〜1 タップで再投入できるようにする。
// taxonomy（不変の Def）ではなく**実行時状態**なので、カタログとは別管理（DESIGN の Def/状態分離）。
// SSR 安全: localStorage は必ず関数内で参照する（keys.ts と同じ getLS パターン）。

const KEY = "hanoba:recent-tags";
const MAX = 12;

/** SSR 安全に localStorage を取得する（サーバ評価時は null）。 */
function getLS(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** タグの正規化（前後空白・先頭 # を除去）。空白内部はそのまま（表示・再挿入用の原文）。 */
function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").trim();
}

/** 保存済みの最近タグ（新しい順・最大 MAX）。壊れた値は空配列に倒す。 */
export function getRecentTags(): string[] {
  const raw = getLS()?.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

/**
 * タグを最近使ったの先頭へ積む（大小無視で重複排除・最大 MAX 件）。更新後の配列を返す。
 * 空タグ（正規化後 ""）は無視して現状を返す。
 */
export function pushRecentTag(tag: string): string[] {
  const norm = normalizeTag(tag);
  if (norm === "") return getRecentTags();
  const rest = getRecentTags().filter((t) => t.toLowerCase() !== norm.toLowerCase());
  const next = [norm, ...rest].slice(0, MAX);
  getLS()?.setItem(KEY, JSON.stringify(next));
  return next;
}
