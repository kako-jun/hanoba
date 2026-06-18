import { type ChangeEvent, useId, useState } from "react";
import { DILUTION_LEVELS, type DilutionLevel } from "../../lib/feed/dilution.ts";
import Icon from "../ui/Icon.tsx";
import { useDilutionFor } from "./useDilution.ts";

interface Props {
  /** 対象の著者（pubkey hex）。 */
  pubkey: string;
  /** 表示用の著者名（見出し・ラベルに使う）。 */
  authorName: string;
}

// スライダの止まり木（左→右）。なし＝間引かない、以降 1/2・1/5・1/10 と強くなる。
// step=1 の range をこの index 配列で「段スナップ」させる＝中間の無意味な値（1/3 等・辞書に無い）を作らない。
const STOPS: readonly (DilutionLevel | null)[] = [null, ...DILUTION_LEVELS]; // [null, 2, 5, 10]

/** 段の見出しラベル（なし／1/2 …）。 */
function stopLabel(level: DilutionLevel | null): string {
  return level === null ? "なし" : `1/${level}`;
}

/**
 * 人ごとの「フィードで減らす」コントロール（#138）。投稿詳細モーダルの著者ヘッダ下に置く。
 *
 * **既定は畳む**（控えめな入口）＝既定が「なし（減らさない）」なのに常駐すると「減らすのが基本」と
 * 誤解させるため。開いたときだけ段スナップのスライダが出る。スライダは なし→1/2→1/5→1/10 の
 * 4 点にスナップ（中間の無意味な値を出さない）。設定すると即フィードに反映される
 * （useDilutionFor が localStorage 保存＋同ページのグリッドへ通知）。
 *
 * ラベルは**人に明示**＝「{名前}さんの投稿をフィードで減らす」（"薄める"は植物アプリで
 * "植物を薄める"とも読めるため廃止）。
 *
 * a11y: 入口は通常ボタン（aria-expanded）。スライダは native range（role=slider）＋ aria-valuetext で
 * 「なし／1/2…」を読み上げる（0〜3 の生 index を読ませない）。
 */
export default function DilutionControl({ pubkey, authorName }: Props) {
  const { level, setLevel } = useDilutionFor(pubkey);
  // 既定は畳む（active かどうかに関わらず）。入口の文言で現在量は見せる。
  const [open, setOpen] = useState(false);
  const sliderId = useId();

  const index = Math.max(0, STOPS.indexOf(level));

  function onSlide(e: ChangeEvent<HTMLInputElement>) {
    const i = Number(e.target.value);
    setLevel(STOPS[i] ?? null);
  }

  // 畳んだ入口の文言。未設定＝中立（減らす誘導にしない）。設定中＝現在の減量を見せる。
  const triggerLabel =
    level === null ? `${authorName}さんの表示を調整` : `${authorName}さんを 1/${level} に減らし中`;

  const heading = `${authorName}さんの投稿をフィードで減らす`;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs transition-colors ${
          level === null
            ? "text-ha-ink/45 hover:text-ha-ink/75"
            : "text-ha-green-deep hover:text-ha-green"
        }`}
      >
        <Icon
          name="chevron"
          className={`w-3 h-3 transition-transform ${open ? "-rotate-180" : ""}`}
        />
        {triggerLabel}
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-xl glass bg-ha-base/40 px-3 py-2.5">
          <label htmlFor={sliderId} className="text-[11px] font-medium text-ha-ink/60">
            {heading}
          </label>
          <input
            id={sliderId}
            type="range"
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={index}
            onChange={onSlide}
            aria-label={`${heading}量`}
            aria-valuetext={stopLabel(level)}
            className="w-full accent-ha-green"
          />
          {/* 段の目盛り（なし／1/2／1/5／1/10）。現在段を強調。値はスライダが伝えるので装飾扱い。 */}
          <div
            className="flex justify-between text-[10px] text-ha-ink/45 tabular-nums"
            aria-hidden="true"
          >
            {STOPS.map((s, i) => (
              <span
                key={i}
                className={i === index ? "font-semibold text-ha-green-deep" : ""}
              >
                {stopLabel(s)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
