// 投稿の「札」を組む純粋関数（#182）。
//
// 札（ふだ）＝植物屋の鉢に刺さる名前。最も具体的な「属 品種」を1枚だけ出す
// （例「パキポディウム ブレビカウレ」）。タグ（#143/#144/#181）が概要→詳細の
// 全階層を付けてよいのとは別概念で、札は具体1つに畳む:
// - カテゴリ（塊根植物/花木 等）は札にしない。
// - 属に品種があれば「属単独」の札は捨てる（属＋品種に畳む）。
// - 同属の複数品種はそれぞれ「属 品種」の札として残す。
//
// 入力は post.hashtags のみ（#181 で属＋品種がタグに入るため。free-text 検出はしない）。
// catalog は **引数で受ける**＝variety-catalog を静的 import せず code-split を壊さない
// （呼び出し側が `await import("./variety-catalog.ts")` してから渡す）。学名は dictionary を
// ルックアップとして使う（純データなので静的 import でよい・軽量）。

import { PLANTS } from "./dictionary.ts";
import type { VarietyCategory } from "./variety-catalog.ts";

/** 投稿カードに刺す札1枚（属＋品種・最も具体的な鉢の名前）。 */
export interface Fuda {
  /** React key・dedupe 用（`genus + "/" + (variety ?? "")`）。 */
  key: string;
  /** 属（日本語表示名）。 */
  genus: string;
  /** 品種（無ければ null＝属止まりの札）。 */
  variety: string | null;
  /** 学名（dictionary から引けたら・無ければ null）。 */
  sci: string | null;
}

/** catalog の品種名→所在（属＋カテゴリ）。属/品種照合用の索引1エントリ。 */
interface VarietyIndexEntry {
  genus: string;
  category: string;
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
 * `hashtags` から札（属＋品種）を組む。catalog に無いタグ（カテゴリ・世話/記録・
 * 辞書外の任意タグ）は無視する。属で畳む（品種があれば属単独は捨てる）。
 *
 * 戻り値は安定順（catalog の出現順＝カテゴリ→属→品種の並び）。同一 (genus, variety) は1件。
 */
export function buildFuda(
  hashtags: readonly string[],
  catalog: VarietyCategory[],
): Fuda[] {
  // catalog を一度走査して索引を作る: 品種名→所在 / pickable な属名→属表示名。
  // name と aliases の両方を鍵にする（タグは clean な name で入る前提だが別名表記も拾う）。
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
            varietyIndex.set(k, { genus: genus.name, category: category.label });
          }
        }
      }
    }
  }

  // 属ごとの状態を畳む。品種が来たら属単独札（variety:null）は捨て、品種は集合で重複排除する。
  interface GenusState {
    /** 属単独札を出すか（品種が1件も無いときだけ true）。 */
    genusOnly: boolean;
    /** この属で立った品種（表示名・出現順を保つため Set）。 */
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
      // 札の品種名は照合した元タグでなく catalog 上の表示名でなく…ここでは入ってきたタグを
      // 採用すると別名表記が混ざるので、索引には所在しか無い。品種の表示名はタグ名（clean）を使う。
      stateFor(vloc.genus).varieties.add(tag.trim());
      continue;
    }
    const genusName = pickableGenus.get(k);
    if (genusName !== undefined) {
      stateFor(genusName).genusOnly = true;
      continue;
    }
    // カテゴリ・辞書外タグ（世話/記録等）は札にしない。
  }

  // catalog 出現順で安定化しつつ Fuda を組む（属＋品種を優先・品種が無い属だけ属単独）。
  const result: Fuda[] = [];
  const emitted = new Set<string>();
  const emit = (genus: string, variety: string | null) => {
    const key = `${genus}/${variety ?? ""}`;
    if (emitted.has(key)) return;
    emitted.add(key);
    const sci = variety !== null ? (lookupSci(variety) ?? lookupSci(genus)) : lookupSci(genus);
    result.push({ key, genus, variety, sci });
  };

  for (const category of catalog) {
    for (const genus of category.genera) {
      const state = states.get(genus.name);
      if (state === undefined) continue;
      if (state.varieties.size > 0) {
        // 品種があれば属単独は捨てる（畳む）。品種は catalog の並び順で安定化する。
        for (const v of genus.varieties) {
          if (state.varieties.has(v.name)) emit(genus.name, v.name);
        }
        // 別名表記でヒットした品種（catalog の v.name 並びに乗らないもの）も残す。
        for (const v of state.varieties) {
          if (!genus.varieties.some((gv) => gv.name === v)) emit(genus.name, v);
        }
      } else if (state.genusOnly) {
        emit(genus.name, null);
      }
    }
  }

  return result;
}
