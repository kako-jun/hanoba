// 投稿時に綿毛が舞い上がるエフェクト（#148）。送信ボタンに重ねる単発オーバーレイ。
//
// - 種（位置・風・回転）の生成は lib/composer/dandelion.ts（純関数・テスト可）に分離。
//   ここは「与えられた seeds を描く」だけにする。
// - prefers-reduced-motion 時は spawn せず null（DESIGN §5.2・モーション抑制を尊重）。
// - SSR / matchMedia 不在時は安全に「抑制なし」とみなす。
// - pointer-events:none・aria-hidden でクリック・レイアウト・支援技術に干渉しない。
// - 再生は親が key を変えて remount することで起こす（単発）。

import type { CSSProperties } from "react";
import type { Seed } from "../../lib/composer/dandelion.ts";
import Icon from "../ui/Icon.tsx";

interface DandelionBurstProps {
  seeds: Seed[];
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function DandelionBurst({ seeds }: DandelionBurstProps) {
  // モーション抑制時は何も出さない（無音・無アニメーション）。
  if (prefersReducedMotion()) return null;
  if (seeds.length === 0) return null;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 grid place-items-center overflow-visible"
    >
      {seeds.map((seed, i) => (
        <span
          // 種は順序固定（描画後に並びは変わらない）ので index キーで足りる。
          key={i}
          className="ha-seed absolute text-ha-white/80"
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
          <Icon name="dandelion" className="h-full w-full" />
        </span>
      ))}
    </span>
  );
}
