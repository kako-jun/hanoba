import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { detectPlants } from "../../lib/plants/detect.ts";
import { focusTrapTarget, getFocusableElements } from "../../lib/a11y/focus-trap.ts";
import { relativeTime, shortNpub, type FeedPost, type Profile } from "../../lib/feed/parse.ts";
import { fetchReactionCount } from "../../lib/nostr/client.ts";
import Avatar from "./Avatar.tsx";

interface Props {
  post: FeedPost;
  /** 著者プロフィール（#35・アイコン/名前/サイトリンク。未取得なら null）。 */
  profile?: Profile | null;
  /** 背景・×・Esc いずれかで閉じる。 */
  onClose: () => void;
  /** ハッシュタグをクリックしたとき（クライアント側絞り込み）。閉じてから絞り込む。 */
  onSelectHashtag: (tag: string) => void;
}

/**
 * 投稿詳細モーダル（DESIGN §4）。別ルートにせず FeedGrid 内の島として開く
 * ＝静的サイト（CF Pages・SSR なし）を維持する。
 *
 * 内容: 1:1 画像 ＋ 一言（caption）＋ ハッシュタグ（クリックで絞り込み）
 *       ＋ 投稿者（npub 短縮）＋ 相対時刻 ＋ いいね数（♡ N）。
 * いいね数は NIP-25 の kind:7 リアクションの読み取り集計（表示のみ・#12）。
 * いいねの書き込み（kind:7 publish）はこの Issue では作らない。
 * モーダルに反応領域を足せるよう、本文と meta を分けた構造にしてある。
 *
 * a11y: role="dialog" aria-modal、Esc / 背景クリック / × で閉じる。
 */
export default function PostDetail({ post, profile, onClose, onSelectHashtag }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const authorName = profile?.name ?? shortNpub(post.pubkey);

  // いいね数（kind:7 集計）。取得前は null＝プレースホルダ（♡ -）を出す。
  const [likeCount, setLikeCount] = useState<number | null>(null);

  // Esc で閉じる／Tab はモーダル内に循環を閉じる（フォーカストラップ）。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current !== null) {
        const focusables = getFocusableElements(panelRef.current);
        const active = document.activeElement as HTMLElement | null;
        const target = focusTrapTarget(focusables, active, e.shiftKey);
        if (target !== null) {
          target.focus({ preventScroll: true });
          e.preventDefault();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // フォーカス管理（a11y）: 開いたら閉じるボタンへフォーカスを移し、
  // 閉じたら開く前にフォーカスがあった要素（クリックしたセル）へ戻す。
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // preventScroll: focus による背面スクロール飛びを防ぐ（開＝閉じるボタン／閉＝元セル・#79）。
    closeButtonRef.current?.focus({ preventScroll: true });
    return () => {
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  // いいね数を取得する（クライアントのみ・SSR では走らない）。
  // アンマウント後・post 切替後の setState を alive フラグで防ぐ。
  useEffect(() => {
    let alive = true;
    setLikeCount(null);
    fetchReactionCount(post.id).then((count) => {
      if (alive) setLikeCount(count);
    });
    return () => {
      alive = false;
    };
  }, [post.id]);

  // 本文＋タグから植物を認識（#23）。純粋・軽量なので描画ごとに計算してよい。
  const plants = detectPlants(`${post.caption} ${post.hashtags.join(" ")}`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="投稿の詳細"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="glass-strong relative w-full max-w-md max-h-full overflow-y-auto rounded-3xl shadow-2xl flex flex-col ha-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-3 right-3 z-10 grid place-items-center rounded-full bg-black/40 backdrop-blur-md text-ha-white w-8 h-8 hover:bg-ha-green transition-colors"
        >
          <Icon name="close" className="w-4 h-4" />
        </button>

        {post.imageUrl !== null && (
          // 拡大は元の縦横比のまま（object-contain）。他クライアント＝他人の写真を 1:1 に
          // トリミングすると著作の改変になるため、モーダルではクロップしない（#61）。
          // サムネイル（フィードカード）は一覧の見た目を揃えるため正方形のまま。
          <div className="w-full overflow-hidden rounded-t-3xl bg-ha-green-soft flex items-center justify-center">
            <img
              src={post.imageUrl}
              alt={post.caption}
              className="max-w-full max-h-[70vh] object-contain"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 p-5">
          {post.caption !== "" && (
            <p className="text-base leading-relaxed text-ha-ink whitespace-pre-wrap">{post.caption}</p>
          )}

          {/* 認識した植物を「学名 / 著名表記」で並列表示（#23）。本文・タグ どちらの語にも反応。
              クリックでその植物の discover 検索へ。投稿は不変なので辞書を育てて精度を上げる。 */}
          {plants.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ha-ink/45">
                この投稿の植物
              </span>
              <ul className="flex flex-wrap gap-2">
                {plants.map((p) => (
                  <li key={p.id}>
                    <a
                      href={`/discover?q=${encodeURIComponent(`#${p.name}`)}`}
                      className="glass inline-flex items-baseline gap-1.5 rounded-full px-3 py-1 text-sm hover:border-ha-green/50 transition-colors"
                      title={`${p.sci}（${p.name}）で探す`}
                    >
                      <span className="font-display italic text-ha-green-deep">{p.sci}</span>
                      <span className="text-ha-ink/70">{p.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {post.hashtags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {post.hashtags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    onClick={() => onSelectHashtag(tag)}
                    className="rounded-full bg-ha-green-soft text-ha-green-deep px-3 py-1 text-sm font-medium hover:bg-ha-green hover:text-ha-white transition-colors"
                  >
                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3 pt-1 text-xs text-ha-ink/60">
            {/* 著者（アイコン＋名前）。サイトリンクは #35 Piece 2 でここに足す。 */}
            <span className="flex min-w-0 items-center gap-2">
              <Avatar src={profile?.picture ?? null} name={authorName} className="w-6 h-6" />
              <span className="min-w-0 truncate font-medium text-ha-ink/80">{authorName}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5"
                aria-label={`いいね ${likeCount === null ? "取得中" : likeCount}`}
              >
                <Icon name="heart" className="w-4 h-4 text-ha-pink" />
                <span className="font-display font-semibold text-ha-ink/70 tabular-nums">
                  {likeCount === null ? "-" : likeCount}
                </span>
              </span>
              <time>{relativeTime(post.createdAt, Math.floor(Date.now() / 1000))}</time>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
