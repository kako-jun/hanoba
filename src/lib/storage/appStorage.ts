// hanoba の軽いクライアント状態をまとめる単一 localStorage 境界（#558 Layer3）。
//
// これまで表示言語・表示名・プロフィール控え・天気キャッシュ・間引き設定・最近タグ・本の
// ページ位置・PWA 却下時刻・NIP-07 フラグが `hanoba:*` の別キーに散らばっていた。責務が
// ブラウザ保存領域上で散らばると棚卸し・移行が難しい。theo-hayami の appStorage と同じ作法で、
// 正本をこの `hanoba` 1キーの JSON に集約する。**後方互換は持たない**（旧キーの migration は
// しない＝既存ユーザーの表示言語・既読等は一度だけリセットされてよい）。
//
// **秘密鍵（`hanoba:sk`）は絶対にこの blob に載せない**。書き込み頻度の高い UI 状態と
// アカウントの根幹を同じ JSON に同居させると、UI 更新のたびに鍵の再直列化・破損リスクに晒す。
// 鍵は keys.ts が `hanoba:sk` の専用キーで別管理し続ける（本モジュールは一切触らない）。
//
// SSR 安全: localStorage はトップレベルで触らず、必ず関数内で参照する（Astro の静的ビルドで
// このモジュールが評価されても落ちないように）。

import type { ProfileExtra } from "../nostr/keys.ts";
import type { HanobaWeather } from "../weather/types.ts";
import type { DilutionMap } from "../feed/dilution.ts";

/** 集約先の単一 localStorage キー。is:inline 殻入替スクリプト（MainLayout.astro）とも一致させる。 */
export const APP_STORAGE_KEY = "hanoba";

/**
 * hanoba の軽い実行時状態。各フィールドは無設定なら省略（undefined）。
 * 秘密鍵（sk）は**含めない**（keys.ts が専用キーで別管理）。
 */
export interface AppStorageState {
  /** 表示言語（ユーザーが明示的に選んだ言語・Twitter モデル）。 */
  lang?: string;
  /** 表示名（ユーザー名）。 */
  name?: string;
  /** プロフィールの name 以外の編集控え（picture / about / websites / favoriteVarieties）。 */
  profileExtra?: ProfileExtra;
  /** 天気キャッシュ（短期）。 */
  weather?: HanobaWeather;
  /** 投稿頻度の高い人の間引き設定（pubkey → level）。 */
  dilution?: DilutionMap;
  /** 最近使ったタグ（新しい順）。 */
  recentTags?: string[];
  /** 市政だより（Gazette）のページ位置（安定 ID）。 */
  gazettePage?: string;
  /** 市民手帳（CityHall）のページ位置（安定 ID）。 */
  handbookPage?: string;
  /** PWA インストール促しを却下した時刻（epoch ミリ秒）。 */
  pwaInstallDismissedAt?: number;
  /** NIP-07 拡張を使う設定フラグ（非秘密なので blob に入れてよい）。 */
  useNip07?: boolean;
  /**
   * 初投稿直後の nsec バックアップ念押しを既に出したか（#558 Layer2）。一度きりのフラグ。
   * true になったら念押しモーダルは二度と出さない（非秘密なので blob に入れてよい）。
   */
  nsecBackupPrompted?: boolean;
}

function hasStorage(): boolean {
  return typeof localStorage !== "undefined";
}

/** 集約状態を読む（無い・壊れた JSON・object 以外は空 {}）。 */
export function getAppStorage(): AppStorageState {
  if (!hasStorage()) return {};
  try {
    const raw = localStorage.getItem(APP_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as AppStorageState) : {};
  } catch {
    return {};
  }
}

/** 集約状態を書く（quota 超過等は握りつぶす＝保存が今回効かないだけで読む体験は壊さない）。 */
export function setAppStorage(state: AppStorageState): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota 超過・private mode 等は握りつぶす。
  }
}

/**
 * 現在の状態を読んで updater に渡し、返った状態を書き戻す（部分更新の共通経路）。
 * updater は現状のコピーでなく現状そのものを受けるので、必要フィールドだけ差し替えて返せば
 * 他フィールドは保たれる（スプレッドで新オブジェクトを返す実装が既定）。
 */
export function updateAppStorage(updater: (current: AppStorageState) => AppStorageState): void {
  setAppStorage(updater(getAppStorage()));
}

// ---- 本のページ位置（BookPager 共有）---------------------------------------
//
// 市政だより（gazettePage）・市民手帳（handbookPage）は同じ BookPager が扱うので、
// どちらのフィールドかを field 名で受ける薄いヘルパを置く（BookPager を汎用のまま保つ）。

/** BookPager が永続化するページ位置フィールド。 */
export type BookPageField = "gazettePage" | "handbookPage";

/** 保存済みの本のページ位置（安定 ID）を返す。未設定は null。 */
export function getBookPage(field: BookPageField): string | null {
  const v = getAppStorage()[field];
  return typeof v === "string" && v !== "" ? v : null;
}

/** 本のページ位置（安定 ID）を保存する。 */
export function setBookPage(field: BookPageField, id: string): void {
  updateAppStorage((s) => ({ ...s, [field]: id }));
}

// ---- nsec バックアップ念押し（初投稿直後・#558 Layer2）------------------------

/** 初投稿直後の nsec バックアップ念押しを既に出したか（一度きり）。 */
export function isNsecBackupPrompted(): boolean {
  return getAppStorage().nsecBackupPrompted === true;
}

/** nsec バックアップ念押しを「出した」と記録する（以後は二度と出さない）。 */
export function markNsecBackupPrompted(): void {
  updateAppStorage((s) => ({ ...s, nsecBackupPrompted: true }));
}
