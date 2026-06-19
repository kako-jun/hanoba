import { useEffect, useMemo, useState } from "react";
import type { FeedPost } from "../../lib/feed/parse.ts";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { computeCitizenStats } from "../../lib/feed/stats.ts";
import { citizenLevelLabel } from "../../lib/lore/citizen.ts";
import SciName from "../ui/SciName.tsx";

interface Props {
  /** その市民の t:hanoba 投稿（fetchMyPosts(pubkey)・自分/他人共通）。 */
  posts: FeedPost[];
  /** 表示名が登録済みか（市民レベルの判定＝名乗りで市民）。自分=名乗り有無、他人=プロフィール名の有無。 */
  hasName: boolean;
  /** 見出しの主語（自分=「あなた」/ 他人=表示名）。既定「この市民」。 */
  subjectName?: string;
}

/**
 * 市民の活動スタッツ節（#272・段階1）。`/me`（自分）と将来の `/u/?npub`（他人）で共有する。
 * すべて t:hanoba 投稿からのクライアント集計＝backendless・新たな身バレ無し（公開投稿を数えるだけ）。
 *
 * 品種カタログは初期バンドルに載せず動的 import（PostGrid と同型）。catalog 未ロード中は品種数を伏せ、
 * ロード後にふっと出る（グレースフル）。市民レベルは旅人/市民/市民Ln（古参・訪問者という語は使わない）。
 */
export default function CitizenStats({ posts, hasName, subjectName }: Props) {
  // 品種同定用カタログ（buildFuda）。動的 import・失敗時は null＝品種数を伏せるだけ。
  const [catalog, setCatalog] = useState<VarietyCategory[] | null>(null);
  useEffect(() => {
    let alive = true;
    import("../../lib/plants/variety-catalog.ts")
      .then((mod) => {
        if (alive) setCatalog(mod.VARIETY_CATALOG);
      })
      .catch(() => {
        /* 品種数を出さないだけ */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 在籍日数・レベルの基準は描画時点でよい（秒未満のズレは表示に影響しない）。
  const now = Math.floor(Date.now() / 1000);
  const stats = useMemo(
    () => computeCitizenStats({ posts, catalog: catalog ?? [], hasName, now }),
    // now は描画ごとに変わるが在籍「日数」には effect が無い。catalog/posts/hasName で十分。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posts, catalog, hasName],
  );

  const subject = subjectName ?? "この市民";
  const levelLabel = citizenLevelLabel(stats.level);

  return (
    <section className="glass rounded-2xl p-5 flex flex-col gap-4" aria-label={`${subject}の活動`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-ha-green-deep">{subject}の活動</h2>
        {/* 市民レベル（旅人/市民/市民Ln）。名乗り前は旅人＝まだ市民でない。 */}
        <span className="rounded-full bg-ha-green text-ha-white px-3 py-1 text-sm font-semibold">{levelLabel}</span>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="投稿" value={stats.postCount} unit="件" />
        <Stat label="写真" value={stats.photoCount} unit="枚" />
        <Stat label="品種" value={catalog === null ? null : stats.varietyCount} unit="種" />
        <Stat label="居住" value={stats.tenureDays} unit="日" />
      </dl>

      {/* 育てた品種の図鑑的な一覧（多い順）。catalog ロード後・1種以上あるときだけ。 */}
      {catalog !== null && stats.varieties.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-ha-ink/70">育てた品種</p>
          <ul className="flex flex-wrap gap-1.5">
            {stats.varieties.map((v) => (
              <li
                key={v.key}
                className="glass inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[2px] bg-ha-base/60 px-2.5 py-1 text-sm text-ha-ink shadow-sm shadow-black/25 before:-ml-0.5 before:mr-0.5 before:h-3 before:w-1.5 before:shrink-0 before:rounded-full before:bg-ha-green/80"
                title={v.sci !== null ? `${v.sci}（${v.name}）` : v.name}
              >
                {v.sci !== null && (
                  <span className="min-w-0 truncate">
                    <SciName sci={v.sci} className="font-display text-ha-green-deep" />
                  </span>
                )}
                <span className="min-w-0 truncate font-medium text-ha-ink">{v.name}</span>
                {v.count > 1 && <span className="shrink-0 text-xs tabular-nums text-ha-ink/55">×{v.count}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** 1つの数値スタッツ（値・単位）。value が null（未ロード）は「…」。 */
function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-white/5 px-3 py-2.5">
      <dt className="text-xs text-ha-ink/55">{label}</dt>
      <dd className="font-display text-2xl font-extrabold text-ha-green-deep tabular-nums">
        {value === null ? "…" : value}
        <span className="ml-0.5 text-sm font-semibold text-ha-ink/55">{unit}</span>
      </dd>
    </div>
  );
}
