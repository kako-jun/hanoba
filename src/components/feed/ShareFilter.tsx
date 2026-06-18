import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { openXShare } from "../../lib/share/x-share.ts";

interface Props {
  /** 現在の絞り込みが既定でない（何か絞っている）か。false の間は何も出さない。 */
  active: boolean;
  /** 共有テキストに載せる現在フィルタの要約（`filterSummary`・例「トマト・実生 / @kako」）。 */
  summary: string;
}

/**
 * 現在の絞り込みを共有する導線（#139 段階2・discover 上部）。
 *
 * 多軸フィルタは URL（canonical・#131）に全状態が載るので、**現在の URL をそのまま渡せば**
 * 相手も同じ絞り込みのタイムラインを開ける（ブックマーク・共有のための deep-link）。
 * 既定表示（何も絞っていない）では出さない＝「すべて」をわざわざ共有しない。
 *
 * - **リンクをコピー**: `window.location.href` をクリップボードへ（ProfileEditor #213 と同じ作法＝
 *   成功で「コピーしました」を約2秒・失敗は黙る）。
 * - **X でシェア**: #37 の X シェア基盤 `openXShare`（x-share.ts・twitter.com intent・noopener）を
 *   再利用し、フィルタ要約＋現在 URL を本文に畳んで新規タブで開く。
 *
 * 状態（filter）は持たず、表示判定と URL の受け渡しだけを担う（§3 単一責務）。window 参照は
 * クリックハンドラ内（クライアント）のみ＝SSR 安全。
 */
export default function ShareFilter({ active, summary }: Props) {
  const [copied, setCopied] = useState(false);
  // アンマウント後に setState しないためのガード（コピー後の遅延リセット・ProfileEditor 準拠）。
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  if (!active) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      if (!aliveRef.current) return;
      setCopied(true);
      setTimeout(() => {
        if (aliveRef.current) setCopied(false);
      }, 2000);
    } catch {
      // コピー失敗は黙って何もしない（URL はアドレスバーから手動コピーできる）。
    }
  }

  function shareX() {
    // #37 の X シェア基盤（x-share.ts）を再利用。intent は twitter.com・noopener で開く。
    // 多軸状態は canonical URL に全部載るので、要約＋現在 URL を本文に畳んで渡す（t.co がリンク化＝
    // 相手も同じ絞り込みを開ける）。
    openXShare(`hanoba で「${summary}」の植物\n${window.location.href}`);
  }

  const btnClass =
    "inline-flex items-center gap-1.5 rounded-full glass px-3 py-1.5 text-sm font-medium text-ha-green-deep hover:border-ha-green/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-ha-ink/50">この絞り込みを共有:</span>
      <button type="button" onClick={copyLink} className={btnClass}>
        <Icon name="link" className="h-3.5 w-3.5" />
        リンクをコピー
      </button>
      <button type="button" onClick={shareX} className={btnClass} aria-label="X でシェアする">
        <Icon name="x" className="h-3.5 w-3.5" />
        シェア
      </button>
      {copied && <span className="text-xs text-ha-green-deep">コピーしました</span>}
    </div>
  );
}
