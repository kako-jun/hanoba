import { DILUTION_LEVELS, type DilutionLevel } from "../../lib/feed/dilution.ts";
import { useDilutionFor } from "./useDilution.ts";

interface Props {
  /** 対象の著者（pubkey hex）。 */
  pubkey: string;
  /** 表示用の著者名（aria-label に使う）。 */
  authorName: string;
}

// セグメントの選択肢: なし（null）＋ 1/2・1/5・1/10。
// issue は「スライダ」だが、3 段＋なしの離散選択が実態（中間値に意味がない）に合うので
// セグメント（離散）にする。スライダだと「1/3」など辞書に無い値を示唆してしまう。
const OPTIONS: readonly { level: DilutionLevel | null; label: string }[] = [
  { level: null, label: "なし" },
  ...DILUTION_LEVELS.map((level) => ({ level, label: `1/${level}` })),
];

/**
 * 人ごとの「薄める」コントロール（#138）。投稿詳細モーダルの著者ヘッダ下に置く。
 *
 * その人の投稿をフィードで間引く度合いを なし / 1/2・1/5・1/10 から選ぶ離散セグメント。
 * ミュートの手前の柔らかい手段＝「埋もれない程度に減らす」。設定すると即フィードに反映される
 * （useDilutionFor が localStorage に保存し、同ページのグリッドへ変更を通知する）。
 *
 * a11y: radiogroup + radio（aria-checked）。控えめな glass/ha-* で著者ヘッダに馴染ませる。
 */
export default function DilutionControl({ pubkey, authorName }: Props) {
  const { level, setLevel } = useDilutionFor(pubkey);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ha-ink/45">
        フィードで薄める
      </span>
      <div
        role="radiogroup"
        aria-label={`${authorName} の投稿をフィードで薄める`}
        className="inline-flex items-center gap-1 rounded-full glass bg-ha-base/40 p-1"
      >
        {OPTIONS.map((opt) => {
          const selected = level === opt.level;
          return (
            <button
              key={opt.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLevel(opt.level)}
              className={`min-h-8 rounded-full px-3 py-1 text-sm font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green ${
                selected
                  ? "bg-ha-green text-ha-white shadow-sm shadow-ha-green/30"
                  : "text-ha-ink/70 hover:bg-ha-green-soft/70 hover:text-ha-green-deep"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
