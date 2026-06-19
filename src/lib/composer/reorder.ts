// 写真の並べ替え（#274）の純関数。配列入れ替えだけを担い、UI/状態から切り離してテスト可能にする。
//
// 設計（合意済）: 選択中の写真を ◀▶ で左/右へ 1 つずつ動かす。crop/filters は各 DraftImage に
// 内包されるので、並べ替えは「配列の要素を別の index に移す」だけ＝加工は写真と一緒に動く。
// id で対象を指し、delta（-1=左へ/+1=右へ）だけ移動する。
//
// 返り値は常に新しい配列（呼び出し側の setImages が参照変化を検知して保存 effect を発火できるよう、
// no-op でも元配列のコピーを返す）。

// id の要素を delta だけ移動した新しい配列を返す。
// - id が見つからない場合は元の順序のコピーをそのまま返す（no-op）。
// - 移動先が範囲外（先頭をさらに左／末尾をさらに右）になる場合は、target index を [0, len-1] に
//   クランプする。クランプ後に from === to なら no-op（元順序のコピー）。
// - delta は ±1 を主に想定するが、|delta|>1 でもクランプして安全に動く。
export function moveById<T extends { id: string }>(items: readonly T[], id: string, delta: number): T[] {
  const next = [...items];
  const from = next.findIndex((item) => item.id === id);
  if (from === -1) return next; // 対象なし＝no-op。
  const last = next.length - 1;
  const to = Math.min(last, Math.max(0, from + delta)); // 範囲内にクランプ。
  if (from === to) return next; // 端でさらに外へ／移動量 0 ＝no-op。
  // from は findIndex で見つかった有効 index（!== -1）かつ from === to の早期 return を通過済みなので、
  // splice(from, 1) は必ず 1 要素を返す＝moved は非 undefined（non-null assertion が安全）。
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}
