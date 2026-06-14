// 本文/タグから植物を検出する純粋関数（#23 Phase 1）。
//
// 仕様（kako-jun session640）:
// - タグ（#パキポ）でも本文中の素の言葉（パキポ）でも反応する。
// - 文中に複数の植物が並んでいたら全部拾う（写真の有無や例え話かは判定しない）。
// - 誤字は対象外。表記ゆれ（俗称/カナ/英/略）は辞書の別名で吸収する。
//
// 照合は「テキストに別名（または学名・著名表記）が含まれるか」の部分一致。
// 同一植物は id で 1 回に畳む。順序は辞書順（安定）。

import { PLANTS, type PlantEntry } from "./dictionary.ts";

/** 1 植物あたりの検出語（小文字化済み）。dictionary から一度だけ構築する。 */
const NEEDLES: { entry: PlantEntry; needles: string[] }[] = PLANTS.map((entry) => ({
  entry,
  needles: [entry.name, entry.sci, ...entry.aliases]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== ""),
}));

/**
 * text に含まれる植物を辞書順・重複なしで返す。
 * - ラテン表記は大小無視（toLowerCase 比較）。
 * - 1 植物でも複数の別名が当たれば 1 件に畳む（id 単位）。
 * - 該当なしは空配列。
 */
export function detectPlants(text: string): PlantEntry[] {
  if (text === "") return [];
  const hay = text.toLowerCase();
  const found: PlantEntry[] = [];
  for (const { entry, needles } of NEEDLES) {
    if (needles.some((n) => hay.includes(n))) {
      found.push(entry);
    }
  }
  return found;
}
