import { type CSSProperties, useLayoutEffect, useMemo, useRef, useState } from "react";
import { authorHref, relativeTime, shortNpub, type FeedPost, type Profile } from "../../lib/feed/parse.ts";
import { stripHashtags } from "../../lib/nostr/tags.ts";
import { resolveFuda, type FudaIndex } from "../../lib/plants/fuda.ts";
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
  /** 写真タップで拡大（PostDetail モーダルを開く）。 */
  onOpen: () => void;
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
  // 著者名は取得できればユーザー名、未取得なら npub 短縮（#35）。
  const authorName = profile?.name ?? shortNpub(post.pubkey);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);

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

  return (
    <li
      className="ha-rise glass rounded-xl overflow-hidden"
      style={{ "--i": Math.min(index, 11) } as CSSProperties}
    >
      {/* カードの非インタラクティブ領域はどこを押しても拡大（#101）。リンク・タグ・続きを読む等の
          個別操作は stopPropagation で従来動作を維持。写真ボタンはキーボード/SR 用の主導線として残す。 */}
      <article
        onClick={onOpen}
        className={`flex flex-col sm:flex-row cursor-pointer ${expanded ? "" : "sm:h-56 lg:h-72"}`}
      >
        {post.imageUrl !== null && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            // caption 空は仕様上起きない（一言必須・DESIGN §1）が、他クライアント投稿への防御。
            aria-label={post.caption === "" ? t("card.photo.zoom") : post.caption}
            // self-start で stretch を切り、展開でカードが伸びても写真は正方形のまま。
            className="relative block self-start shrink-0 w-full aspect-square sm:w-56 sm:h-56 lg:w-72 lg:h-72 sm:aspect-auto overflow-hidden bg-ha-green-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
          >
            <ProgressiveImage
              src={post.imageUrl}
              alt={post.caption}
              className="w-full h-full object-cover"
            />
            {photoCount > 1 && (
              <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-base font-bold text-ha-white backdrop-blur-sm">
                {t("card.photos.count", { n: photoCount })}
              </span>
            )}
          </button>
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
                      #{tag}
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
