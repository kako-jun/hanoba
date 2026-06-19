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
  // 飛んでいく縦方向の到達量（px・必ず負＝上昇）。多くは控えめ、一部は画面端まで届く遠距離（#260）。
  dy: number;
  // 回転（deg）。
  rot: number;
  // 横揺れの振幅（px・正）。上昇とは別レイヤで往復させ、揺れる向きは keyframe が出す（#260）。
  sway: number;
  // 横揺れの周期（ms）。粒ごとに変えて「動いて止まる」拍が揃わないようにする（#260）。
  swayMs: number;
  // 横揺れの初期位相（ms・0..swayMs）。負の animation-delay で開始位置をずらし拍を desync する（#260）。
  swayPhaseMs: number;
  // 上昇アニメの尺（ms）。飛距離に比例＝遠い綿毛ほどゆっくり長く漂う（#260）。
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
 * rng の消費順は dx ゆらぎ→far判定→dy→rot→durMs→delayMs→size→sway→swayMs→swayPhase→variant
 * →scaleX→scaleY→skew。dx ゆらぎを第1 draw に置くのは「風の符号が全粒に効く」テスト前提のため。
 * （makeSeeds は windBase を先頭で1回引いてから、この順で各粒を生む＝決定的テストと整合）。
 */
export function makeSeed(rng: () => number, windBase: number, variantCount = DEFAULT_VARIANT_COUNT): Seed {
  const dx = Math.round(windBase + span(rng, -40, 40));
  // 飛距離は bimodal。多くは控えめ（ボタンの上）、一部（~28%）は画面端まで届く遠距離にして
  // 「画面の端まで飛ぶものが混じる」を作る（#260・kako-jun blink）。
  const far = rng() < 0.28;
  const dy = Math.round(far ? span(rng, -1500, -900) : span(rng, -420, -200));
  const rot = Math.round(span(rng, -120, 120));
  // 所要時間は飛距離に比例（遠いほどゆっくり）＝見かけ速度を一定寄りに保ち、遠い綿毛は long-drift。
  const durMs = Math.round(Math.abs(dy) * span(rng, 2.2, 3.0) + 800);
  const delayMs = Math.round(span(rng, 0, 220));
  // 一番拡大したサイズで揃える（#252）。スプライト 128px なのでこの範囲でも downscale でくっきり保てる。
  const size = Math.round(span(rng, 90, 118));
  const sway = Math.round(span(rng, 14, 40));
  const swayMs = Math.round(span(rng, 1100, 2600));
  const swayPhaseMs = Math.round(rng() * swayMs);
  const variant = Math.floor(rng() * Math.max(1, variantCount));
  // 非一様スケール＝縦横独立の伸び縮み。形を一粒ずつ変え、結果として見かけの拡大率も混ぜる（#252）。
  const scaleX = round2(span(rng, 0.78, 1.18));
  const scaleY = round2(span(rng, 0.78, 1.18));
  const skew = Math.round(span(rng, -12, 12));
  return { dx, dy, rot, sway, swayMs, swayPhaseMs, durMs, delayMs, size, variant, scaleX, scaleY, skew };
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
