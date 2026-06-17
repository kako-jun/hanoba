import { useEffect, useState } from "react";
import { deleteComment, fetchReplies, publishReply } from "../../lib/nostr/client.ts";
import { getPublicKeyHex } from "../../lib/nostr/keys.ts";
import { sortComments, toComments, type Comment, type CommentOrder } from "../../lib/feed/comments.ts";

/**
 * 投稿のコメント（Nostr リプライ＝kind:1）を読み書きするフック（#142）。
 *
 * - マウント時／postId 変更時に fetchReplies で取得し、現在の order で並べる。
 * - submit: publishReply してから refetch（最も単純で正しい）。失敗は throw して UI に伝える。
 * - remove: deleteComment してからローカル一覧から落とす。
 * - order 変更は再取得せず手元のリストを並べ替えるだけ。
 *
 * relay 呼び出しは client（fetchReplies/publishReply/deleteComment）に集約済み。
 * setState は alive ガードで unmount / postId 切替後を無効化する（PostDetail と同パターン）。
 */
export function useComments(postId: string): {
  comments: Comment[] | null;
  loading: boolean;
  myPubkey: string | null;
  order: CommentOrder;
  setOrder: (o: CommentOrder) => void;
  submit: (content: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
} {
  // null = 未取得（読み込み中）。取得後は配列（0件もありうる）。
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [order, setOrder] = useState<CommentOrder>("old");
  const [myPubkey, setMyPubkey] = useState<string | null>(null);

  // 自分の pubkey（自分のコメントに削除ボタンを出すため）。一度だけ解決する。失敗は null のまま。
  useEffect(() => {
    let alive = true;
    getPublicKeyHex()
      .then((pk) => {
        if (alive) setMyPubkey(pk);
      })
      .catch(() => {
        /* 鍵が取れないだけ＝削除ボタンを出さない。 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 取得（マウント時・postId 変更時）。order はここでは初期 "old" でなく現在値で並べる。
  useEffect(() => {
    let alive = true;
    setComments(null);
    fetchReplies(postId).then((events) => {
      if (alive) setComments(sortComments(toComments(events), order));
    });
    return () => {
      alive = false;
    };
    // order は変更時に下の effect で並べ替えるので依存に入れない（postId 変更時だけ再取得）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // order 変更は再取得せず手元のリストを並べ替える（sortComments は非破壊）。
  useEffect(() => {
    setComments((prev) => (prev === null ? prev : sortComments(prev, order)));
  }, [order]);

  // コメント投稿 → 成功後に refetch（最も単純で正しい・取りこぼし時も次回取得で揃う）。
  // 失敗は throw して呼び出し側（UI）がエラー表示できるようにする。
  async function submit(content: string): Promise<void> {
    await publishReply({ content, parentId: postId });
    const events = await fetchReplies(postId);
    setComments(sortComments(toComments(events), order));
  }

  // 自分のコメント削除 → 成功後にローカル一覧から落とす（refetch は relay に消えるまで間がある）。
  async function remove(id: string): Promise<void> {
    await deleteComment(id);
    setComments((prev) => (prev === null ? prev : prev.filter((c) => c.id !== id)));
  }

  return {
    comments,
    loading: comments === null,
    myPubkey,
    order,
    setOrder,
    submit,
    remove,
  };
}
