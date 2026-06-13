import { nip19 } from "nostr-tools";
import { useEffect, useRef } from "react";
import { focusTrapTarget, getFocusableElements } from "../../lib/a11y/focus-trap.ts";
import { relativeTime, type FeedPost } from "../../lib/feed/parse.ts";

/**
 * npub を短縮表示する（npub1abc…xyz）。
 * nip19.npubEncode は純粋（副作用なし）なので SSR でも安全だが、
 * この島は client:load で描画されるためいずれにせよクライアント実行。
 */
function shortNpub(pubkey: string): string {
  let npub: string;
  try {
    npub = nip19.npubEncode(pubkey);
  } catch {
    // 万一エンコードに失敗しても表示は壊さない（生 pubkey の頭を出す）。
    npub = pubkey;
  }
  if (npub.length <= 16) return npub;
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

interface Props {
  post: FeedPost;
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
 *       ＋ 投稿者（npub 短縮）＋ 相対時刻。
 * 反応（リアクション/返信＝kind7・返信）はこの Issue では出さない（follow-up #5 申し送り）。
 * モーダルに反応領域を足せるよう、本文と meta を分けた構造にしてある。
 *
 * a11y: role="dialog" aria-modal、Esc / 背景クリック / × で閉じる。
 */
export default function PostDetail({ post, onClose, onSelectHashtag }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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
          target.focus();
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
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="投稿の詳細"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ha-ink/40"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-md max-h-full overflow-y-auto rounded-3xl bg-ha-white shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute top-3 right-3 z-10 rounded-full bg-ha-white/90 text-ha-green-deep w-8 h-8 leading-none text-lg font-bold shadow-sm hover:bg-ha-green hover:text-ha-white transition-colors"
        >
          ×
        </button>

        {post.imageUrl !== null && (
          <div className="aspect-square w-full overflow-hidden rounded-t-3xl bg-ha-green-soft">
            <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex flex-col gap-3 p-5">
          {post.caption !== "" && (
            <p className="text-base leading-relaxed text-ha-ink whitespace-pre-wrap">{post.caption}</p>
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
            <span className="font-mono">{shortNpub(post.pubkey)}</span>
            <time>{relativeTime(post.createdAt, Math.floor(Date.now() / 1000))}</time>
          </div>
        </div>
      </div>
    </div>
  );
}
