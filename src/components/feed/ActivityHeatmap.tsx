import type { FeedPost } from "../../lib/feed/parse.ts";
import { activityHeatmap, activityLevel, streaks } from "../../lib/feed/activity.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 撮影の草（#272 段階4・脱ゲーム化）。**いつ・どれだけ投稿したか**を GitHub 風の日別ヒートマップ
 * （週列×7曜日・濃淡=その日の投稿数）と連続記録で静かに見せる。#310 の緑グリッド（緑の貢献量・
 * per-post）とは別軸で補完的（こちらは投稿の頻度/継続）。バッジ/演出は付けない＝事実の可視化だけ。
 *
 * backendless＝t:hanoba 投稿のクライアント集計。集計は純関数 `lib/feed/activity.ts`（鼓門 JST・テスト済み）。
 */

/** 草マスの濃淡（#440・撮影枚数 0〜3）。0=なし(faint) / 1=少 / 2=中 / 3〜=多。kako-jun「少が薄すぎ 0 と
 *  区別できない・全体的に上げて」→ なし(white/8)と緑3段(55→78→100)を明確に分ける。index は activityLevel と一致。 */
const LEVEL_BG = ["bg-white/8", "bg-ha-green/55", "bg-ha-green/78", "bg-ha-green"] as const;
const WEEKS = 12;

/**
 * 撮影の草の曜日軸（#345）。**全7行・英語・曖昧なし**という #345 の意図はそのままに、3文字略で短縮する
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
      {/* 見出し行: 左に「撮影の草（直近N週）」、右に3段階の色凡例（#440・kako-jun。凡例は末尾でなく行右に置く／
          見出しと注記は items-center で上下中央に揃える＝旧 inline baseline のズレを解消）。 */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-ha-ink/70">
          {t("activity.heading")}
          <span className="text-xs font-normal text-ha-ink/45">{t("activity.heading.note", { weeks: WEEKS })}</span>
        </p>
        {/* 濃淡の凡例（少 → 多）。何が濃さを表すか一目で分かるように（kako-jun「さっぱりわからない」）。 */}
        <span className="flex items-center gap-1 text-[10px] text-ha-ink/45" aria-hidden>
          {/* 凡例は緑3段（少→中→多）だけ＝先頭の「なし」(LEVEL_BG[0]) は出さない（0 を「少」と誤読させない・#440）。 */}
          {t("activity.legend.low")}
          {LEVEL_BG.slice(1).map((bg, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[1px] ${bg}`} />
          ))}
          {t("activity.legend.high")}
        </span>
      </div>
      {/* 週列×7曜日のヒートマップ。縦横の意味が分かるよう曜日ラベルを左に添える（kako-jun）。
          草は常に7行固定＝縦スクロールは不要。`overflow-x-auto` だけだと overflow-y が auto に計算され、
          横スクロールバーが高さを食う/サブピクセルのはみ出しで**最初から縦スクロールバーが出る**ので
          overflow-y-hidden を明示して連鎖を断つ（kako-jun 実機指摘）。 */}
      <div className="flex gap-1 overflow-x-auto overflow-y-hidden pl-3" aria-hidden>
        {/* 曜日ラベル列（#345・英語3文字略7日を省略せず全行に・行位置を草マスと揃える・#389）。 */}
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
      {/* 連続記録（現在／最長）。区切りは中黒「・」だと2値が1語に見えるため細いスラッシュに（#440・kako-jun）。
          中身は見出しの下で少しインデント（pl-3・#449）してぶら下げる。 */}
      <p className="pl-3 text-xs text-ha-ink/55">
        {t("activity.streak.current")} <span className="font-semibold tabular-nums text-ha-green-deep">{s.current}</span>{" "}
        {t("activity.streak.days")}
        <span className="mx-1.5 text-ha-ink/30">/</span>
        {t("activity.streak.longest")} <span className="font-semibold tabular-nums text-ha-green-deep">{s.longest}</span>{" "}
        {t("activity.streak.days")}
      </p>
    </div>
  );
}
