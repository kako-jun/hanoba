import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { useSavedViews } from "./useSavedViews.ts";

interface Props {
  /**
   * 現在の discover 検索文字列（`?q=` の値）。空＝既定検索（「すべて」がアクティブ）。
   * DiscoverGrid の単一情報源（query state）を素通しで受ける（二重管理しない）。
   */
  currentQuery: string;
  /**
   * チップ tap でビューを適用する（DiscoverGrid の既存 `?q=` 反映経路に乗せる）。
   * - 「すべて」は空文字＝既定検索へ戻す。
   * - 保存ビューはその query を渡す（意図的操作なので呼び出し側で pushState 相当を行う）。
   */
  onApply: (query: string) => void;
}

/**
 * 名前付きビューのチップ列（#139 段階3・discover 上部）。
 *
 * 先頭に「すべて」（既定＝`?q=` 無し）、続いてユーザーが保存した自分専用チャンネル
 * （「実生」「○○さん」等）を並べ、ワンタップで切替する。現在の `?q=` と一致するビュー
 * （無しなら「すべて」）を満たし色でアクティブ表示する。
 *
 * - 切替: チップ tap → `onApply(query)`（DiscoverGrid の既存 `?q=` 反映経路＝pushState に乗る）。
 * - 保存: 現在検索中（`currentQuery` 非空）かつ未保存なら「＋ このビューを保存」→ ラベルを inline 入力。
 * - 削除: 「編集」トグルで各チップに × を出す（編集モード）。
 *
 * 状態の真実は localStorage（views.ts）。本島は購読（useSavedViews）と描画・入力だけを担う（§3 単一責務）。
 * 多軸フィルタ UI（tags/author/since/sort 同時指定）は #131 待ちで作らない＝query 文字列を丸ごと扱う前方互換。
 *
 * a11y: チップ列は `role="tablist"`／各チップは `role="tab"`＋`aria-selected`。編集・保存ボタンは aria-label。
 */
export default function SavedViews({ currentQuery, onApply }: Props) {
  const { views, add, remove } = useSavedViews();
  const q = currentQuery.trim();

  // 編集モード（× を出す）。保存ビューが0件なら編集する対象が無いので自動で閉じる。
  const [editing, setEditing] = useState(false);
  // ラベル入力中か（保存導線を開いているか）と、その入力値。
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const labelInputRef = useRef<HTMLInputElement>(null);

  // 保存ビューが消えたら編集モードを畳む（× を出す対象が無い）。
  useEffect(() => {
    if (views.length === 0 && editing) setEditing(false);
  }, [views.length, editing]);

  // ラベル入力を開いたらフォーカスする（即タイプできる）。
  useEffect(() => {
    if (naming) labelInputRef.current?.focus();
  }, [naming]);

  // 現在の query が既に保存済みか（保存導線の出し分け・active 判定に使う）。
  const alreadySaved = q !== "" && views.some((v) => v.query === q);

  function confirmSave() {
    const l = label.trim();
    if (l === "" || q === "") return;
    add(l, q);
    setLabel("");
    setNaming(false);
  }

  function cancelSave() {
    setLabel("");
    setNaming(false);
  }

  function onLabelKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelSave();
    }
  }

  // チップの共通スタイル（active=満たし色・非active=glass）。DilutionControl / TagPicker に揃える。
  function chipClass(active: boolean): string {
    return `inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green ${
      active
        ? "bg-ha-green text-ha-white shadow-sm shadow-ha-green/30"
        : "glass text-ha-ink/75 hover:border-ha-green/50 hover:text-ha-green-deep"
    }`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div role="tablist" aria-label="保存したビュー" className="flex flex-wrap items-center gap-1.5">
        {/* 「すべて」＝既定検索（?q= 無し）。現在 query が空ならアクティブ。 */}
        <button
          type="button"
          role="tab"
          aria-selected={q === ""}
          onClick={() => onApply("")}
          className={chipClass(q === "")}
        >
          すべて
        </button>

        {views.map((v) => {
          const active = v.query === q;
          return (
            <span key={v.id} className="inline-flex items-center">
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onApply(v.query)}
                className={chipClass(active)}
              >
                {v.label}
                {editing && (
                  // 編集モードでは × を同じチップ内に出す（削除）。tab の選択とは別操作なので
                  // span（クリックで stopPropagation）にして親ボタンの onApply を発火させない。
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`ビュー「${v.label}」を削除する`}
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(v.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        remove(v.id);
                      }
                    }}
                    className={`-mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ${
                      active ? "text-ha-white/80 hover:text-ha-white" : "text-ha-ink/50 hover:text-ha-ink"
                    }`}
                  >
                    <Icon name="close" className="h-3 w-3" />
                  </span>
                )}
              </button>
            </span>
          );
        })}
      </div>

      {/* 保存導線: 検索中（query 非空）かつ未保存のときだけ出す。?q= 空（既定）では出さない。 */}
      {q !== "" && !alreadySaved && (
        naming ? (
          <span className="inline-flex items-center gap-1 rounded-full glass px-2 py-1">
            <input
              ref={labelInputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={onLabelKeyDown}
              placeholder="ビュー名"
              aria-label="保存するビューの名前"
              maxLength={20}
              className="w-24 bg-transparent px-1 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={confirmSave}
              disabled={label.trim() === ""}
              aria-label="この名前で保存する"
              className="rounded-full bg-ha-green px-2.5 py-0.5 text-xs font-semibold text-ha-white disabled:opacity-40"
            >
              保存
            </button>
            <button
              type="button"
              onClick={cancelSave}
              aria-label="保存をやめる"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ha-ink/50 hover:text-ha-ink"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="inline-flex items-center gap-1 rounded-full glass px-3 py-1.5 text-sm font-medium text-ha-green-deep hover:border-ha-green/50"
          >
            <Icon name="plus" className="h-3.5 w-3.5" />
            このビューを保存
          </button>
        )
      )}

      {/* 編集トグル: 保存ビューが1件以上あるときだけ出す（× の表示/非表示を切り替える）。 */}
      {views.length > 0 && (
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          aria-pressed={editing}
          className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green ${
            editing ? "bg-ha-green-soft text-ha-green-deep" : "text-ha-ink/50 hover:text-ha-green-deep"
          }`}
        >
          {editing ? "完了" : "編集"}
        </button>
      )}
    </div>
  );
}
