import { useLayoutEffect, useRef, useState } from "react";

// ソフト上限（px）。leading-relaxed・15px で約12行ぶん。
// 普通の投稿（ひとこと〜十数行）は全文表示＝1クリック不要を維持し、
// これを超える「ものすごい長文」だけ畳む（#40）。
const CLAMP_MAX_PX = 288;

interface Props {
  caption: string;
}

/**
 * フィードの本文（#34 の全文表示 ＋ #40 の長文ソフト上限）。
 *
 * 売り＝本文を切らず読める・1クリック不要。よって既定は全文表示。
 * ただし栽培ログ等の極端な長文は1カードがフィードを占拠するため、
 * 自然高が上限を超えたときだけ clamp（max-height + overflow:hidden）し、
 * 下端フェード＋「続きを読む」を出す。展開は同カード内（ページ遷移しない）。
 *
 * 上限超過の判定は描画後に scrollHeight を実測する（client 島なので安全）。
 */
export default function PostCaption({ caption }: Props) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    // clamp を一旦外した自然高で判定したいが、clamp は overflowing 由来なので
    // 初回は未 clamp（overflowing=false）。以降は scrollHeight が自然高を返す。
    setOverflowing(el.scrollHeight > CLAMP_MAX_PX + 1);
  }, [caption]);

  const clamped = overflowing && !expanded;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <p
          ref={ref}
          className="text-[15px] leading-relaxed text-ha-ink whitespace-pre-wrap break-words [word-break:auto-phrase]"
          style={clamped ? { maxHeight: CLAMP_MAX_PX, overflow: "hidden" } : undefined}
        >
          {caption}
        </p>
        {clamped && (
          // 下端フェード（畳んでいる合図）。カード表面（暗グラス）に馴染むよう ha-base へ。
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-ha-base to-transparent"
          />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start text-sm font-medium text-ha-green hover:text-ha-green-deep transition-colors"
        >
          {expanded ? "閉じる" : "続きを読む"}
        </button>
      )}
    </div>
  );
}
