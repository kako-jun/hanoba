// 投稿の「札」を組む純粋関数（#182・#23 学名統一）。
//
// 札（ふだ）＝植物屋の鉢に刺さる名前。#23 の決定仕様で、札は「学名（フォーマル）＋
// 最も有名な和名表記」を並べた1枚にする。最も具体的な和名（品種名 or 属名）を name に、
// 学名を sci に持つ。タグ（#143/#144/#181）が概要→詳細の全階層を付けてよいのとは別概念で、
// 札は具体1つに畳む:
// - カテゴリ（塊根植物/花木 等）は札にしない。
// - 属に品種があれば「属単独」の札は捨てる（品種に畳む）。
// - 同属の複数品種はそれぞれ品種の札として残す。
// - 非 pickable な見出し属（原種/その他塊根/コケ各種 等）配下の品種は「品種」の札として出す
//   ＝見出し語（原種 等）も属名も name に出さない（#23・学名＋品種和名だけ）。
//
// 入力は post.hashtags のみ（#181 で属＋品種がタグに入るため。free-text 検出はしない）。
// catalog は **引数で受ける**＝variety-catalog を静的 import せず code-split を壊さない
// （呼び出し側が `await import("./variety-catalog.ts")` してから渡す）。学名は catalog の
// variety.sci を最優先し、無ければ dictionary（属/著名種レベル）を lookup する（純データ）。

import { PLANTS } from "./dictionary.ts";
import type { VarietyCategory } from "./variety-catalog.ts";

/**
 * 投稿カードに刺す札1枚（#23・学名＋最も有名な和名）。
 * 最も具体的な和名（品種名 or 属名）を name に、学名を sci に持つ。
 */
export interface Fuda {
  /** React key・dedupe 用。 */
  key: string;
  /** 和名（最も具体的な著名表記＝品種名 or 属名）。属配下の見出し語は出さない。 */
  name: string;
  /** 学名（catalog の variety.sci 優先 → dictionary lookup → 引けなければ null）。 */
  sci: string | null;
}

/** catalog の品種照合用エントリ（属・カテゴリ・canonical 名・自前 sci）。 */
interface VarietyIndexEntry {
  /** 所属する属の表示名（学名フォールバック用）。 */
  genus: string;
  /** catalog 上の canonical 品種名（alias でヒットしてもこちらを name に使う）。 */
  varietyName: string;
  /** catalog が品種に直接持つ学名（最優先・無ければ undefined）。 */
  sci?: string;
}

/**
 * dictionary を name/aliases で照合する学名ルックアップ（純関数）。
 * 完全一致（前後空白・大小無視）。無ければ null。
 */
function lookupSci(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (n === "") return null;
  for (const p of PLANTS) {
    const needles = [p.name, ...p.aliases].map((s) => s.trim().toLowerCase());
    if (needles.includes(n)) return p.sci;
  }
  return null;
}

/**
 * `hashtags` から札（学名＋和名）を組む。catalog に無いタグ（カテゴリ label・
 * 非 pickable 見出し属・辞書外の任意タグ）は札にしない。属に品種があれば属単独は畳む。
 *
 * 学名 sci の解決順:
 * - 品種札: `catalog の variety.sci` ?? `lookupSci(品種名)` ?? `lookupSci(属名)` ?? null
 * - 属単独札: `lookupSci(属名)` ?? null
 *
 * name（和名）:
 * - 品種札: catalog の canonical 品種名（alias でヒットしても canonical 優先・引けなければ来たタグ）
 * - 属単独札: 属名
 *
 * 戻り値は安定順（catalog の出現順）。同一 name は1件に dedupe する。
 */
export function buildFuda(
  hashtags: readonly string[],
  catalog: VarietyCategory[],
): Fuda[] {
  // catalog を一度走査して索引を作る: 品種名(+alias)→所在 / pickable な属名(+alias)→属表示名。
  const varietyIndex = new Map<string, VarietyIndexEntry>();
  const pickableGenus = new Map<string, string>(); // 照合キー(小文字) → 属表示名

  for (const category of catalog) {
    for (const genus of category.genera) {
      if (genus.pickable) {
        for (const key of [genus.name, ...(genus.aliases ?? [])]) {
          const k = key.trim().toLowerCase();
          if (k !== "" && !pickableGenus.has(k)) pickableGenus.set(k, genus.name);
        }
      }
      for (const v of genus.varieties) {
        for (const key of [v.name, ...(v.aliases ?? [])]) {
          const k = key.trim().toLowerCase();
          if (k !== "" && !varietyIndex.has(k)) {
            varietyIndex.set(k, { genus: genus.name, varietyName: v.name, sci: v.sci });
          }
        }
      }
    }
  }

  // 属ごとに品種を畳む。品種が来たら属単独札は捨て、品種は集合で重複排除する。
  interface GenusState {
    /** 属単独札を出すか（品種が1件も無いときだけ true）。 */
    genusOnly: boolean;
    /** この属で立った品種の canonical 名（catalog 並び順で安定化する）。 */
    varieties: Set<string>;
  }
  const states = new Map<string, GenusState>();
  const stateFor = (genus: string): GenusState => {
    let s = states.get(genus);
    if (s === undefined) {
      s = { genusOnly: false, varieties: new Set<string>() };
      states.set(genus, s);
    }
    return s;
  };

  for (const tag of hashtags) {
    const k = tag.trim().toLowerCase();
    if (k === "") continue;
    // 品種を優先（品種名が属名/カテゴリ名と重なるデータでも具体側を札にする）。
    const vloc = varietyIndex.get(k);
    if (vloc !== undefined) {
      // 和名は catalog の canonical 品種名を使う（alias で来ても表記を canonical に寄せる）。
      stateFor(vloc.genus).varieties.add(vloc.varietyName);
      continue;
    }
    const genusName = pickableGenus.get(k);
    if (genusName !== undefined) {
      stateFor(genusName).genusOnly = true;
      continue;
    }
    // カテゴリ label・非 pickable 見出し属・辞書外タグ（世話/記録等）は札にしない。
  }

  // catalog 出現順で安定化しつつ Fuda を組む（品種を優先・品種が無い属だけ属単独）。
  const result: Fuda[] = [];
  const emitted = new Set<string>();
  // 品種札: name=品種名 / sci=catalog.sci → dict(品種) → dict(属) → null
  const emitVariety = (entry: VarietyIndexEntry) => {
    if (emitted.has(entry.varietyName)) return;
    emitted.add(entry.varietyName);
    const sci = entry.sci ?? lookupSci(entry.varietyName) ?? lookupSci(entry.genus);
    result.push({ key: entry.varietyName, name: entry.varietyName, sci });
  };
  // 属単独札: name=属名 / sci=dict(属) → null
  const emitGenus = (genus: string) => {
    if (emitted.has(genus)) return;
    emitted.add(genus);
    result.push({ key: genus, name: genus, sci: lookupSci(genus) });
  };

  for (const category of catalog) {
    for (const genus of category.genera) {
      const state = states.get(genus.name);
      if (state === undefined) continue;
      if (state.varieties.size > 0) {
        // 品種があれば属単独は捨てる（畳む）。品種は catalog の並び順で安定化する。
        for (const v of genus.varieties) {
          if (state.varieties.has(v.name)) {
            emitVariety({ genus: genus.name, varietyName: v.name, sci: v.sci });
          }
        }
      } else if (state.genusOnly) {
        emitGenus(genus.name);
      }
    }
  }

  return result;
}
