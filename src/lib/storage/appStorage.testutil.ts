// テスト専用: 集約 blob（appStorage・#558）へ部分状態を種撒き/読み出しするヘルパ。
//
// 集約後は各状態が単一キー `hanoba` の JSON に同居するため、テストが個別フィールドを
// 直接 localStorage.setItem すると他フィールド（例: 全体 setup が入れる lang:ja）を消してしまう。
// このヘルパは必ず**現状にマージ**して書くので、複数フィールドの種撒きが互いを潰さない。

import { APP_STORAGE_KEY, type AppStorageState } from "./appStorage.ts";

/** 現状の集約 blob を読む（無い・壊れは {}）。 */
export function readAppStorage(): AppStorageState {
  try {
    const parsed = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** 集約 blob へ部分状態をマージして書く（他フィールドを保つ）。 */
export function seedAppStorage(partial: Partial<AppStorageState>): void {
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({ ...readAppStorage(), ...partial }));
}

/**
 * 壊れ値の検証用に、blob のあるフィールドへ任意の（型を無視した）値を差し込む。
 * 旧テストが個別キーに不正 JSON 文字列を入れて「握り潰し」を確認していたケースを、
 * blob フィールドの不正値差し込みに置き換えるために使う。
 */
export function seedAppStorageRaw(field: string, value: unknown): void {
  const cur = readAppStorage() as Record<string, unknown>;
  cur[field] = value;
  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(cur));
}
