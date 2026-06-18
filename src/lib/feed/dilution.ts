// 投稿頻度の高い人を「薄める」設定（#138）。ミュートの手前の柔らかい手段。
//
// 人ごとに「1/2・1/5・1/10」の間引き度合いを持ち、その人の投稿を deterministic に
// 間引いて表示する。リロードしても同じ投稿が残る（ランダム・順序に依存しない）。
//
// これは taxonomy（不変の Def）でなく**実行時状態**＝表示の好み。フィードの取得・パースには
// 一切触らず、取得済みリスト → 表示の間に「間引き段」として純関数で挟む（DESIGN の Def/状態分離）。
// SSR 安全: localStorage は必ず関数内で参照する（keys.ts / recent-tags.ts の getLS パターン）。

import type { FeedPost } from "./parse.ts";

const KEY = "hanoba:dilution";

/**
 * 間引き度合い。`N` は「その人の投稿を N 分の 1 だけ残す」。
 * 無設定（map に pubkey が無い）＝間引かない＝全部残す。
 */
export type DilutionLevel = 2 | 5 | 10;

/** UI で選べる間引き段（離散・小→大）。`null`＝なし（解除）。 */
export const DILUTION_LEVELS: readonly DilutionLevel[] = [2, 5, 10];

/** pubkey(hex) → 間引き度合い。 */
export type DilutionMap = Record<string, DilutionLevel>;

/** SSR 安全に localStorage を取得する（サーバ評価時は null）。 */
function getLS(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** 任意の値が有効な DilutionLevel かを判定する（壊れ値の握り潰しに使う）。 */
function isLevel(v: unknown): v is DilutionLevel {
  return v === 2 || v === 5 || v === 10;
}

/**
 * 保存済みの全間引き設定を返す（pubkey → level）。
 * 壊れた値・未知の level は握り潰して除外する（空オブジェクトに倒す）。
 */
export function getAllDilutions(): DilutionMap {
  const raw = getLS()?.getItem(KEY);
  if (raw === null || raw === undefined || raw === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: DilutionMap = {};
    for (const [pubkey, level] of Object.entries(parsed as Record<string, unknown>)) {
      if (pubkey !== "" && isLevel(level)) out[pubkey] = level;
    }
    return out;
  } catch {
    return {};
  }
}

/** 指定 pubkey の間引き度合いを返す。無設定/壊れは null（＝間引かない）。 */
export function getDilution(pubkey: string): DilutionLevel | null {
  return getAllDilutions()[pubkey] ?? null;
}

/**
 * 指定 pubkey の間引き度合いを設定する。`null` で解除（キーを削除）。
 * 不正な level は無視する（現状を変えない）。更新後の全設定を返す。
 */
export function setDilution(pubkey: string, level: DilutionLevel | null): DilutionMap {
  if (pubkey === "") return getAllDilutions();
  const map = getAllDilutions();
  if (level === null) {
    delete map[pubkey];
  } else if (isLevel(level)) {
    map[pubkey] = level;
  } else {
    return map;
  }
  getLS()?.setItem(KEY, JSON.stringify(map));
  return map;
}

/**
 * 文字列を 32bit 符号なし整数へ畳む決定的ハッシュ（FNV-1a）。
 * 同じ入力には常に同じ値を返す純関数＝間引きの「残す/落とす」判定の安定化に使う。
 */
function hashId(id: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    // FNV prime 16777619 を Math.imul で 32bit 乗算（>>> 0 で符号なしに保つ）。
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 設定 level の人の投稿を、id ハッシュで決定的に間引く純関数（#138・テスト対象）。
 *
 * - level 無しの人（map に pubkey が無い）の投稿は**全部残す**。
 * - level がある人は `hash(post.id) % level === 0` の投稿だけ残す（＝おおよそ level 分の 1）。
 *   id 由来の決定的判定なので、リロードしても残る投稿は同じ（順序・乱数に依存しない）。
 * - 投稿の**相対順序は保つ**（filter で並びを崩さない）。
 *
 * グローバル（localStorage）は読まず、map を引数で受ける＝テスト容易な純関数にする。
 */
export function diluteFeed(posts: FeedPost[], dilutionMap: DilutionMap): FeedPost[] {
  return posts.filter((post) => {
    const level = dilutionMap[post.pubkey];
    if (level === undefined) return true; // 無設定＝薄めない
    return hashId(post.id) % level === 0;
  });
}
