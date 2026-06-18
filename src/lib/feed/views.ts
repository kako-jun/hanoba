// 名前付きビュー（#139 段階3）。discover（みんなの植物）の検索状態を名前付きで保存し、
// 上部のチップでワンタップ切替できるようにする「自分専用チャンネル」。
//
// ビュー＝`{ id, label, query }`。query は **現在の discover の検索文字列（`?q=` の値）を丸ごと**
// 持つ。今は単一語だが、将来 URL が多軸化（tags/author/since/sort・#131）しても「現在の query を
// そのまま保存」する作りなので前方互換に活きる（views.ts は query 文字列の中身を解釈しない）。
//
// これは taxonomy（不変の Def）でなく**実行時状態**＝表示の好み。フィードの取得・パースには
// 触らず、既存の `?q=` 反映経路（DiscoverGrid）に「切替＝query を適用」として乗せるだけ
// （DESIGN の Def/状態分離・単一責務）。
// SSR 安全: localStorage は必ず関数内で参照する（recent-tags.ts / dilution.ts の getLS パターン）。

/** 名前付きビューを保存する localStorage キー（storage リスナの絞り込みにも使う）。 */
export const KEY = "hanoba:saved-views";

/**
 * 保存されたビュー。
 * - `id`: 並べ替え・削除・React key 用の安定識別子。
 * - `label`: チップに出すユーザー命名（例「実生」「○○さん」）。
 * - `query`: 適用する discover 検索文字列（`?q=` の値）。多軸 URL が来てもこの文字列を丸ごと保存。
 */
export type SavedView = { id: string; label: string; query: string };

/** SSR 安全に localStorage を取得する（サーバ評価時は null）。 */
function getLS(): Storage | null {
  return typeof localStorage === "undefined" ? null : localStorage;
}

/** crypto.randomUUID（無ければ時刻＋乱数）で衝突しにくい id を作る（Composer makeDraftImage 同型）。 */
function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

/** 任意の値が SavedView の形（id/label/query すべて string）かを判定する（壊れ値の握り潰しに使う）。 */
function isSavedView(v: unknown): v is SavedView {
  if (v === null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.label === "string" && typeof o.query === "string";
}

/**
 * 保存済みの全ビューを配列順で返す（追加順＝先頭が古い）。
 * 壊れた値・形の合わない要素は握り潰して除外する（空配列に倒す）。
 */
export function getSavedViews(): SavedView[] {
  const raw = getLS()?.getItem(KEY);
  if (raw === null || raw === undefined || raw === "") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedView);
  } catch {
    return [];
  }
}

/** 全ビューを localStorage に書く（内部用）。 */
function writeSavedViews(views: SavedView[]): SavedView[] {
  getLS()?.setItem(KEY, JSON.stringify(views));
  return views;
}

/**
 * 新しいビューを末尾に追加する。更新後の全ビューを返す。
 * - label / query は trim し、どちらかが空なら追加しない（現状を返す）。
 * - **同じ query が既にあれば二重登録しない**（チップは query で active 判定するため、同じ query を
 *   複数持つと「どれがアクティブか」が定まらない＝UX が壊れる。最初の1件で代表させる）。
 *   既存の label を上書きもしない（命名し直しは removeSavedView→addSavedView で行う）。
 */
export function addSavedView(label: string, query: string): SavedView[] {
  const l = label.trim();
  const q = query.trim();
  if (l === "" || q === "") return getSavedViews();
  const views = getSavedViews();
  if (views.some((v) => v.query === q)) return views; // 同 query は二重登録しない
  return writeSavedViews([...views, { id: makeId(), label: l, query: q }]);
}

/** 指定 id のビューを削除する。更新後の全ビューを返す（無い id は無視＝現状を返す）。 */
export function removeSavedView(id: string): SavedView[] {
  const views = getSavedViews();
  const next = views.filter((v) => v.id !== id);
  if (next.length === views.length) return views; // 変化なしなら書かない
  return writeSavedViews(next);
}

/**
 * 指定 id のビューのラベルを付け替える。更新後の全ビューを返す。
 * - 空ラベル（trim 後 ""）・無い id は無視（現状を返す）。query は変えない。
 */
export function renameSavedView(id: string, label: string): SavedView[] {
  const l = label.trim();
  if (l === "") return getSavedViews();
  const views = getSavedViews();
  let changed = false;
  const next = views.map((v) => {
    if (v.id === id && v.label !== l) {
      changed = true;
      return { ...v, label: l };
    }
    return v;
  });
  return changed ? writeSavedViews(next) : views;
}
