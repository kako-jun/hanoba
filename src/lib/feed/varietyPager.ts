// 「育てた品種」一覧の横ページング用 純粋ロジック（#388・定義先行・テスト対象）。
//
// 品種が 1000 種あっても縦に積まず（巨大 DOM・長大スクロールでプロフィールが破綻し、下の節
// ＝緑の総面積／活動の草に辿り着けなくなるのを防ぐ）、手帳のように横へめくって読む。
// チャンク計算は React・DOM に依存しない純関数にして lib に置く（ジェスチャ／描画は component の
// 責務・carousel.ts と同方針）。ページめくりのスワイプ/ぼかしは carousel.ts の純関数を共有する。

/** 1 ページに載せる品種チップ数（kako-jun 指示＝10 件/ページ）。 */
export const PAGE_SIZE = 10;

/**
 * 配列を size 件ずつのページに分ける純関数（順序保持）。
 *
 * - 0 件なら空配列（ページ無し）。
 * - 最終ページは端数（< size）になりうる。
 * - size <= 0 は安全側で全件を 1 ページに畳む（無限ループ防止の自己防御）。
 *
 * @param items 分割する要素列（並びはそのまま保つ＝票数降順を崩さない）
 * @param size  1 ページの最大件数（既定 PAGE_SIZE=10）
 */
export function chunk<T>(items: readonly T[], size: number = PAGE_SIZE): T[][] {
  if (size <= 0) return items.length > 0 ? [items.slice()] : [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

/**
 * 総ページ数（純関数）。要素数を size で切り上げる。0 件は 0 ページ。
 * インジケータ（n / total）と端クランプ（canNext）の素にする。
 */
export function pageCount(total: number, size: number = PAGE_SIZE): number {
  if (size <= 0 || total <= 0) return total > 0 ? 1 : 0;
  return Math.ceil(total / size);
}

/**
 * ページ番号（0 始まり）を [0, last] にクランプする純関数。
 * スワイプ/ボタン/キーボードで端を越えようとしても先頭/末尾で止める（非 wrap）。
 * ページが 0 なら 0 を返す。
 */
export function clampPage(page: number, total: number, size: number = PAGE_SIZE): number {
  const last = pageCount(total, size) - 1;
  if (last < 0) return 0;
  if (page < 0) return 0;
  if (page > last) return last;
  return page;
}
