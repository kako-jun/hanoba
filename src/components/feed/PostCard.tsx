import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { relativeTime, type FeedPost } from "../../lib/feed/parse.ts";
import { stripHashtags } from "../../lib/nostr/tags.ts";

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
export default function PostCard({ post, index, now, onOpen, onSelectHashtag }: Props) {
  const captionText = stripHashtags(post.caption);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  const tagsRef = useRef<HTMLUListElement>(null);

  // 折りたたみ時に本文/タグが収まりきらず clip されているかを実測してトグルの要否を決める。
  useLayoutEffect(() => {
    if (expanded) return; // 展開中は「閉じる」を出すので判定不要。
    const cap = captionRef.current;
    const tags = tagsRef.current;
    const capOver = cap !== null && cap.scrollHeight > cap.clientHeight + 1;
    const tagsOver = tags !== null && tags.scrollHeight > tags.clientHeight + 1;
    setClipped(capOver || tagsOver);
  }, [captionText, post.hashtags.length, expanded]);

  return (
    <li
      className="ha-rise glass rounded-2xl overflow-hidden"
      style={{ "--i": Math.min(index, 11) } as CSSProperties}
    >
      <article className={`flex flex-col sm:flex-row ${expanded ? "" : "sm:h-56"}`}>
        {post.imageUrl !== null && (
          <button
            type="button"
            onClick={onOpen}
            // caption 空は仕様上起きない（一言必須・DESIGN §1）が、他クライアント投稿への防御。
            aria-label={post.caption === "" ? "写真を拡大" : post.caption}
            // self-start で stretch を切り、展開でカードが伸びても写真は正方形のまま。
            className="group block self-start shrink-0 w-full aspect-square sm:w-56 sm:h-56 sm:aspect-auto overflow-hidden bg-ha-green-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
          >
            <img
              src={post.imageUrl}
              alt={post.caption}
              loading="lazy"
              className="w-full h-full object-cover transition duration-300 group-hover:opacity-90"
            />
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
          <div className="mt-auto flex items-center gap-3 pt-2 shrink-0">
            <time className="text-xs text-ha-ink/55">{relativeTime(post.createdAt, now)}</time>
            {(clipped || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                aria-expanded={expanded}
                className="text-sm font-medium text-ha-green hover:text-ha-green-deep transition-colors"
              >
                {expanded ? "閉じる" : "続きを読む"}
              </button>
            )}
          </div>
        </div>

        {/* タグは本文の右の空きスペースに縦並び。折りたたみ時はカード高さに収め clip。 */}
        {post.hashtags.length > 0 && (
          <ul
            ref={tagsRef}
            className={`flex flex-wrap sm:flex-col items-start content-start gap-2 px-4 pb-4 sm:p-5 sm:pl-0 shrink-0 sm:max-w-[11rem] ${
              expanded ? "" : "overflow-hidden"
            }`}
          >
            {post.hashtags.map((tag) => (
              <li key={tag} className="min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() => onSelectHashtag(tag)}
                  className="block max-w-full truncate rounded-full bg-ha-green-soft text-ha-green-deep px-3 py-1 text-sm font-medium hover:bg-ha-green hover:text-ha-white transition-colors"
                >
                  #{tag}
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>
    </li>
  );
}
