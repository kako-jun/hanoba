import { type CSSProperties, type TouchEvent as ReactTouchEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { authorHref, relativeTime, shortNpub, type FeedPost, type Profile } from "../../lib/feed/parse.ts";
import { stripHashtags } from "../../lib/nostr/tags.ts";
import { resolveFuda, type FudaIndex } from "../../lib/plants/fuda.ts";
import { localizeHashtag } from "../../lib/plants/plant-i18n.ts";
import { shotDateRange, SHOT_DATE_RANGE_SEP } from "../../lib/feed/shotDate.ts";
import {
  nextPhotoIndex,
  prevPhotoIndex,
  swipeDirection,
  swipeProgress,
  swipeToBlur,
} from "../../lib/feed/carousel.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";
import Icon from "../ui/Icon.tsx";
import ProgressiveImage from "../ui/ProgressiveImage.tsx";
import Avatar from "./Avatar.tsx";
import FudaList from "./FudaList.tsx";

interface Props {
  post: FeedPost;
  /** staggered reveal の遅延係数（先頭ほど早い）。 */
  index: number;
  /** 相対時刻の基準（秒）。親で1回計算して配る。 */
  now: number;
  /** 写真タップで拡大（PostDetail モーダルを開く）。写真から開く時は現在の写真 index を渡す。 */
  onOpen: (photoIndex?: number) => void;
  /** タグクリック（クライアント側絞り込み/再検索）。 */
  onSelectHashtag: (tag: string) => void;
  /** 著者プロフィール（#35・未取得なら null＝npub フォールバック表示）。 */
  profile?: Profile | null;
  /**
   * 札解決の索引（#239/#257・植物札用）。`PostGrid` がグリッド単位で1回 `buildVarietyIndex` した
   * ものを配る（カードごとに catalog 全走査しない）。null は未ロード＝札を出さない（グレースフル）。
   */
  fudaIndex?: FudaIndex | null;
  /**
   * いいね数（#276・kind:7 集計）。グリッド単位でバッチ取得した値を親が配る。
   * undefined は未ロード。**カードは 0 / undefined を出さない**（1 以上のときだけ控えめに添える）。
   * ※ 投稿詳細モーダル（PostDetail）は 0 でも出す＝非対称（カードは「ある時だけ」）。
   */
  reactionCount?: number;
  /** コメント数（#276・kind:1 リプライ集計）。reactionCount と同じく 0/undefined はカードでは出さない。 */
  commentCount?: number;
}

/**
 * 「読めるフィード」の1カード（#34/#50）。
 *
 * 売り＝本文を切らず読める・1クリック不要。普通の投稿は写真の正方形カードに全文が収まる。
 * デスクトップはカード高さを写真の正方形（sm:h-56）に固定し、本文列・タグ列を
 * その高さに収める（はみ出しは overflow-hidden で clip）。これで写真の下に隙間が出ない。
 *
 * 本文かタグが clip された時だけ「続きを読む」を出し、押すとカード全体を展開して
 * 全文＋全タグを表示する（フェードは使わない＝ガラスの透けを潰さない）。
 *
 * 本文テキストからは #タグ を除去（stripHashtags）し、タグは本文の右の縦列に出す。
 */
export default function PostCard({
  post,
  index,
  now,
  onOpen,
  onSelectHashtag,
  profile,
  fudaIndex,
  reactionCount,
  commentCount,
}: Props) {
  const locale = useLocale();
  const t = useT(locale);
  const captionText = stripHashtags(post.caption);
  const photoCount = post.imageUrls.length;
  const hasMultiplePhotos = photoCount > 1;
  // 撮影期間（#324・kako-jun A案）。写真ごとの撮影日があれば表紙に「2024-06-01〜2024-06-22」を出す
  // ＝「1つの被写体の1ヶ月を振り返る」投稿が一目で分かる。無ければ null（出さない）。全言語 ISO 固定（#347）。
  const dateRange = shotDateRange(post.photoShotDates ?? []);
  // 著者名は取得できればユーザー名、未取得なら npub 短縮（#35）。
  const authorName = profile?.name ?? shortNpub(post.pubkey);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [swipeBlur, setSwipeBlur] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextPhotoClickRef = useRef(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const currentImageUrl = post.imageUrls[photoIndex] ?? post.imageUrl ?? post.imageUrls[0] ?? null;

  // 投稿の植物札（#182/#23）。索引未ロード時は空＝出さない。タグ列の上（右列の最上部）に出す（#239）。
  // 索引は PostGrid がグリッド単位で1回作って配る（#257）。resolveFuda は純粋（hashtags は post 固定）。
  const fuda = useMemo(() => (fudaIndex ? resolveFuda(post.hashtags, fudaIndex) : []), [post.hashtags, fudaIndex]);

  // 折りたたみ時に本文/右列（札＋タグ）が収まりきらず clip されているかを実測してトグルの要否を決める。
  useLayoutEffect(() => {
    if (expanded) return; // 展開中は「閉じる」を出すので判定不要。
    const cap = captionRef.current;
    const col = rightColRef.current;
    const capOver = cap !== null && cap.scrollHeight > cap.clientHeight + 1;
    const colOver = col !== null && col.scrollHeight > col.clientHeight + 1;
    setClipped(capOver || colOver);
  }, [captionText, post.hashtags.length, fuda.length, expanded]);

  // 投稿が差し替わった時は表紙に戻す。フィードの再利用描画で前投稿の index を持ち越さない。
  useEffect(() => {
    setPhotoIndex(0);
    setSwipeBlur(0);
    touchStartRef.current = null;
    suppressNextPhotoClickRef.current = false;
  }, [post.id, photoCount]);

  function onTouchStart(e: ReactTouchEvent) {
    if (!hasMultiplePhotos) return;
    const t = e.touches[0];
    if (t === undefined) return;
    suppressNextPhotoClickRef.current = false;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchMove(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    if (start === null || !hasMultiplePhotos) return;
    if (prefersReducedMotion()) return;
    const t = e.touches[0];
    if (t === undefined) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) <= Math.abs(dy)) {
      setSwipeBlur(0);
      return;
    }
    const next = Math.round(swipeToBlur(swipeProgress(dx)));
    setSwipeBlur((prev) => (prev === next ? prev : next));
  }

  function onTouchEnd(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    setSwipeBlur(0);
    if (start === null || !hasMultiplePhotos) return;
    const t = e.changedTouches[0];
    if (t === undefined) return;
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
    if (dir === "next") {
      suppressNextPhotoClickRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setPhotoIndex((i) => nextPhotoIndex(i, photoCount));
    } else if (dir === "prev") {
      suppressNextPhotoClickRef.current = true;
      e.preventDefault();
      e.stopPropagation();
      setPhotoIndex((i) => prevPhotoIndex(i, photoCount));
    }
  }

  return (
    <li
      className="ha-rise glass rounded-xl overflow-hidden"
      style={{ "--i": Math.min(index, 11) } as CSSProperties}
    >
      {/* カードの非インタラクティブ領域はどこを押しても拡大（#101）。リンク・タグ・続きを読む等の
          個別操作は stopPropagation で従来動作を維持。写真ボタンはキーボード/SR 用の主導線として残す。 */}
      <article
        onClick={() => onOpen(photoIndex)}
        className={`flex flex-col sm:flex-row cursor-pointer ${expanded ? "" : "sm:h-56 lg:h-72"}`}
      >
        {currentImageUrl !== null && (
          <div
            // self-start で stretch を切り、展開でカードが伸びても写真は正方形のまま。
            className="group/photo relative block self-start shrink-0 w-full aspect-square sm:w-56 sm:h-56 lg:w-72 lg:h-72 sm:aspect-auto overflow-hidden bg-ha-green-soft"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClickCapture={(e) => {
              if (!suppressNextPhotoClickRef.current) return;
              suppressNextPhotoClickRef.current = false;
              e.stopPropagation();
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (suppressNextPhotoClickRef.current) {
                  suppressNextPhotoClickRef.current = false;
                  return;
                }
                onOpen(photoIndex);
              }}
              // caption 空は仕様上起きない（一言必須・DESIGN §1）が、他クライアント投稿への防御。
              aria-label={post.caption === "" ? t("card.photo.zoom") : post.caption}
              className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
            >
              <div
                className="h-full w-full"
                style={{
                  filter: swipeBlur > 0 ? `blur(${swipeBlur}px)` : undefined,
                  transition: swipeBlur > 0 ? "none" : "filter 0.25s ease",
                }}
              >
                <ProgressiveImage
                  key={photoIndex}
                  src={currentImageUrl}
                  alt={hasMultiplePhotos ? t("detail.photo.alt", { caption: post.caption, n: photoIndex + 1 }) : post.caption}
                  className="w-full h-full select-none object-cover"
                  draggable={false}
                />
              </div>
            </button>
            {hasMultiplePhotos && (
              <>
                <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-base font-bold text-ha-white backdrop-blur-sm">
                  {photoIndex + 1}/{photoCount}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex((i) => prevPhotoIndex(i, photoCount));
                  }}
                  aria-label={t("detail.photo.prev")}
                  className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-ha-white opacity-0 backdrop-blur-md transition-all hover:bg-ha-green focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ha-green group-hover/photo:opacity-100 group-focus-within/photo:opacity-100"
                >
                  <Icon name="chevron" className="h-5 w-5 rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex((i) => nextPhotoIndex(i, photoCount));
                  }}
                  aria-label={t("detail.photo.next")}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-ha-white opacity-0 backdrop-blur-md transition-all hover:bg-ha-green focus:outline-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ha-green group-hover/photo:opacity-100 group-focus-within/photo:opacity-100"
                >
                  <Icon name="chevron" className="h-5 w-5 -rotate-90" />
                </button>
              </>
            )}
            {/* 撮影期間（#324・A案）。表紙**左下**に控えめに（#375・写真らしいスタンプ位置＝拡大の
                オーバーレイ撮影日と左下で揃える。写真枚数バッジは右上のまま）。レンジ＝この投稿が
                「ある期間の振り返り」だと一目で示す。撮影日が無ければ出さない。長い範囲は下アンカーから
                上へ伸びて折り返す。 */}
            {dateRange !== null && (
              <span className="absolute left-2 bottom-2 inline-flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-y-0.5 rounded-2xl bg-black/55 px-2.5 py-1 text-xs font-medium text-ha-white backdrop-blur-sm">
                {/* gap-x は外し日付2片を flush（〜の左だけ空く件＝flex gap 由来を解消・#406）。
                    アイコンと範囲の間隔だけ mr-1 で残す。改行時の縦間隔 gap-y-0.5 と flex-wrap は維持。 */}
                <Icon name="camera" className="h-3 w-3 shrink-0 mr-1" />
                {/* レンジが長い時は セパレータ(〜)の位置だけで改行（各 YYYY-MM-DD は whitespace-nowrap で途中で割らない・
                    #347 kako-jun「長くなったら改行すればいい」）。producer と同じ SHOT_DATE_RANGE_SEP で split/再挿入し文字のドリフトを防ぐ（#397）。 */}
                {dateRange.split(SHOT_DATE_RANGE_SEP).map((part, i) => (
                  <span key={i} className="whitespace-nowrap">
                    {i > 0 ? SHOT_DATE_RANGE_SEP : ""}
                    {part}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}

        {/* 本文列。折りたたみ時はカード高さ（写真の正方形）に収め、はみ出しは clip。 */}
        <div className="flex flex-col min-w-0 flex-1 overflow-hidden p-4 sm:p-5">
          {captionText !== "" && (
            <p
              ref={captionRef}
              className={`text-[15px] leading-relaxed text-ha-ink whitespace-pre-wrap break-words [word-break:auto-phrase] ${
                expanded ? "" : "min-h-0 flex-1 overflow-hidden max-h-72 sm:max-h-none"
              }`}
            >
              {captionText}
            </p>
          )}
          {/* 著者（アイコン＋名前）と時刻（#35）。著者はその人の公開プロフィール /u?npub= へリンク（#272 段階3）。
              カード全体が拡大モーダルを開く（article onClick）ので、リンククリックは stopPropagation で
              遷移だけにする（タグ/続きを読むと同じ作法）。npub にできない時は素の名前のまま。 */}
          <div className="mt-auto flex items-center gap-2 pt-2 shrink-0 text-xs text-ha-ink/55">
            {(() => {
              const href = authorHref(post.pubkey);
              const inner = (
                <>
                  <Avatar src={profile?.picture ?? null} name={authorName} className="w-5 h-5" />
                  <span className="min-w-0 truncate font-medium text-ha-ink/75">{authorName}</span>
                </>
              );
              return href === null ? (
                <span className="flex min-w-0 items-center gap-2">{inner}</span>
              ) : (
                <a
                  href={href}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t("card.author.profile", { name: authorName })}
                  className="flex min-w-0 items-center gap-2 hover:text-ha-green-deep transition-colors"
                >
                  {inner}
                </a>
              );
            })()}
            <span className="text-ha-ink/30">·</span>
            <time className="shrink-0">{relativeTime(post.createdAt, now, locale)}</time>
            {/* いいね数・コメント数（#276）。**カードは 1 以上のときだけ控えめに添える**
                （0 / 未ロード＝undefined はそのカウンタを出さない＝要素ごと描画しない）。
                配色・アイコンは PostDetail と揃える（いいね＝黄色い花・コメント＝吹き出し・既存トークン）。 */}
            {reactionCount !== undefined && reactionCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-[3px]" aria-label={t("reaction.likes.aria", { n: reactionCount })}>
                <Icon name="flower" className="h-3.5 w-3.5 text-ha-yellow" />
                <span className="tabular-nums">{reactionCount}</span>
              </span>
            )}
            {commentCount !== undefined && commentCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-[3px]" aria-label={t("reaction.comments.aria", { n: commentCount })}>
                <Icon name="chat" className="h-3.5 w-3.5" />
                <span className="tabular-nums">{commentCount}</span>
              </span>
            )}
            {(clipped || expanded) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                aria-expanded={expanded}
                className="ml-auto shrink-0 text-sm font-medium text-ha-green hover:text-ha-green-deep transition-colors"
              >
                {expanded ? t("common.close") : t("card.readMore")}
              </button>
            )}
          </div>
        </div>

        {/* 本文の右の空きスペースの縦列。最上部に植物札（その品種の discover 絞り込みリンク・#239）、
            その下にタグ。モバイルは横に wrap、デスクトップは縦並び。折りたたみ時はカード高さに収め clip
            （多すぎる時は2列に折り返さず下を見切る・#54。clip 時は「続きを読む」で展開）。 */}
        {(fuda.length > 0 || post.hashtags.length > 0) && (
          <div
            ref={rightColRef}
            className={`flex flex-col items-start gap-2 px-4 pb-4 sm:p-5 sm:pl-0 shrink-0 sm:max-w-[11rem] ${
              expanded ? "" : "overflow-hidden"
            }`}
          >
            {/* 植物札（#239・タグの上＝右列の最上部）。クリックでその品種の discover 絞り込みへ。 */}
            <FudaList fuda={fuda} />
            {post.hashtags.length > 0 && (
              <ul className="flex flex-wrap sm:flex-col sm:flex-nowrap items-start gap-2">
                {post.hashtags.map((tag) => (
                  <li key={tag} className="min-w-0 max-w-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectHashtag(tag);
                      }}
                      className="block max-w-full truncate rounded-full bg-ha-green-soft text-ha-green-deep px-3 py-1 text-sm font-medium hover:bg-ha-green hover:text-ha-white transition-colors"
                    >
                      {/* 表示だけ閲覧言語に訳す（カテゴリ/属＝#460）。実タグ（key・onSelectHashtag）は ja 正準で不変。 */}
                      #{fudaIndex ? localizeHashtag(tag, locale, fudaIndex.hashtagLoc) : tag}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </article>
    </li>
  );
}
