import type { FeedPost } from "../../lib/feed/parse.ts";
import { activityHeatmap, activityLevel, streaks } from "../../lib/feed/activity.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 活動の草（#272 段階4・脱ゲーム化）。**いつ・どれだけ投稿したか**を GitHub 風の日別ヒートマップ
 * （週列×7曜日・濃淡=その日の投稿数）と連続記録で静かに見せる。#310 の緑グリッド（緑の貢献量・
 * per-post）とは別軸で補完的（こちらは投稿の頻度/継続）。バッジ/演出は付けない＝事実の可視化だけ。
 *
 * backendless＝t:hanoba 投稿のクライアント集計。集計は純関数 `lib/feed/activity.ts`（鼓門 JST・テスト済み）。
 */

/** 草マスの濃淡（0=投稿なし → 2=多い・#389 で 3 段階に集約＝細かい濃淡差より「あった/少し/多い」を素直に）。 */
const LEVEL_BG = ["bg-white/5", "bg-ha-green/45", "bg-ha-green"] as const;
const WEEKS = 13;

/**
 * 活動の草の曜日軸（#345）。**全7行・英語・曖昧なし**という #345 の意図はそのままに、3文字略で短縮する
 * （行を間引かない／ロケール依存にしない＝narrow を 月/水/金 だけ間引いて軸が欠けた過去の失敗は再発しない）。
 * 行 0=日 … 6=土＝集計 `activityHeatmap` のグリッド行順（grid 行 0 が日曜）と一致させる（行順は不変）。
 */
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export default function ActivityHeatmap({ posts }: { posts: FeedPost[] }) {
  const locale = useLocale();
  const t = useT(locale);
  if (posts.length === 0) return null;
  // 暦日バケットなので秒未満のズレは無関係＝描画時点の now でよい（純関数に渡す）。
  const now = Math.floor(Date.now() / 1000);
  const grid = activityHeatmap(posts, now, WEEKS);
  const s = streaks(posts, now);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ha-ink/70">
        {t("activity.heading")}{" "}
        <span className="text-xs font-normal text-ha-ink/45">{t("activity.heading.note", { weeks: WEEKS })}</span>
      </p>
      {/* 週列×7曜日のヒートマップ。縦横の意味が分かるよう曜日ラベルを左に添える（kako-jun）。 */}
      <div className="flex gap-1 overflow-x-auto" aria-hidden>
        {/* 曜日ラベル列（#345・英語フル表記7日を省略せず全行に・行位置を草マスと揃える）。 */}
        <div className="flex shrink-0 flex-col gap-0.5 pr-1">
          {WEEKDAY_LABELS.map((d, r) => (
            <span key={r} className="flex h-2.5 items-center whitespace-nowrap text-[8px] leading-none text-ha-ink/40">
              {d}
            </span>
          ))}
        </div>
        {grid.map((col, w) => (
          // 各週列に、7行ぶんを貫くうっすい連続した縦トラックを敷く（#389）。最古週の頭・今週の今日以降に
          // 必ず出る day:null パディング（左上/右下の空白角）も、この列の上に乗るので「週という列の中の、
          // まだ無い日」と読め、欠けたタイルに見えない。空白セルはトラックを透過し、塗りセルは緑が乗る。
          <div key={w} className="flex shrink-0 flex-col gap-0.5 rounded-[2px] bg-white/[0.02]">
            {col.map((cell, r) => (
              <span
                key={r}
                className={`h-2.5 w-2.5 rounded-[1px] ${cell.day === null ? "bg-transparent" : LEVEL_BG[activityLevel(cell.count)]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-ha-ink/55">
          {t("activity.streak.current")} <span className="font-semibold tabular-nums text-ha-green-deep">{s.current}</span>{" "}
          {t("activity.streak.days")} ・ {t("activity.streak.longest")}{" "}
          <span className="font-semibold tabular-nums text-ha-green-deep">{s.longest}</span> {t("activity.streak.days")}
        </p>
        {/* 濃淡の凡例（少 → 多）。何が濃さを表すか一目で分かるように（kako-jun「さっぱりわからない」）。 */}
        <span className="flex items-center gap-1 text-[10px] text-ha-ink/45" aria-hidden>
          {t("activity.legend.low")}
          {LEVEL_BG.map((bg, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[1px] ${bg}`} />
          ))}
          {t("activity.legend.high")}
        </span>
      </div>
    </div>
  );
}
