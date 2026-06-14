import { type CSSProperties, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { deletePost, fetchMyPosts, saveDisplayName } from "../../lib/nostr/client.ts";
import { getDisplayName, getPublicKeyHex } from "../../lib/nostr/keys.ts";
import type { FeedPost } from "../../lib/feed/parse.ts";

type Status = "loading" | "error" | "loaded";

/**
 * 「自分の植物」島（#28・client:only）。
 * - 自分の pubkey ＋ t:hanoba の投稿だけを取得して表示。
 * - 各投稿を削除できる（NIP-09 kind:5 ＋ nostr.build 画像削除＝写真と一蓮托生）。
 * - 表示名（ユーザー名）の確認・変更（kind:0 publish）。
 * 鍵・ネットワークはクライアントのみ（getPublicKeyHex / fetchMyPosts / deletePost）。
 */
export default function MyGrid() {
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // アンマウント後 / 再取得中の古い応答での setState を防ぐ（stale-async ガード）。
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function load() {
    setStatus("loading");
    try {
      const pubkey = await getPublicKeyHex();
      const result = await fetchMyPosts(pubkey);
      if (!aliveRef.current) return;
      setPosts(result);
      setStatus("loaded");
    } catch {
      if (aliveRef.current) setStatus("error");
    }
  }

  useEffect(() => {
    setName(getDisplayName());
    void load();
  }, []);

  async function saveName() {
    const trimmed = draftName.trim();
    if (trimmed === "") return;
    setName(trimmed);
    setEditing(false);
    await saveDisplayName(trimmed); // ローカル保存＋best-effort kind:0 publish（共通）
  }

  async function onDelete(post: FeedPost) {
    setConfirmId(null);
    setNotice(null);
    setDeletingId(post.id);
    try {
      const { imageDeleted } = await deletePost(post);
      if (!aliveRef.current) return;
      setPosts((cur) => cur.filter((p) => p.id !== post.id));
      // 写真と一蓮托生のはずが、画像削除が確認できなかった場合は正直に伝える。
      if (post.imageUrl !== null && !imageDeleted) {
        setNotice("投稿は削除しましたが、写真の削除を確認できませんでした（数分後に消える場合があります）。");
      }
    } catch {
      if (aliveRef.current) {
        setNotice("削除できませんでした。時間をおいて再試行してください。");
      }
    } finally {
      if (aliveRef.current) setDeletingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      {/* アカウント（表示名） */}
      <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
        {editing ? (
          <form
            className="flex items-center gap-2 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="ユーザー名"
              aria-label="ユーザー名"
              autoFocus
              className="flex-1 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
            />
            <button
              type="submit"
              className="rounded-full bg-ha-green text-ha-white px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition"
            >
              保存
            </button>
          </form>
        ) : (
          <>
            <span className="text-ha-ink/85">
              {name === null ? (
                <span className="text-ha-ink/55">ユーザー名 未設定</span>
              ) : (
                <span className="font-semibold">{name}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setDraftName(name ?? "");
                setEditing(true);
              }}
              className="shrink-0 text-sm text-ha-green hover:text-ha-green-deep transition-colors"
            >
              {name === null ? "名前を設定" : "名前を変える"}
            </button>
          </>
        )}
      </div>

      {notice !== null && (
        <p
          role="status"
          className="rounded-2xl bg-white/6 backdrop-blur-md border-l-2 border-l-ha-pink text-ha-ink px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}

      {status === "loading" && <p className="py-12 text-center text-ha-ink/60">読み込み中…</p>}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">読み込めませんでした。</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            再試行
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <p className="text-ha-ink/70">まだ、あなたの植物はありません。</p>
            <a
              href="/compose"
              className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
            >
              最初の一枚を置く
            </a>
          </div>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-0.5">
            {posts.map((post, i) => (
              <li
                key={post.id}
                className="ha-rise group relative aspect-square overflow-hidden rounded-md bg-ha-green-soft"
                style={{ "--i": Math.min(i, 11) } as CSSProperties}
              >
                {post.imageUrl !== null && (
                  <img
                    src={post.imageUrl}
                    alt={post.caption}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}

                {/* 削除ボタン（常時うっすら・hover で明瞭） */}
                {deletingId !== post.id && confirmId !== post.id && (
                  <button
                    type="button"
                    onClick={() => setConfirmId(post.id)}
                    aria-label="この投稿を削除"
                    className="absolute top-1.5 right-1.5 grid place-items-center w-8 h-8 rounded-full bg-black/45 backdrop-blur-md text-ha-white opacity-70 hover:opacity-100 hover:bg-ha-pink transition"
                  >
                    <Icon name="trash" className="w-4 h-4" />
                  </button>
                )}

                {/* 確認オーバーレイ */}
                {confirmId === post.id && (
                  <div className="absolute inset-0 grid place-items-center gap-2 bg-black/70 backdrop-blur-sm p-2 text-center">
                    <p className="text-xs text-ha-white leading-snug">
                      写真ごと削除しますか？
                      <br />
                      （元に戻せません）
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onDelete(post)}
                        className="rounded-full bg-ha-pink text-ha-white px-3 py-1 text-xs font-semibold hover:brightness-110 transition"
                      >
                        削除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-full bg-white/15 text-ha-white px-3 py-1 text-xs hover:bg-white/25 transition"
                      >
                        やめる
                      </button>
                    </div>
                  </div>
                )}

                {/* 削除中 */}
                {deletingId === post.id && (
                  <div className="absolute inset-0 grid place-items-center bg-black/70 text-xs text-ha-white">
                    削除中…
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
