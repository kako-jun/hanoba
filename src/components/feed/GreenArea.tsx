import { useEffect, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { estimateCumulativeGreen, greenRatio, pickSampleIndices } from "../../lib/feed/green.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 「緑の総面積」＝自分が街に足した緑（#310・脱ゲーム化の称号置換）。#344 で**全投稿の全写真**の緑量を
 * 累計し、「**緑100%の写真換算 ○○枚分**」という1つの数値で出す（先頭写真限定・直近60件上限・草グリッド・
 * 濃淡凡例はすべて廃止）。#387 で、投稿の多い市民（例 1000 枚）でも破綻しないよう、**全数を一斉に
 * DL/デコードする**のをやめ、**代表サンプル（上限 GREEN_SAMPLE_CAP 枚を均等抽出）を読んで全数へ外挿する
 * 概算**に変えた（kako-jun 合意・厳密でなくてよい）。称号（エゴ）でなく貢献を静かに。
 *
 * backendless＝公開投稿の写真を数えるだけ・新たな身バレ無し。画素読みは `crossOrigin=anonymous` の
 * canvas（hanoba 自身は nostr.build=CORS 反射ホストにアップロード＝読める）。他クライアント由来の
 * 非CORS画像は tainted で `getImageData` が throw するので **try/catch でスキップ**し、読み取れた写真数を
 * 併記する（概算・グレースフル）。純粋な集計/抽出は `lib/feed/green.ts`（テスト済み）。
 */

/** 縮小描画の一辺（px）。緑割合の概算には十分。 */
const SAMPLE_SIZE = 24;

/**
 * 緑量サンプリングの上限枚数（#387）。これを超える写真は均等抽出して全数へ外挿する。
 * 1000 枚でも DL/デコードは一定コスト（最大この枚数）で済み、概算としては十分。
 */
const GREEN_SAMPLE_CAP = 120;

/** 同時にデコードする最大枚数（#387・ネットワーク殺到/メモリ急騰を避ける）。 */
const GREEN_CONCURRENCY = 6;

/**
 * URL 単位の緑割合キャッシュ（モジュールスコープ・セッション内）。再描画/再マウントで同じ写真を
 * 読み直さない。リロードで消える（永続化不要・概算用途）。
 */
const greenCache = new Map<string, number | null>();

/**
 * `items` を最大 `limit` 並列で `fn` に通し、**入力順を保った**結果配列を返す小ヘルパ（#387）。
 * `Promise.all(全部)` の一斉実行を避け、同時実行数を有界にする。
 */
async function mapWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  };
  const workers = Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** 画像を縮小描画して緑割合を返す（tainted/失敗は null＝読めない写真として除外）。browser 専用（jsdom 不可）。 */
async function decodeGreenRatio(url: string): Promise<number | null> {
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

/** URL キャッシュ越しに緑割合を返す（#387・同じ写真を再デコードしない）。 */
async function sampleGreenRatio(url: string): Promise<number | null> {
  const cached = greenCache.get(url);
  if (cached !== undefined) return cached;
  const ratio = await decodeGreenRatio(url);
  // 成功（非null）だけキャッシュする（#387 review）。null は一時失敗（ネットワーク瞬断・5xx）も含むので、
  // セッション中ずっと「読めない」に固定せず次の再計測で再試行できるようにする（恒久的な非CORSは稀＝
  // /me・/u は自分の t:hanoba 投稿＝nostr.build CORS 可読。再デコードしても結果は同じで実害小）。
  if (ratio !== null) greenCache.set(url, ratio);
  return ratio;
}

export default function GreenArea({ posts, subject }: { posts: FeedPost[]; subject: string }) {
  const t = useT(useLocale());
  // #344: 全投稿の全写真が対象（先頭写真限定・60件上限を廃止）。urls.length が全数＝外挿の母数。
  const urls = posts.flatMap((p) => p.imageUrls);
  // sampled[i] = 抽出した写真の緑割合（null=非CORS/失敗）。null（state）=未サンプリング（計測中）。
  const [sampled, setSampled] = useState<(number | null)[] | null>(null);

  // 対象の写真 URL 列が変わったときだけ再サンプリングする（id 列＋枚数で安定キー）。
  const key = `${posts.map((p) => p.id).join(",")}|${urls.length}`;
  useEffect(() => {
    let alive = true;
    setSampled(null);
    // #387: 全数を一斉に読まず、上限 GREEN_SAMPLE_CAP 枚を均等抽出し、同時実行を有界にして読む。
    const idx = pickSampleIndices(urls.length, GREEN_SAMPLE_CAP);
    const sampleUrls = idx.map((i) => urls[i]!);
    void mapWithConcurrency(sampleUrls, GREEN_CONCURRENCY, (u) => sampleGreenRatio(u)).then((rs) => {
      if (alive) setSampled(rs);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (urls.length === 0) return null; // 写真ゼロは節ごと出さない。
  // #387: 代表サンプルから全数（urls.length）へ外挿した概算。stats.sampled=true なら外挿（概算表示）。
  const stats = sampled === null ? null : estimateCumulativeGreen(sampled, urls.length);
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
          <span className="ml-2 text-xs text-ha-ink/45">
            {/* 抽出した（概算）ときは「約N枚」と明示し、外挿値が嘘にならないようにする（#387）。 */}
            {stats.sampled
              ? t("green.readableApprox", { readable: stats.readable })
              : t("green.readable", { readable: stats.readable })}
          </span>
        </p>
      )}
    </div>
  );
}
