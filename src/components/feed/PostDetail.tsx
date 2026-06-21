import { type TouchEvent as ReactTouchEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../ui/Icon.tsx";
import { buildFuda, type Fuda } from "../../lib/plants/fuda.ts";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { stripHashtags } from "../../lib/nostr/tags.ts";
import { focusTrapTarget, getFocusableElements } from "../../lib/a11y/focus-trap.ts";
import { authorHref, relativeTime, shortNpub, type FeedPost, type Profile } from "../../lib/feed/parse.ts";
import { formatShotDate } from "../../lib/feed/shotDate.ts";
import { useLocale, useT } from "../../lib/i18n/index.ts";
import {
  nextPhotoIndex,
  prevPhotoIndex,
  swipeDirection,
  swipeProgress,
  swipeToBlur,
} from "../../lib/feed/carousel.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
import { fetchReactionCount } from "../../lib/nostr/client.ts";
import { toSiteLinks } from "../../lib/profile/services.ts";
import { buildNjumpPermalink, buildXShareParts, buildXShareWhole, openXShare } from "../../lib/share/x-share.ts";
import ProgressiveImage from "../ui/ProgressiveImage.tsx";
import FudaList from "./FudaList.tsx";
import Avatar from "./Avatar.tsx";
import CommentSection from "./CommentSection.tsx";
import DilutionControl from "./DilutionControl.tsx";

interface Props {
  post: FeedPost;
  /** 著者プロフィール（#35・アイコン/名前/サイトリンク。未取得なら null）。 */
  profile?: Profile | null;
  /** 背景・×・Esc いずれかで閉じる。 */
  onClose: () => void;
  /** ハッシュタグをクリックしたとき（クライアント側絞り込み）。閉じてから絞り込む。 */
  onSelectHashtag: (tag: string) => void;
  /**
   * 「フィードで薄める」コントロールを出すか（#138）。
   * フィード/discover（他人を薄める）では true、/me（自分の投稿）では false＝自分は薄めない。
   */
  showDilution?: boolean;
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
export default function PostDetail({ post, profile, onClose, onSelectHashtag, showDilution = false }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // タッチスワイプの始点（onTouchStart で記録 → onTouchEnd で差分を取る・#184）。
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const authorName = profile?.name ?? shortNpub(post.pubkey);
  // 著者の複数サイトリンク（#35 Piece 2）。kind:0 拡張 websites[] をアイコン列で出す。
  const siteLinks = toSiteLinks(profile?.websites ?? []);

  // いいね数（kind:7 集計）。取得前は null＝プレースホルダ（♡ -）を出す。
  const [likeCount, setLikeCount] = useState<number | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const locale = useLocale();
  const t = useT(locale);
  // 現在表示中の写真の撮影日（#324・写真↔日付の対応を保つ）。無ければ出さない。
  const currentShotDate = post.photoShotDates?.[photoIndex] ?? null;
  // スワイプ中の写真ぼかし（px・#275）。0＝ぼかし無し。指を離すと 0 に戻し、
  // index 確定で次画像が中央へ来る＝ぼかしも解ける。1枚／reduced-motion ではかからない。
  const [swipeBlur, setSwipeBlur] = useState(0);
  // 写真切替（←→/スワイプ）の瞬間に次画像が高さ0になり画面が上に詰まるのを防ぐ（#290）。
  // 直前に表示していた写真の実測高を min-height として写真コンテナに予約する。photoIndex が
  // 変わっても reservedH は保持＝切替中に潰れない。新画像の onLoad で実測高に更新する
  // （短い写真でも最終的にぴたり収まる）。ラッパは img を密に包む内側 div（ぼかしラッパ）を測る。
  const photoWrapRef = useRef<HTMLDivElement>(null);
  const [reservedH, setReservedH] = useState<number | undefined>(undefined);

  // 品種カタログは初期フィードバンドルに載せず、モーダル展開時に一度だけ動的 import する
  // （TagPicker の ensureCatalog と同型・SSR では走らない）。失敗時は null のまま＝札セクション非表示。
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);

  // X シェアのメニュー開閉（複数パートのときだけ「全文／1/n…」を出す・#37）。
  const [shareOpen, setShareOpen] = useState(false);

  // 共有テキストは生 caption（インライン #タグ込み）を使う。画像 URL は本文から除去済み
  // （parsePost）で、リンクは njump（最終パート）に集約する。タグはインライン済みなので
  // 追加ハッシュタグは渡さない（[]）。permalink は単一投稿ルートを持たない hanoba 用の nevent。
  const permalink = buildNjumpPermalink(post);
  const shareParts = buildXShareParts(post.caption, [], permalink);
  const isSplit = shareParts.length > 1;

  // Esc で閉じる／Tab はモーダル内に循環を閉じる（フォーカストラップ）。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // シェアのポップオーバーが開いていれば、まずそれを閉じる（モーダルは閉じない）。
        if (shareOpen) {
          setShareOpen(false);
          return;
        }
        onClose();
        return;
      }
      if (post.imageUrls.length > 1 && e.key === "ArrowLeft") {
        setPhotoIndex((i) => prevPhotoIndex(i, post.imageUrls.length));
        e.preventDefault();
        return;
      }
      if (post.imageUrls.length > 1 && e.key === "ArrowRight") {
        setPhotoIndex((i) => nextPhotoIndex(i, post.imageUrls.length));
        e.preventDefault();
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
  }, [onClose, post.imageUrls.length, shareOpen]);

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

  // 札（属＋品種）を組むために品種カタログを動的 import（モーダル展開時に一度・クライアントのみ）。
  // 失敗時は null のまま＝札セクションは出さない（下のハッシュタグチップは従来どおり出る）。
  useEffect(() => {
    let alive = true;
    import("../../lib/plants/variety-catalog.ts")
      .then((mod) => {
        if (alive) setCatalog(mod.VARIETY_CATALOG);
      })
      .catch(() => {
        /* 札セクションを出さないだけ（catalog は null のまま）。 */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 投稿の札（鉢の名前＝学名＋最も有名な和名を1枚・#182/#23）。caption は使わず hashtags のみ
  // （#181 で属＋品種が tag に入る）。catalog 未ロード時は空＝札セクション非表示。
  const fuda: Fuda[] = catalog === null ? [] : buildFuda(post.hashtags, catalog);

  // 表示用の本文は #タグ を除く（タグは下のチップに出すため・フィードカードと挙動を揃える・#43）。
  const captionText = stripHashtags(post.caption);

  // 写真領域のタッチスワイプ（#184）。←→ボタン・キーボード矢印と同じ wrap で切り替える。
  // 1枚のときは無効。水平優位＋しきい値（swipeDirection）のときだけ確定し、
  // 縦スクロール・ピンチ・微小タップとは競合させない。
  function onTouchStart(e: ReactTouchEvent) {
    if (post.imageUrls.length <= 1) return;
    const t = e.touches[0];
    if (t === undefined) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  // ドラッグ中はスワイプ量で写真をぼかす（#275）。水平優位のときだけ＝縦スクロールを邪魔しない。
  // 縦優位・始点なし・1枚・reduced-motion ではぼかさない（0 のまま）。
  function onTouchMove(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    if (start === null || post.imageUrls.length <= 1) return;
    if (prefersReducedMotion()) return;
    const t = e.touches[0];
    if (t === undefined) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 縦優位なら縦スクロール優先＝ぼかしを解いて 0 に戻す。
    if (Math.abs(dx) <= Math.abs(dy)) {
      setSwipeBlur(0);
      return;
    }
    // 整数 px に丸め、同値ならバイルアウト（毎フレームの無駄な再レンダを省く・#275）。
    const next = Math.round(swipeToBlur(swipeProgress(dx)));
    setSwipeBlur((prev) => (prev === next ? prev : next));
  }
  function onTouchEnd(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    // 指を離したらぼかしを解く（確定／キャンセルどちらでも・transition で戻る）。
    setSwipeBlur(0);
    if (start === null || post.imageUrls.length <= 1) return;
    const t = e.changedTouches[0];
    if (t === undefined) return;
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
    if (dir === "next") setPhotoIndex((i) => nextPhotoIndex(i, post.imageUrls.length));
    else if (dir === "prev") setPhotoIndex((i) => prevPhotoIndex(i, post.imageUrls.length));
  }

  // モーダルは body 直下にポータルする。さもないと島を包む `.ha-rise`（アニメ後も
  // 計算 transform が identity matrix で残る＝containing block を作る）の中に `position:fixed`
  // が閉じ込められ、長いページ（みんなの植物＝多数の投稿）では巨大ラッパの上端に貼り付いて
  // スクロール位置から外れ、「ポップアップが出ない」ように見える（トップは投稿が少なく露見しない）。
  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("detail.dialog.aria")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="glass-strong relative w-full max-w-md max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col ha-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute top-3 right-3 z-10 grid place-items-center rounded-full bg-black/40 backdrop-blur-md text-ha-white w-8 h-8 hover:bg-ha-green transition-colors"
        >
          <Icon name="close" className="w-4 h-4" />
        </button>

        {post.imageUrls.length > 0 && (
          // 写真は元の比率のまま見せる（#108）。hanoba 自前投稿は 1:1 出力（renderSquareImage）
          // なので正方形に収まり、他クライアントの非正方形写真はその比率のまま（クロップしない・#61）。
          // flex 列（max-h-full・overflow-y-auto）の中で flex-shrink に潰されて横長化していたので
          // shrink-0 で写真の自然な高さを確保する（これが「正方形が確保できない」の原因だった）。
          <div className="w-full shrink-0 overflow-hidden rounded-t-xl bg-ha-green-soft">
            <div
              className="relative flex items-center justify-center"
              // 写真領域のタッチスワイプで前後切替（#184）＋スワイプ量で写真をぼかす（#275）。
              // 1枚なら無効（onTouchStart 内で弾く）。縦スワイプはスクロール優先のため
              // touch-action は触らず（pan-y を残す）、スワイプ中の画像ドラッグ/選択だけ select-none で抑止する。
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              // 切替中も直前の写真高を確保＝次画像が高さ0でも領域が潰れない（#290）。
              style={{ minHeight: reservedH }}
            >
              {/* スワイプ中ぼかしは画像だけにかけるラッパで包む（#275）。←→ボタンには波及させない。
                  ha-reveal の blur-up（img 側 filter）と干渉させないよう、ここ（外側 div）に当てる
                  ＝2つの blur が合成され、リビール中でも壊れない。ドラッグ中は即追従（transition none）、
                  離したら 0.25s で戻す。1枚／reduced-motion では swipeBlur が常に 0＝無効。 */}
              <div
                ref={photoWrapRef}
                style={{
                  filter: swipeBlur > 0 ? `blur(${swipeBlur}px)` : undefined,
                  transition: swipeBlur > 0 ? "none" : "filter 0.25s ease",
                }}
              >
                <ProgressiveImage
                  // 写真切替で remount し1枚ごとに blur-up リビールを掛け直す（#145）。
                  key={photoIndex}
                  src={post.imageUrls[photoIndex] ?? post.imageUrls[0] ?? ""}
                  alt={post.imageUrls.length === 1 ? post.caption : t("detail.photo.alt", { caption: post.caption, n: photoIndex + 1 })}
                  className="max-w-full max-h-[70vh] select-none object-contain"
                  draggable={false}
                  // 新画像が高さを持った時点で予約高を実測値に更新（#290）。これで切替中の
                  // 潰れを防ぎつつ、短い写真でも最終的に余白なくぴたり収まる。
                  onLoad={() => setReservedH(photoWrapRef.current?.offsetHeight)}
                />
              </div>
              {post.imageUrls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((i) => prevPhotoIndex(i, post.imageUrls.length))}
                    aria-label={t("detail.photo.prev")}
                    className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-ha-white backdrop-blur-md hover:bg-ha-green transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
                  >
                    <Icon name="chevron" className="h-5 w-5 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoIndex((i) => nextPhotoIndex(i, post.imageUrls.length))}
                    aria-label={t("detail.photo.next")}
                    className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-ha-white backdrop-blur-md hover:bg-ha-green transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
                  >
                    <Icon name="chevron" className="h-5 w-5 -rotate-90" />
                  </button>
                </>
              )}
              {/* この写真の撮影日（#324・写真ごと）。左下に控えめに重ねる＝めくると日付も変わり
                  「1ヶ月の変化」が読める。撮影日が無い写真は出さない。 */}
              {currentShotDate !== null && (
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-ha-white backdrop-blur-sm">
                  <Icon name="camera" className="h-3 w-3" />
                  {formatShotDate(currentShotDate, locale)}
                </span>
              )}
            </div>
            {post.imageUrls.length > 1 && (
              <div className="flex justify-center gap-1.5 py-2">
                {post.imageUrls.map((imageUrl, i) => (
                  <button
                    type="button"
                    key={`${imageUrl}-dot-${i}`}
                    onClick={() => setPhotoIndex(i)}
                    aria-label={t("detail.photo.goto", { n: i + 1 })}
                    aria-current={photoIndex === i ? "true" : undefined}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      photoIndex === i ? "bg-ha-green" : "bg-ha-green-deep/35 hover:bg-ha-green/70"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 p-5">
          {captionText !== "" && (
            <p className="text-base leading-relaxed text-ha-ink whitespace-pre-wrap">{captionText}</p>
          )}

          {/* 投稿の札（鉢の名前＝学名＋最も有名な和名を1枚・#182/#23）。カテゴリ・属単独に畳む。
              学名（catalog.sci → dictionary）が引ければイタリックで併記し、無ければ和名のみ
              （グレースフル）。クリックで最も具体的な和名の discover 検索へ。
              catalog 未ロード時は出さない（hashtags のみで組み、caption の free-text 検出はしない）。 */}
          {fuda.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-ha-ink/45">
                {t("detail.fuda.heading")}
              </span>
              <FudaList fuda={fuda} />
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

          <div className="flex flex-col gap-2 pt-1 text-xs text-ha-ink/60">
            <div className="flex items-center justify-between gap-3">
              {/* 著者（アイコン＋名前）。クリックでその人の公開プロフィール /u?npub= へ（#272 段階3）。
                  npub にできない時はリンクにせず素の名前のまま（authorHref が null）。 */}
              {(() => {
                const href = authorHref(post.pubkey);
                const inner = (
                  <>
                    <Avatar src={profile?.picture ?? null} name={authorName} className="w-6 h-6" />
                    <span className="min-w-0 truncate font-medium text-ha-ink/80">{authorName}</span>
                  </>
                );
                return href === null ? (
                  <span className="flex min-w-0 items-center gap-2">{inner}</span>
                ) : (
                  <a
                    href={href}
                    aria-label={t("card.author.profile", { name: authorName })}
                    className="flex min-w-0 items-center gap-2 rounded-full hover:text-ha-green-deep transition-colors"
                  >
                    {inner}
                  </a>
                );
              })()}
              <span className="flex shrink-0 items-center gap-3">
                {/* いいね（#117）。X シェアより使用頻度が高いので左に置く。黄色い花アイコン（#116）。 */}
                <span
                  className="inline-flex items-center gap-[5px]"
                  aria-label={t("reaction.likes.aria", { n: likeCount === null ? t("detail.likes.loading") : likeCount })}
                >
                  <Icon name="flower" className="w-4 h-4 text-ha-yellow" />
                  <span className="font-display font-semibold text-ha-ink/70 tabular-nums">
                    {likeCount === null ? "-" : likeCount}
                  </span>
                </span>
                {/* X でシェア（#37）。1パートなら即 intent、複数なら全文／各パートのメニュー。
                    パーマリンクは njump（nevent）で、X 上に写真の OGP プレビューを出す。 */}
                <span className="relative inline-flex">
                  <button
                    type="button"
                    aria-label={t("detail.share.aria")}
                    aria-haspopup={isSplit ? "true" : undefined}
                    aria-expanded={isSplit ? shareOpen : undefined}
                    onClick={() => {
                      if (isSplit) {
                        setShareOpen((v) => !v);
                      } else {
                        openXShare(shareParts[0] ?? "");
                      }
                    }}
                    className="grid place-items-center w-7 h-7 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-ha-ink/5 transition-colors"
                  >
                    <Icon name="x" className="w-4 h-4" />
                  </button>

                  {isSplit && shareOpen && (
                    // role="menu" は付けない＝矢印キー移動やフォーカス移動を実装していないのに
                    // メニューのセマンティクスを名乗らないため（aria-label 付きの単なるボタン列）。
                    // 開閉トグルの aria-haspopup/aria-expanded はポップオーバーの存在を伝える。
                    <div
                      aria-label={t("detail.share.split.aria")}
                      className="glass-strong absolute bottom-full right-0 mb-2 z-20 flex flex-col gap-1 rounded-2xl p-1.5 shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          openXShare(buildXShareWhole(post.caption, [], permalink));
                          setShareOpen(false);
                        }}
                        className="rounded-full px-3 py-1 text-left text-xs font-medium text-ha-ink/80 hover:bg-ha-green hover:text-ha-white transition-colors"
                      >
                        {t("detail.share.whole")}
                      </button>
                      {shareParts.map((part, i) => (
                        <button
                          // 並びは固定（index で安定）。複数パートは本文の分割位置で決まる。
                          key={i}
                          type="button"
                          onClick={() => {
                            openXShare(part);
                            setShareOpen(false);
                          }}
                          className="rounded-full px-3 py-1 text-left text-xs font-medium tabular-nums text-ha-ink/80 hover:bg-ha-green hover:text-ha-white transition-colors"
                        >
                          {i + 1}/{shareParts.length}
                        </button>
                      ))}
                    </div>
                  )}
                </span>

                <time>{relativeTime(post.createdAt, Math.floor(Date.now() / 1000))}</time>
              </span>
            </div>

            {/* 著者の複数サイトリンク（#35 Piece 2）。各人が自分のサイトへ誘導する核。
                フィードカードには出さない（Piece 1 の方針）。サービス判定は services.ts。 */}
            {siteLinks.length > 0 && (
              <ul className="flex flex-wrap items-center gap-2">
                {siteLinks.map((link) => (
                  <li key={link.url}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${link.label}: ${link.url}`}
                      aria-label={link.label}
                      className="glass grid place-items-center w-8 h-8 rounded-full text-ha-ink/70 hover:text-ha-green-deep hover:border-ha-green/50 transition-colors"
                    >
                      <Icon name={link.icon} className="w-4 h-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}

            {/* この人をフィードで「減らす」（#138）。著者ヘッダ直下に置く＝その人を指せる場所。
                ミュートの手前の柔らかい手段。既定は畳む（DilutionControl が自分で開閉）＝常駐させて
                「減らすのが基本」と誤解させない。/me（自分の投稿）では出さない＝自分は減らさない。 */}
            {showDilution && <DilutionControl pubkey={post.pubkey} authorName={authorName} />}
          </div>

          {/* コメント欄（#142）。著者バー/サイトリンクの後・スクロール領域（p-5・親は overflow-y-auto）
              の中に置くので、長いコメント列はモーダル内でスクロールして辿れる。コメントは Nostr の
              リプライ（kind:1・親を e タグ root・@呼びかけなし）として publish/読み取りする。 */}
          <CommentSection postId={post.id} />
        </div>
      </div>
    </div>
  );

  // SSR では document が無い（島はクライアントでのみ開くので通常ここは通らないが防御）。
  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
