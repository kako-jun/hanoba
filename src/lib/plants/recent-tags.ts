// 最近使ったタグ（#144 ドリルダウンUIの「最近使った」段）。
//
// 投稿で選んだタグを localStorage に貯め、次回 0〜1 タップで再投入できるようにする。
// taxonomy（不変の Def）ではなく**実行時状態**なので、カタログとは別管理（DESIGN の Def/状態分離）。
// SSR 安全: 保存は集約 blob（appStorage）経由＝localStorage は appStorage 内でのみ参照する。

import { getAppStorage, updateAppStorage } from "../storage/appStorage.ts";

const MAX = 12;

/** タグの正規化（前後空白・先頭 # を除去）。空白内部はそのまま（表示・再挿入用の原文）。 */
function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").trim();
}

/** 保存済みの最近タグ（新しい順・最大 MAX）。壊れた値は空配列に倒す。 */
export function getRecentTags(): string[] {
  const parsed: unknown = getAppStorage().recentTags;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX);
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
  updateAppStorage((s) => ({ ...s, recentTags: next }));
  return next;
}

/**
 * 投稿に実際に含まれたタグ群を最近使ったへまとめて記録する（**投稿成功後**に呼ぶ）。
 * タップしただけ・あとで消したタグは入らない＝「最近使った」＝直近の投稿で使ったタグ。
 * tags の並び順を保つ（先頭が最も新しく見えるよう逆順に積む）。更新後の配列を返す。
 */
export function recordRecentTags(tags: string[]): string[] {
  let out = getRecentTags();
  for (const tag of [...tags].reverse()) out = pushRecentTag(tag);
  return out;
}
