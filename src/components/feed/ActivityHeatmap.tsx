import type { FeedPost } from "../../lib/feed/parse.ts";
import { activityHeatmap, activityLevel, streaks } from "../../lib/feed/activity.ts";

/**
 * 活動の草（#272 段階4・脱ゲーム化）。**いつ・どれだけ投稿したか**を GitHub 風の日別ヒートマップ
 * （週列×7曜日・濃淡=その日の投稿数）と連続記録で静かに見せる。#310 の緑グリッド（緑の貢献量・
 * per-post）とは別軸で補完的（こちらは投稿の頻度/継続）。バッジ/演出は付けない＝事実の可視化だけ。
 *
 * backendless＝t:hanoba 投稿のクライアント集計。集計は純関数 `lib/feed/activity.ts`（鼓門 JST・テスト済み）。
 */

/** 草マスの濃淡（0=投稿なし → 4=濃い・#310 GreenArea と同じ 5 段階で世界観を揃える）。 */
const LEVEL_BG = ["bg-white/5", "bg-ha-green/25", "bg-ha-green/45", "bg-ha-green/70", "bg-ha-green"] as const;
const WEEKS = 13;

export default function ActivityHeatmap({ posts }: { posts: FeedPost[] }) {
  if (posts.length === 0) return null;
  // 暦日バケットなので秒未満のズレは無関係＝描画時点の now でよい（純関数に渡す）。
  const now = Math.floor(Date.now() / 1000);
  const grid = activityHeatmap(posts, now, WEEKS);
  const s = streaks(posts, now);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ha-ink/70">活動の草</p>
      {/* 週列×7曜日のヒートマップ。装飾的なので aria-hidden（意味は下の連続記録テキストが担う）。 */}
      <div className="flex gap-0.5 overflow-x-auto" aria-hidden>
        {grid.map((col, w) => (
          <div key={w} className="flex shrink-0 flex-col gap-0.5">
            {col.map((cell, r) => (
              <span
                key={r}
                className={`h-2.5 w-2.5 rounded-[1px] ${cell.day === null ? "bg-transparent" : LEVEL_BG[activityLevel(cell.count)]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-ha-ink/55">
        現在の連続 <span className="font-semibold tabular-nums text-ha-green-deep">{s.current}</span> 日 ・ 最長{" "}
        <span className="font-semibold tabular-nums text-ha-green-deep">{s.longest}</span> 日
      </p>
    </div>
  );
}
