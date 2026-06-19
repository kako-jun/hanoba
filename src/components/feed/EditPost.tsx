import { useEffect, useState } from "react";
import Icon from "../ui/Icon.tsx";
import ResizableTextarea from "../ui/ResizableTextarea.tsx";
import ProgressiveImage from "../ui/ProgressiveImage.tsx";
import { editPost, fetchCommentCountsBatch, fetchReactionCountsBatch } from "../../lib/nostr/client.ts";
import { parsePost, type FeedPost } from "../../lib/feed/parse.ts";

interface Props {
  /** 編集対象（自分の投稿）。 */
  post: FeedPost;
  /** 閉じる（キャンセル／完了後）。 */
  onClose: () => void;
  /** 編集が成功して新しい投稿に差し替わったら呼ぶ（差し替え反映用）。 */
  onEdited: (newPost: FeedPost) => void;
}

type Stage = "edit" | "confirm" | "saving" | "error";

/**
 * 投稿の編集（#300・mypace 由来）。Nostr はイベント不変なので「編集」＝**新しい投稿として再投稿し、
 * 旧投稿を削除**する（client.editPost）。**写真は URL を再利用**（再アップロードしない）ので、本文だけを
 * 直せる。いいね・コメントは旧イベントに紐づくため引き継がれない＝**確認を1段挟んでから**実行する。
 *
 * 本文は post.caption（画像 URL を除いた全文＝#タグも含む）をそのまま編集する（投稿フォームと同じ
 * テキスト規約。タグも本文の一部として直す）。写真は読み取り専用サムネで「何を編集しているか」を示す。
 */
export default function EditPost({ post, onClose, onEdited }: Props) {
  const [caption, setCaption] = useState(post.caption);
  const [stage, setStage] = useState<Stage>("edit");
  // 引き継がれない いいね/コメント 数（確認文に出す）。取得前は null＝数を伏せた文言にする。
  const [counts, setCounts] = useState<{ likes: number; comments: number } | null>(null);

  // Esc で閉じる（編集中・確認中のみ。保存中は閉じない＝二重操作防止）。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && (stage === "edit" || stage === "confirm" || stage === "error")) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

  // 引き継がれない数を1回取得（失敗は伏せるだけ＝確認は出す）。
  useEffect(() => {
    let alive = true;
    Promise.all([fetchReactionCountsBatch([post.id]), fetchCommentCountsBatch([post.id])])
      .then(([r, c]) => {
        if (alive) setCounts({ likes: r.get(post.id) ?? 0, comments: c.get(post.id) ?? 0 });
      })
      .catch(() => {
        /* 数が出ないだけ（確認文は数なし版を出す）。 */
      });
    return () => {
      alive = false;
    };
  }, [post.id]);

  const trimmed = caption.trim();
  // 空（写真だけ投稿は不可）と、無変更は保存させない。
  const canSave = trimmed !== "" && trimmed !== post.caption.trim();

  async function save() {
    setStage("saving");
    try {
      const created = await editPost({ oldEventId: post.id, caption: trimmed, imageUrls: post.imageUrls });
      onEdited(parsePost(created));
    } catch {
      setStage("error");
    }
  }

  const hasReactions = counts !== null && counts.likes + counts.comments > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="投稿を編集"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => {
        if (stage === "edit" || stage === "confirm" || stage === "error") onClose();
      }}
    >
      <div
        className="glass-strong relative flex w-full max-w-md max-h-full flex-col gap-4 overflow-y-auto rounded-xl p-5 shadow-2xl ha-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ha-green-deep">投稿を編集</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={stage === "saving"}
            aria-label="閉じる"
            className="grid h-8 w-8 place-items-center rounded-full text-ha-ink/55 hover:bg-white/10 hover:text-ha-ink disabled:opacity-40 transition"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        {/* 写真は読み取り専用（URL を再利用＝再アップロードしない）。何を編集しているかの手掛かり。 */}
        {post.imageUrls.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {post.imageUrls.map((url, i) => (
              <li key={url} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ha-green-soft">
                <ProgressiveImage src={url} alt={`${i + 1}枚目`} className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
        )}

        <ResizableTextarea
          id="hanoba-edit-caption"
          label="本文"
          value={caption}
          onValueChange={setCaption}
          placeholder="一言（#タグも本文に書けます）"
          disabled={stage === "saving"}
        />

        {stage === "error" && (
          <p role="alert" className="rounded-2xl bg-white/6 border-l-2 border-l-ha-pink px-4 py-3 text-sm text-ha-ink">
            編集できませんでした。時間をおいて、もう一度試してください。
          </p>
        )}

        {/* 確認（いいね/コメントが消える）。編集＝再投稿になることを明示してから実行する。 */}
        {stage === "confirm" ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-white/6 p-4">
            <p className="text-sm leading-relaxed text-ha-ink">
              編集すると<strong className="font-semibold text-ha-pink">新しい投稿として再投稿</strong>され、
              {hasReactions ? (
                <>
                  この投稿の<strong className="font-semibold">いいね {counts!.likes}・コメント {counts!.comments}</strong>
                  は引き継がれません。
                </>
              ) : (
                <>元の投稿に付いたいいね・コメントは引き継がれません。</>
              )}
              よろしいですか？
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStage("edit")}
                className="rounded-full bg-white/10 px-4 py-2 text-sm text-ha-ink hover:bg-white/20 transition"
              >
                もどる
              </button>
              <button
                type="button"
                onClick={() => void save()}
                className="rounded-full bg-ha-pink px-5 py-2 text-sm font-semibold text-ha-white shadow-sm shadow-ha-pink/30 hover:brightness-110 transition"
              >
                編集して再投稿
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={stage === "saving"}
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-ha-ink hover:bg-white/20 disabled:opacity-40 transition"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={() => setStage("confirm")}
              disabled={!canSave || stage === "saving"}
              className="inline-flex items-center gap-2 rounded-full bg-ha-green px-5 py-2 text-sm font-semibold text-ha-white shadow-sm shadow-ha-green/30 enabled:hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {stage === "saving" ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-ha-white/40 border-t-ha-white motion-reduce:animate-none"
                  />
                  再投稿中…
                </>
              ) : (
                "更新する"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
