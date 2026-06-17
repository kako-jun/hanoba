// 綿毛（タンポポの種）が風に乗って飛ぶエフェクトの種（#148）。
// 投稿＝自分の植物の写真を風に放つメタファ。1回の発火で count 粒を生む。
//
// 純関数（rng 注入可）にして、見た目（DandelionBurst）と分けてテストできるようにする。
// 1 バースト＝同じ「その時の風」（windBase）を全粒で共有しつつ、粒ごとに散らす（jitter）。
// → 毎回違う風向きに飛び、同じ瞬間でも粒は少しずつばらける。

export interface Seed {
  // 飛んでいく横方向の量（px・右が正）。風（windBase）＋粒ごとのゆらぎ。
  dx: number;
  // 飛んでいく縦方向の量（px・必ず負＝上昇）。
  dy: number;
  // 回転（deg）。
  rot: number;
  // アニメーション時間（ms）。
  durMs: number;
  // 発火からの遅れ（ms・粒ごとにずらして自然に散らす）。
  delayMs: number;
  // 種の大きさ（px）。
  size: number;
}

// rng() ∈ [0, 1) を [min, max) に写す小さなヘルパ。
function span(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

/**
 * count 粒の綿毛を生む。各粒は上（dy<0）へ、横はその発火の「風」に粒ごとのゆらぎを足した方向へ飛ぶ。
 * 風（windBase）は呼び出しごとに1回だけ決まるので、バーストごとに見た目が変わる。
 * count<=0 は [] を返す。rng を差し替えれば決定的にできる（テスト用）。
 */
export function makeSeeds(count: number, rng: () => number = Math.random): Seed[] {
  if (count <= 0) return [];
  // その発火の主風向き（横）。粒はこれを中心に散る。
  const windBase = span(rng, -60, 60);
  const seeds: Seed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push({
      dx: Math.round(windBase + span(rng, -40, 40)),
      dy: Math.round(span(rng, -260, -120)),
      rot: Math.round(span(rng, -120, 120)),
      durMs: Math.round(span(rng, 900, 1600)),
      delayMs: Math.round(span(rng, 0, 180)),
      size: Math.round(span(rng, 6, 12)),
    });
  }
  return seeds;
}
