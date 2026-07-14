// PWA 更新検知（#551・mypace 方式）の純粋なガード判定だけを持つモジュール。
//
// DOM 操作・SW 登録（registerSW/overlay/reload）は registerUpdate.ts 側の責務（単一責務・
// install.ts が却下記憶の純関数とバナー描画を分けているのと同じ分離）。ここは
// 「reload していいか」を判定する2つの純関数だけを持つ。

/** reload ループ防止のクールダウン（ミリ秒）。mypace 同様 10 秒。 */
export const UPDATE_COOLDOWN_MS = 10_000;

/** 直近の SW 更新時刻（sessionStorage）を持つキー。registerUpdate.ts と共有する。 */
export const SW_UPDATE_STORAGE_KEY = "hanoba:sw-update-time";

/**
 * 直近のクールダウン期間内に既に更新を適用済みか（純関数・テスト可能に now を引数で受ける）。
 * `lastUpdatedAt` が null（未更新）なら false。`elapsed` が負（時計巻き戻し等の異常系）でも
 * `elapsed < durationMs` は真になる＝保守的に「まだクールダウン中」として reload を抑止する
 * （`elapsed >= 0` を別途要求すると、時計が巻き戻った瞬間だけ cooldown が外れて即 reload を
 * 許してしまい doc の意図と逆になる・QA 指摘で修正）。
 */
export function isUpdateCooldownActive(
  lastUpdatedAt: number | null,
  now: number,
  durationMs: number = UPDATE_COOLDOWN_MS,
): boolean {
  if (lastUpdatedAt === null) return false;
  const elapsed = now - lastUpdatedAt;
  return elapsed < durationMs;
}

/**
 * 投稿フォーム（/compose）にいる間は reload を defer する対象パスか（#228 自動下書き保存との
 * 事故防止・#551）。MainLayout.astro の投稿 FAB 出し分け（#283）も同じ判定を使う＝
 * 判定ロジックはここ1箇所に一本化し、両者から import する（#511/#513/#515 で踏んだ
 * 「同じ判定ロジックの二重管理によるドリフト」を再発させない・QA 指摘で統合）。
 * 引数は Astro.url.pathname / location.pathname のどちらでも渡せる（同じ string 型）。
 *
 * Composer は /compose だけの client:only 島なので、このページに留まっている＝
 * フォーム入力中・下書き中とみなす。ページを離れる（＝Astro は MPA なので必ずフルナビゲーション）と
 * このモジュールが新しいページで再実行され、待機中の SW が残っていれば onNeedRefresh が再発火して
 * 更新が適用される（ポーリングや Composer 内部状態への結合は不要）。
 */
export function isComposeRoute(pathname: string): boolean {
  return pathname.replace(/\/$/, "") === "/compose";
}
