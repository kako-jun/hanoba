// 綿毛（タンポポの種）が風に乗って飛ぶエフェクトの種（#148 / #252）。
// 投稿＝自分の植物の写真を風に放つメタファ。打ち上げの一斉バーストに加え、投稿が
// 終わるまで少量ずつ連続スポーンし「風に乗って次々舞い上がる」流れを作る（#252）。
//
// 純関数（rng 注入可）にして、見た目（DandelionBurst）と分けてテストできるようにする。
// makeSeed = 1粒、makeSeeds = 同じ「その時の風」（windBase）を共有する1バースト。
// 連続スポーン側はバッチごとに makeWind で風を取り直すので、時間とともに風向きも移ろう。

export interface Seed {
  // 飛んでいく横方向の到達量（px・右が正）。風（windBase）＋粒ごとのゆらぎ。
  dx: number;
  // 飛んでいく縦方向の到達量（px・必ず負＝上昇）。
  dy: number;
  // 回転（deg）。
  rot: number;
  // 上昇中の横揺れ幅（px）。サインの振幅で、符号により揺れ始める向きが変わる（単調さを消す）。
  sway: number;
  // アニメーション時間（ms）。
  durMs: number;
  // 発火からの遅れ（ms・粒ごとにずらして自然に散らす）。
  delayMs: number;
  // 種の大きさ（px）。
  size: number;
  // 使うスプライト画像の番号（0..variantCount-1）。粒ごとに別の絵にして反復＝単調を消す。
  variant: number;
  // 飛ぶときの非一様スケール（横/縦を独立に伸び縮み）。形を一粒ずつ変え、結果として見かけの拡大率も混ぜる（#252）。
  scaleX: number;
  scaleY: number;
  // わずかな傾き（skewX・deg）。風で歪んだ柔らかさを出す。
  skew: number;
}

// 連続スポーンの既定スプライト数（DandelionBurst の SEED_SPRITES と揃える＝単体種3変種・#252）。
export const DEFAULT_VARIANT_COUNT = 3;

// rng() ∈ [0, 1) を [min, max) に写す小さなヘルパ。
function span(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// 小数2桁に丸める（スケール係数用・CSS の transform に乗せる）。
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** その瞬間の主風向き（横）。粒はこれを中心に散る。呼ぶたびに 1 回 rng を消費する。 */
export function makeWind(rng: () => number = Math.random): number {
  return span(rng, -60, 60);
}

/**
 * 1粒の綿毛を生む。横は windBase（その瞬間の風）に粒ごとのゆらぎを足し、縦は必ず上昇（dy<0）。
 * rng の消費順は dx ゆらぎ→dy→rot→durMs→delayMs→size→sway→variant。
 * （makeSeeds は windBase を先頭で1回引いてから、この順で各粒を生む＝決定的テストと整合）。
 */
export function makeSeed(rng: () => number, windBase: number, variantCount = DEFAULT_VARIANT_COUNT): Seed {
  return {
    dx: Math.round(windBase + span(rng, -40, 40)),
    dy: Math.round(span(rng, -360, -160)),
    rot: Math.round(span(rng, -120, 120)),
    durMs: Math.round(span(rng, 1400, 2400)),
    delayMs: Math.round(span(rng, 0, 180)),
    // 一番拡大したサイズで揃える（#252・kako-jun 指示）。小さい方に散らさず ~104px 付近で大きく。
    // スプライトは 128px なのでこの範囲（最大 118px）でも downscale でくっきり保てる。
    size: Math.round(span(rng, 90, 118)),
    sway: Math.round(span(rng, -26, 26)),
    variant: Math.floor(rng() * Math.max(1, variantCount)),
    // 非一様スケール＝縦横独立の伸び縮み。形を一粒ずつ変え、結果として見かけの拡大率も混ぜる（#252）。
    scaleX: round2(span(rng, 0.78, 1.18)),
    scaleY: round2(span(rng, 0.78, 1.18)),
    skew: Math.round(span(rng, -12, 12)),
  };
}

/**
 * count 粒の綿毛を1バースト分生む。各粒は上（dy<0）へ、横はその発火の「風」に粒ごとのゆらぎを
 * 足した方向へ飛ぶ。風（windBase）は呼び出しごとに1回だけ決まるので、バーストごとに見た目が変わる。
 * count<=0 は [] を返す。rng を差し替えれば決定的にできる（テスト用）。
 */
export function makeSeeds(count: number, rng: () => number = Math.random): Seed[] {
  if (count <= 0) return [];
  const windBase = makeWind(rng);
  const seeds: Seed[] = [];
  for (let i = 0; i < count; i++) {
    seeds.push(makeSeed(rng, windBase));
  }
  return seeds;
}
