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

/** 草マスの濃淡（0=投稿なし → 4=濃い・#310 GreenArea と同じ 5 段階で世界観を揃える）。 */
const LEVEL_BG = ["bg-white/5", "bg-ha-green/25", "bg-ha-green/45", "bg-ha-green/70", "bg-ha-green"] as const;
const WEEKS = 13;

export default function ActivityHeatmap({ posts }: { posts: FeedPost[] }) {
  const locale = useLocale();
  const t = useT(locale);
  // 曜日ラベル（行 0=日 … 6=土）。間引いて 月/水/金 だけ出す（GitHub の草と同じ・縦軸=曜日を示す）。
  // ロケール由来の narrow 表記で出す（ja は 日月火水木金土・en は SMTWTFS）。2024-01-07 が日曜。
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" }).format(Date.UTC(2024, 0, 7 + i)),
  );
  if (posts.length === 0) return null;
  // 暦日バケットなので秒未満のズレは無関係＝描画時点の now でよい（純関数に渡す）。
  const now = Math.floor(Date.now() / 1000);
  const grid = activityHeatmap(posts, now, WEEKS);
  const s = streaks(posts, now);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-ha-ink/70">
        {t("activity.heading")} <span className="text-xs font-normal text-ha-ink/45">{t("activity.heading.note")}</span>
      </p>
      {/* 週列×7曜日のヒートマップ。縦横の意味が分かるよう曜日ラベルを左に添える（kako-jun）。 */}
      <div className="flex gap-1 overflow-x-auto" aria-hidden>
        {/* 曜日ラベル列（GitHub の草と同じく間引いて 月/水/金 だけ・縦軸が曜日だと分かる）。 */}
        <div className="flex shrink-0 flex-col gap-0.5 pr-0.5">
          {weekdayLabels.map((d, r) => (
            <span key={r} className="flex h-2.5 items-center text-[8px] leading-none text-ha-ink/40">
              {r === 1 || r === 3 || r === 5 ? d : ""}
            </span>
          ))}
        </div>
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
