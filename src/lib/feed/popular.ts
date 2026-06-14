// 人気タグ集計の純粋関数（#22）。relay 取得は client の責務。
//
// 複数投稿の本文ハッシュタグ一覧から、出現回数で降順ランキングする。
// 表記ゆれ（大小）は畳むが、表示は最初に現れた綴りを使う。

export interface RankedTag {
  tag: string;
  count: number;
}

/**
 * 各投稿の抽出済みハッシュタグ配列（tagLists）を集計して人気順に返す。
 * - 大小無視で同一視（最初の綴りを採用）。
 * - count 降順 → 同数は最初に現れた順（安定）。
 * - 最大 limit 件。
 */
export function rankHashtags(tagLists: string[][], limit = 30): RankedTag[] {
  const order: string[] = []; // 初出の綴りを保持
  const counts = new Map<string, number>(); // key=lowercase
  const spelling = new Map<string, string>();
  for (const list of tagLists) {
    for (const raw of list) {
      const key = raw.toLowerCase();
      if (!counts.has(key)) {
        counts.set(key, 0);
        spelling.set(key, raw);
        order.push(key);
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return order
    .map((key) => ({ tag: spelling.get(key) ?? key, count: counts.get(key) ?? 0 }))
    .sort((a, b) => b.count - a.count) // Array.sort は安定（同数は初出順を保つ）
    .slice(0, limit);
}
