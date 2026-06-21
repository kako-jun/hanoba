import { useEffect, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { cumulativeGreen, greenRatio } from "../../lib/feed/green.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 「緑の総面積」＝自分が街に足した緑（#310・脱ゲーム化の称号置換）。#344 で**全投稿の全写真**の緑量を
 * 累計し、「**緑100%の写真換算 ○○枚分**」という1つの数値で出す（先頭写真限定・直近60件上限・草グリッド・
 * 濃淡凡例はすべて廃止＝「今まで街に足した緑の累計」を素直に表す）。称号（エゴ）でなく貢献を静かに。
 *
 * backendless＝公開投稿の写真を数えるだけ・新たな身バレ無し。画素読みは `crossOrigin=anonymous` の
 * canvas（hanoba 自身は nostr.build=CORS 反射ホストにアップロード＝読める）。他クライアント由来の
 * 非CORS画像は tainted で `getImageData` が throw するので **try/catch でスキップ**し、読み取れた写真数を
 * 併記する（概算・グレースフル）。純粋な集計は `lib/feed/green.ts`（テスト済み）。
 */

/** 縮小描画の一辺（px）。緑割合の概算には十分。 */
const SAMPLE_SIZE = 24;

/** 画像を縮小描画して緑割合を返す（tainted/失敗は null＝読めない写真として除外）。browser 専用（jsdom 不可）。 */
async function sampleGreenRatio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d");
        if (ctx === null) return resolve(null);
        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        // 非CORSホストの画像は canvas を汚染し getImageData が throw する → スキップ。
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        resolve(greenRatio(data));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function GreenArea({ posts, subject }: { posts: FeedPost[]; subject: string }) {
  const t = useT(useLocale());
  // #344: 全投稿の全写真を対象（先頭写真限定・60件上限を廃止＝今まで街に足した緑の累計）。
  const urls = posts.flatMap((p) => p.imageUrls);
  // ratios[i] = urls[i] の緑割合（null=非CORS/失敗）。ratios 自体が null=未サンプリング（計測中）。
  const [ratios, setRatios] = useState<(number | null)[] | null>(null);

  // 対象の写真 URL 列が変わったときだけ再サンプリングする（id 列＋枚数で安定キー）。
  const key = `${posts.map((p) => p.id).join(",")}|${urls.length}`;
  useEffect(() => {
    let alive = true;
    setRatios(null);
    void Promise.all(urls.map((u) => sampleGreenRatio(u))).then((rs) => {
      if (alive) setRatios(rs);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (urls.length === 0) return null; // 写真ゼロは節ごと出さない。
  const stats = ratios === null ? null : cumulativeGreen(ratios);
  // 計測完了かつ1枚も読めなかった（全部非CORS）なら出さない（グレースフル）。
  if (stats !== null && stats.readable === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-medium text-ha-ink/70">{t("green.heading", { subject })}</p>
      {stats === null ? (
        <p className="text-xs text-ha-ink/40">{t("green.measuring")}</p>
      ) : (
        <p className="text-sm text-ha-ink/80">
          <span className="font-semibold tabular-nums text-ha-green-deep">
            {t("green.cumulative", { equivalent: stats.equivalent.toFixed(1) })}
          </span>
          <span className="ml-2 text-xs text-ha-ink/45">{t("green.readable", { readable: stats.readable })}</span>
        </p>
      )}
    </div>
  );
}
