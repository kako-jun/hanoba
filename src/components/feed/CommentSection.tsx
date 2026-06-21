import { useState } from "react";
import { relativeTime, shortNpub } from "../../lib/feed/parse.ts";
import ResizableTextarea from "../ui/ResizableTextarea.tsx";
import { useComments } from "./useComments.ts";
import { useProfiles } from "./useProfiles.ts";
import Avatar from "./Avatar.tsx";
import { useT, useLocale } from "../../lib/i18n/index.ts";

interface Props {
  /** コメント対象の投稿 id（親イベント id）。 */
  postId: string;
}

/**
 * 投稿詳細モーダル内のコメント欄（#142）。コメントは Nostr のリプライ（kind:1・親を e タグ root）。
 * @呼びかけ（p タグ）は付けない＝静かに添える一言（DESIGN §6）。
 *
 * 構成:
 * - 見出し行: コメント件数 ＋ 並び替えトグル（古い順 ⇄ 新しい順）。
 * - 一覧: アバター＋名前＋相対時刻＋本文（改行保持）。自分のコメントには 削除（確認つき）。
 * - 入力: ResizableTextarea ＋ 緑の送信ボタン（送信中・空は無効）。
 *
 * relay 呼び出しは useComments → client に集約。暗色・控えめの glass で「静かなコメント」に。
 */
export default function CommentSection({ postId }: Props) {
  const t = useT(useLocale());
  const { comments, loading, myPubkey, order, setOrder, submit, remove } = useComments(postId);
  // 著者プロフィール（アイコン・名前）。取得前は npub フォールバック。
  const profiles = useProfiles((comments ?? []).map((c) => c.pubkey));

  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 削除確認中のコメント id（インライン確認＝投稿削除と同じ「破壊操作は確認」ポリシー・§5.6）。
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const now = Math.floor(Date.now() / 1000);
  const canSubmit = draft.trim() !== "" && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await submit(draft);
      setDraft("");
    } catch {
      setError(t("comment.error.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemove(id: string) {
    setConfirmId(null);
    setRemovingId(id);
    setError(null);
    try {
      await remove(id);
    } catch {
      setError(t("comment.error.remove"));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section aria-label={t("comment.section.aria")} className="flex flex-col gap-3 border-t border-ha-ink/10 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-ha-ink/80">
          {t("comment.heading")} {comments === null ? "" : comments.length}
        </h3>
        {/* 並び替えトグル（押すと反対の順へ）。**並べ替える対象が無い**＝0件/1件/読み込み中は
            出さない（kako-jun「0件のとき『古い順』は要らない」。1件も順序が無いので同様に隠す）。 */}
        {comments !== null && comments.length > 1 && (
          <button
            type="button"
            onClick={() => setOrder(order === "old" ? "new" : "old")}
            aria-label={order === "old" ? t("comment.sort.toNew") : t("comment.sort.toOld")}
            className="rounded-full px-3 py-1 text-xs font-medium text-ha-ink/60 hover:bg-ha-ink/5 hover:text-ha-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green/40"
          >
            {order === "old" ? t("comment.sort.old") : t("comment.sort.new")}
          </button>
        )}
      </div>

      {/* 状態通知（読み込み・送受信エラー）を aria-live で読み上げる。 */}
      <div aria-live="polite">
        {loading && <p className="text-xs text-ha-ink/45">{t("comment.loading")}</p>}
        {error !== null && <p className="text-xs text-ha-pink">{error}</p>}
      </div>

      {comments !== null && comments.length === 0 && (
        <p className="text-xs text-ha-ink/45">{t("comment.empty")}</p>
      )}

      {comments !== null && comments.length > 0 && (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => {
            const profile = profiles.get(c.pubkey);
            // 名前が無ければ npub 短縮へ（shortNpub は必ず文字列を返す＝表示が空にならない）。
            const name = profile?.name ?? shortNpub(c.pubkey);
            const isMine = myPubkey !== null && c.pubkey === myPubkey;
            const isRemoving = removingId === c.id;
            return (
              <li key={c.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar src={profile?.picture ?? null} name={name} className="h-6 w-6" />
                    <span className="min-w-0 truncate text-xs font-medium text-ha-ink/80">{name}</span>
                    <time className="shrink-0 text-[11px] text-ha-ink/45">
                      {relativeTime(c.createdAt, now)}
                    </time>
                  </span>
                  {isMine && !isRemoving && confirmId !== c.id && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(c.id)}
                      aria-label={t("comment.delete.aria")}
                      className="shrink-0 rounded-full px-2 py-0.5 text-[11px] text-ha-ink/45 hover:bg-ha-pink/15 hover:text-ha-pink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-pink/40"
                    >
                      {t("comment.delete.label")}
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words pl-8 text-sm leading-relaxed text-ha-ink/90">
                  {c.content}
                </p>
                {/* 削除の確認（破壊操作はインライン確認・§5.6）。 */}
                {isMine && confirmId === c.id && (
                  <div className="flex items-center gap-2 pl-8 text-xs">
                    <span className="text-ha-ink/60">{t("comment.delete.confirm.q")}</span>
                    <button
                      type="button"
                      onClick={() => void onRemove(c.id)}
                      className="rounded-full bg-ha-pink px-3 py-0.5 font-semibold text-ha-white hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-pink/50"
                    >
                      {t("comment.delete.label")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded-full bg-ha-ink/10 px-3 py-0.5 text-ha-ink/70 hover:bg-ha-ink/15 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green/40"
                    >
                      {t("comment.delete.confirm.no")}
                    </button>
                  </div>
                )}
                {isRemoving && <p className="pl-8 text-[11px] text-ha-ink/45">{t("comment.deleting")}</p>}
              </li>
            );
          })}
        </ul>
      )}

      {/* 入力欄＋送信（主操作＝塗りの緑ボタンを右端・§5.6）。 */}
      <div className="flex flex-col gap-2">
        <ResizableTextarea
          id={`hanoba-comment-${postId}`}
          aria-label={t("comment.input.aria")}
          value={draft}
          onValueChange={setDraft}
          clearLabel={t("comment.input.clear")}
          placeholder={t("comment.input.placeholder")}
          initialHeight={84}
          minHeight={72}
          maxHeight={240}
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
            className="rounded-full bg-ha-green px-5 py-2 text-sm font-semibold text-ha-white shadow-sm shadow-ha-green/30 enabled:hover:opacity-90 enabled:hover:shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? t("comment.submit.posting") : t("comment.submit")}
          </button>
        </div>
      </div>
    </section>
  );
}
