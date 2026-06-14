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

// ラテン文字のみの語か（語境界マッチに使う）。
const ASCII_ONLY = /^[\x20-\x7e]+$/;

/** 1 植物あたりの検出語（小文字化済み）。dictionary から一度だけ構築する。 */
const NEEDLES: { entry: PlantEntry; needles: string[] }[] = PLANTS.map((entry) => ({
  entry,
  needles: [entry.name, entry.sci, ...entry.aliases]
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== ""),
}));

/**
 * needle が text 中に「語として」出現するか。
 * - ラテン語（agave, monstera 等）は**語境界**で照合し、`agavental` のような誤爆を防ぐ。
 * - 日本語（かな/CJK）は語境界が無いので部分一致のまま（誤爆は辞書側で短すぎる別名を避けて抑える）。
 */
function matches(hay: string, needle: string): boolean {
  if (ASCII_ONLY.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(hay);
  }
  return hay.includes(needle);
}

/**
 * text に含まれる植物を辞書順・重複なしで返す。
 * - ラテン表記は大小無視＋語境界。日本語は部分一致。
 * - 1 植物でも複数の別名が当たれば 1 件に畳む（id 単位）。
 * - 該当なしは空配列。
 */
export function detectPlants(text: string): PlantEntry[] {
  if (text === "") return [];
  const hay = text.toLowerCase();
  const found: PlantEntry[] = [];
  for (const { entry, needles } of NEEDLES) {
    if (needles.some((n) => matches(hay, n))) {
      found.push(entry);
    }
  }
  return found;
}
