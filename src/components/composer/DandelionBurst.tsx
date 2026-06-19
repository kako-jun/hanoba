// 投稿中に綿毛が舞い上がるエフェクト（#148 / #252）。送信ボタンに重ねるオーバーレイ。
//
// - 種（位置・風・回転・スプライト番号）の生成は lib/composer/dandelion.ts（純関数・テスト可）。
//   ここは active の間「打ち上げの一斉バースト → 投稿が終わるまで少量ずつ連続スポーン」を回し、
//   各粒は CSS アニメーション（ha-seed-rise）で舞い、終わったら animationend で自分を消す。
// - 反復＝単調を消すため、粒ごとに別スプライト（和・水彩の透過 PNG・複数変種）をランダムに割り当てる。
// - prefers-reduced-motion 時は spawn せず null（DESIGN §5.2・モーション抑制を尊重）。
// - SSR / matchMedia 不在時は安全に「抑制なし」とみなす。
// - pointer-events:none・aria-hidden でクリック・レイアウト・支援技術に干渉しない。

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { makeSeed, makeWind, type Seed } from "../../lib/composer/dandelion.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";

interface DandelionBurstProps {
  /** 投稿処理中か。true の間だけ綿毛を舞わせ続ける（アップロード＋publish の全尺）。 */
  active: boolean;
}

// 和・水彩タッチの透過スプライト＝単体のパラシュート種3変種（public/ 直下・#252）。
// 黒い綿毛を白地に生成→輝度をアルファ＋白黒反転で、白い綿毛＋半透明の冠毛に変換したもの。
// 粒ごとにこの中からランダムで割り当て、反復＝単調を消す。
const SEED_SPRITES = [
  "/seed-watercolor-1.png",
  "/seed-watercolor-2.png",
  "/seed-watercolor-3.png",
];

// 打ち上げ（押した瞬間の一斉バースト）と、その後の連続スポーン1回ぶん・間隔。
const LAUNCH_BURST = 14;
const REFILL_COUNT = 3;
const REFILL_MS = 600;

type LiveSeed = Seed & { id: number };

export default function DandelionBurst({ active }: DandelionBurstProps) {
  const [seeds, setSeeds] = useState<LiveSeed[]>([]);
  const idRef = useRef(0);

  // active の間だけ綿毛を生む。最初に打ち上げバースト、その後は REFILL_MS ごとに少量ずつ。
  // active が false になったら新規生成を止める（既存の粒は animationend で自然に消える）。
  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) return;

    const emit = (n: number) => {
      const wind = makeWind();
      setSeeds((prev) => {
        const batch: LiveSeed[] = [];
        for (let i = 0; i < n; i++) {
          batch.push({ ...makeSeed(Math.random, wind, SEED_SPRITES.length), id: idRef.current++ });
        }
        return [...prev, ...batch];
      });
    };

    emit(LAUNCH_BURST);
    const timer = setInterval(() => emit(REFILL_COUNT), REFILL_MS);
    return () => clearInterval(timer);
  }, [active]);

  function removeSeed(id: number) {
    setSeeds((prev) => prev.filter((s) => s.id !== id));
  }

  if (prefersReducedMotion()) return null;
  if (seeds.length === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-visible"
    >
      {seeds.map((seed) => (
        <span
          key={seed.id}
          className="ha-seed absolute"
          // 上昇（ha-seed-rise）の終了でだけ自分を消す。横揺れ（無限）や fade の animationend は無視する。
          onAnimationEnd={(e) => {
            if (e.animationName === "ha-seed-rise") removeSeed(seed.id);
          }}
          style={
            {
              width: `${seed.size}px`,
              height: `${seed.size}px`,
              "--dx": `${seed.dx}px`,
              "--dy": `${seed.dy}px`,
              "--rot": `${seed.rot}deg`,
              "--dur": `${seed.durMs}ms`,
              "--delay": `${seed.delayMs}ms`,
            } as CSSProperties
          }
        >
          {/* 横揺れは上昇とは別レイヤ（中間 span）。粒ごとの周期/位相で拍を desync する（#260）。 */}
          <span
            className="ha-seed-sway block h-full w-full"
            style={
              {
                "--sway": `${seed.sway}px`,
                "--sway-dur": `${seed.swayMs}ms`,
                "--sway-phase": `${seed.swayPhaseMs}ms`,
              } as CSSProperties
            }
          >
            {/* 粒ごとの静的な変形（非一様スケール＋skew）は最内の img に乗せる。各レイヤの transform
                （上昇／横揺れ／静的変形）は別要素なので干渉せず合成される。 */}
            <img
              src={SEED_SPRITES[seed.variant]}
              alt=""
              draggable={false}
              className="h-full w-full select-none"
              style={{ transform: `skewX(${seed.skew}deg) scale(${seed.scaleX}, ${seed.scaleY})` }}
            />
          </span>
        </span>
      ))}
    </span>
  );
}
