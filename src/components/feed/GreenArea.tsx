import { useEffect, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { greenLevel, greenRatio } from "../../lib/feed/green.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 「緑の総面積」＝自分が街に足した緑（#310・脱ゲーム化の称号置換・kako-jun 決定 GitHub の草グリッド）。
 * 各投稿の先頭写真の**緑画素割合**を集計し、1マス=1投稿・濃淡=その写真の緑割合で並べる
 * （数字でなく面積感で見せる）。称号（エゴ）でなく「街に足した緑」を静かに出す。
 *
 * backendless＝公開投稿の写真を数えるだけ・新たな身バレ無し。画素読みは `crossOrigin=anonymous` の
 * canvas（hanoba 自身は nostr.build=CORS 反射ホストにアップロード＝読める）。他クライアント由来の
 * 非CORS画像は tainted で `getImageData` が throw するので **try/catch でスキップ**（概算・グレースフル）。
 * 純粋な画素判定は `lib/feed/green.ts`（テスト済み）。ここは取得・描画・サンプリングだけを担う。
 */

/** サンプリングする投稿数の上限（重くしない・概算）。超過は「直近N件」と明記＝silent cap にしない。 */
const GREEN_GRID_CAP = 60;
/** 縮小描画の一辺（px）。緑割合の概算には十分。 */
const SAMPLE_SIZE = 24;

/** 草マスの濃淡（レベル 0=空き → 4=緑が濃い・GitHub の草と同じ 5 段階）。暗テーマなので空きは白うっすら。 */
const LEVEL_BG = ["bg-white/5", "bg-ha-green/25", "bg-ha-green/45", "bg-ha-green/70", "bg-ha-green"] as const;

/** 画像を縮小描画して緑割合を返す（tainted/失敗は null＝スキップ）。browser 専用（jsdom 不可）。 */
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
  // 写真のある投稿の先頭画像を、直近 CAP 件までサンプリング（新着順前提・重くしない）。
  const withPhoto = posts.filter((p) => p.imageUrls.length > 0);
  const targets = withPhoto.slice(0, GREEN_GRID_CAP);
  const capped = withPhoto.length > GREEN_GRID_CAP;
  // ratios[i] = targets[i] の緑割合（null=非CORS/失敗・undefined=未サンプリング）。
  const [ratios, setRatios] = useState<(number | null)[] | null>(null);

  const key = targets.map((p) => p.id).join(",");
  useEffect(() => {
    let alive = true;
    setRatios(null);
    void Promise.all(targets.map((p) => sampleGreenRatio(p.imageUrls[0]!))).then((rs) => {
      if (alive) setRatios(rs);
    });
    return () => {
      alive = false;
    };
    // 対象が変わったとき（投稿 id 列）だけ再サンプリングする。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (targets.length === 0) return null; // 写真ゼロは節ごと出さない。
  // サンプリング完了かつ1枚も読めなかった（全部非CORS）なら空グリッドを出さない（グレースフル）。
  if (ratios !== null && ratios.every((r) => r === null)) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ha-ink/70">
        {t("green.heading", { subject })}{" "}
        <span className="text-xs font-normal text-ha-ink/45">{t("green.heading.note")}</span>
        {capped && <span className="ml-1 text-xs text-ha-ink/40">{t("green.capped", { n: GREEN_GRID_CAP })}</span>}
      </p>
      {/* 草グリッド。1マス=1投稿・濃淡=緑割合。装飾的なので aria-hidden（意味は上のラベル＋凡例が担う）。 */}
      <div className="flex flex-wrap gap-1" aria-hidden>
        {targets.map((p, i) => {
          const r = ratios?.[i] ?? null;
          const level = r === null ? 0 : greenLevel(r);
          return <span key={p.id} className={`h-3 w-3 rounded-[2px] ${LEVEL_BG[level]}`} />;
        })}
      </div>
      {/* 濃淡の凡例（緑が少ない → 多い）。何が濃さを表すか一目で分かるように（kako-jun「さっぱりわからない」）。 */}
      <span className="flex items-center gap-1 text-[10px] text-ha-ink/45" aria-hidden>
        {t("green.legend.low")}
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className={`h-3 w-3 rounded-[2px] ${bg}`} />
        ))}
        {t("green.legend.high")}
      </span>
    </div>
  );
}
