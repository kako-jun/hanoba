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

import { findPlantByTerm } from "./search.ts";
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
  /**
   * **この札を生んだタグ集合**（札クリックの discover 絞り込みに使う＝札→タグの逆算・#272 follow-up）。
   * 札がつくルールの逆: 属共起で立った品種札は `[属, 品種]`（例 ブレビカウレ→`[パキポディウム, ブレビカウレ]`）、
   * 属単独札は `[属]`、非 pickable 見出し属配下の素の品種札は `[品種]`。**AND** で絞ると必ず元投稿に当たる
   * （双方向 1:1）。本文 #タグ ボタン〔単一タグ〕クリックとは区別される（札は属＋品種で絞る）。
   * kako-jun「ブレビカウレだけが特別ではない・札がつくルールの逆算をして複数タグに分解すればいい」。
   */
  filterTags: string[];
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
 * dictionary から学名をルックアップ（純関数）。catalog に sci が無い品種/属の和名から
 * 学名を引く。照合は #23 の `findPlantByTerm`（name/sci/aliases を完全一致・大小無視）に
 * 一本化し、PLANTS の二重走査を避ける（drift 防止・nit #182 再レビュー）。無ければ null。
 */
function lookupSci(name: string): string | null {
  return findPlantByTerm(name)?.sci ?? null;
}

/**
 * `hashtags` から札（学名＋和名）を組む。catalog に無いタグ（カテゴリ label・
 * 非 pickable 見出し属・辞書外の任意タグ）は札にしない。属に品種があれば属単独は畳む。
 *
 * #223 属コンテキスト解決: 別属に同名の品種があり得る（アボカドの「ハス」⇔蓮属、ボタンの
 * 「太陽」⇔サボテン/スモモ）ので、品種名は **先勝ちで捨てず全候補を持つ**。投稿のタグ集合から
 * 先に「存在する属の集合 genusPresent」（＝pickableGenus で引けた属名）を求め、品種タグは親属が
 * 同一投稿にある時だけ品種解決する。これで「ハスアボカド」改名・「太陽」ドロップの妥協を外す。
 * 親属が無い素の品種タグは catalog 先頭候補（既定）に倒す（本質的に決められず、それ以上は諦める）。
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
// 照合キーの正規化（小文字・前後 trim・**内部の空白と `_` を同一視**）。catalog の品種名は空白入り
// （例「フィカス ペティオラリス」）だが、投稿本文のタグは insertTag(normalizeTagForBody) で空白→`_`
// に畳まれて `#フィカス_ペティオラリス` で保存される。同じキーに正規化しないと複数語の品種で札が
// 出ない（#239 レビュー S1）。`_`/空白を `_` に寄せて両者を一致させる。
function normFudaKey(s: string): string {
  return s.trim().toLowerCase().replace(/[_\s]+/g, "_");
}

/**
 * 札解決用の索引（#257）。catalog 全走査で作る重い部分を切り出し、グリッド単位で1回だけ作って
 * 各カードの `resolveFuda` に配るためのもの。全カードで同一なのでカードごとに作り直さない。
 */
export interface FudaIndex {
  /** 安定順 emission（catalog 出現順）に使う元 catalog。 */
  catalog: VarietyCategory[];
  /** 品種名(+alias) 正規化キー → 全候補（#223 同名は配列で保持）。 */
  varietyIndex: Map<string, VarietyIndexEntry[]>;
  /** pickable 属の正規化キー → 属表示名。 */
  pickableGenus: Map<string, string>;
}

/**
 * catalog を**一度だけ**走査して札解決用の索引を作る純関数（#257）。`PostGrid` が catalog と一緒に
 * グリッド単位で1回 memo して各 `PostCard` の `resolveFuda` に配る（~2,000品種＋別名の走査を
 * カードごとに繰り返さない＝旧 buildFuda は呼ぶたびに索引を作り直していた）。
 */
export function buildVarietyIndex(catalog: VarietyCategory[]): FudaIndex {
  // catalog を一度走査して索引を作る: 品種名(+alias)→全候補 / pickable な属名(+alias)→属表示名。
  // #223: varietyIndex は同名の全候補を配列で保持する（先勝ちで捨てない＝属共起で解決するため）。
  const varietyIndex = new Map<string, VarietyIndexEntry[]>();
  const pickableGenus = new Map<string, string>(); // 照合キー(正規化) → 属表示名

  for (const category of catalog) {
    for (const genus of category.genera) {
      if (genus.pickable) {
        for (const key of [genus.name, ...(genus.aliases ?? [])]) {
          const k = normFudaKey(key);
          if (k !== "" && !pickableGenus.has(k)) pickableGenus.set(k, genus.name);
        }
      }
      for (const v of genus.varieties) {
        for (const key of [v.name, ...(v.aliases ?? [])]) {
          const k = normFudaKey(key);
          if (k === "") continue;
          const entry: VarietyIndexEntry = { genus: genus.name, varietyName: v.name, sci: v.sci };
          const list = varietyIndex.get(k);
          if (list === undefined) varietyIndex.set(k, [entry]);
          else list.push(entry);
        }
      }
    }
  }

  return { catalog, varietyIndex, pickableGenus };
}

/**
 * 索引（`buildVarietyIndex` の結果）を受けて**1投稿**の札を組む純関数（#257）。catalog 全走査の
 * 重い索引作成を含まないので投稿ごとに軽い。属コンテキスト解決（#223）・安定順 emission（catalog
 * 出現順）は従来の `buildFuda` と同一の挙動。
 */
export function resolveFuda(hashtags: readonly string[], index: FudaIndex): Fuda[] {
  const { catalog, varietyIndex, pickableGenus } = index;
  const norm = normFudaKey;

  // 属ごとに品種を畳む。品種が来たら属単独札は捨てる。品種ごとに「札を生んだタグ集合（filterTags）」を持つ
  // （canonical 名 → filterTags・catalog 並び順で安定化）。
  interface GenusState {
    /** 属単独札を出すか（品種が1件も無いときだけ true）。 */
    genusOnly: boolean;
    /** この属で立った品種 canonical 名 → その札の filterTags（札クリックの逆算タグ）。 */
    varieties: Map<string, string[]>;
  }
  const states = new Map<string, GenusState>();
  const stateFor = (genus: string): GenusState => {
    let s = states.get(genus);
    if (s === undefined) {
      s = { genusOnly: false, varieties: new Map<string, string[]>() };
      states.set(genus, s);
    }
    return s;
  };

  // 1パス目: 投稿に存在する属の集合を求める（#223）。品種タグの親属は来た時点では未確定なので、
  // genusPresent は「pickableGenus で引けたタグ＝明示された属名/alias」だけで作る（これが正解）。
  const genusPresent = new Set<string>();
  for (const tag of hashtags) {
    const k = norm(tag);
    if (k === "") continue;
    const genusName = pickableGenus.get(k);
    if (genusName !== undefined) genusPresent.add(genusName);
  }

  // 2パス目: 各タグを属コンテキストで解決する（#223）。
  for (const tag of hashtags) {
    const k = norm(tag);
    if (k === "") continue;
    const cands = varietyIndex.get(k) ?? [];
    const gmatch = pickableGenus.get(k);
    // 親属が同一投稿にある候補だけを品種解決する（別属の同名は混ざらない）。
    const active = cands.filter((c) => genusPresent.has(c.genus));
    if (active.length > 0) {
      // 通常は1件。属共起で確定した品種を該当属に立てる（和名は canonical）。filterTags=[属, 品種]
      // （元投稿が #属 #品種 を持つ＝逆算で必ず当たる）。属名は canonical を使う（discover 側で別名展開される）。
      for (const c of active) {
        if (!stateFor(c.genus).varieties.has(c.varietyName)) {
          stateFor(c.genus).varieties.set(c.varietyName, [c.genus, c.varietyName]);
        }
      }
    } else if (gmatch !== undefined) {
      // 品種解決できず、タグ自体が属名/alias なら属単独札にする（蓮・イネ alias 等）。filterTags=[属]。
      stateFor(gmatch).genusOnly = true;
    } else if (cands.length > 0) {
      // 親属タグ無しの素の品種タグ＝既定（catalog 先頭候補）に倒す（#223）。**filterTags=[品種]**
      // ＝元投稿は #品種 しか持たないので、札クリックの逆算は品種単独で当たる（属共起の時だけ [属, 品種]）。
      // それ以上は同定しない（諦める・#223 kako-jun 決定）。
      const def = cands[0]!;
      if (!stateFor(def.genus).varieties.has(def.varietyName)) {
        stateFor(def.genus).varieties.set(def.varietyName, [def.varietyName]);
      }
    }
    // else（カテゴリ label・非 pickable 見出し属・辞書外タグ）は札にしない。
  }

  // catalog 出現順で安定化しつつ Fuda を組む（品種を優先・品種が無い属だけ属単独）。
  const result: Fuda[] = [];
  const emitted = new Set<string>();
  // 品種札: name=品種名 / sci=catalog.sci → dict(品種) → dict(属) → null / filterTags=札を生んだタグ集合。
  const emitVariety = (entry: VarietyIndexEntry, filterTags: string[]) => {
    if (emitted.has(entry.varietyName)) return;
    emitted.add(entry.varietyName);
    const sci = entry.sci ?? lookupSci(entry.varietyName) ?? lookupSci(entry.genus);
    result.push({ key: entry.varietyName, name: entry.varietyName, sci, filterTags });
  };
  // 属単独札: name=属名 / sci=dict(属) → null / filterTags=[属名]。
  const emitGenus = (genus: string) => {
    if (emitted.has(genus)) return;
    emitted.add(genus);
    result.push({ key: genus, name: genus, sci: lookupSci(genus), filterTags: [genus] });
  };

  for (const category of catalog) {
    for (const genus of category.genera) {
      const state = states.get(genus.name);
      if (state === undefined) continue;
      if (state.varieties.size > 0) {
        // 品種があれば属単独は捨てる（畳む）。品種は catalog の並び順で安定化する。
        for (const v of genus.varieties) {
          const tags = state.varieties.get(v.name);
          if (tags !== undefined) {
            emitVariety({ genus: genus.name, varietyName: v.name, sci: v.sci }, tags);
          }
        }
      } else if (state.genusOnly) {
        emitGenus(genus.name);
      }
    }
  }

  return result;
}

/**
 * `hashtags` から札を組む（索引作成＋解決を一括）。単発呼び出し（`PostDetail` の1投稿・テスト）向け。
 * グリッド（`PostGrid`）では索引を使い回すため `buildVarietyIndex` → `resolveFuda` を直接使う（#257）。
 * 入出力契約（#182/#223）は従来どおり：`resolveFuda(hashtags, buildVarietyIndex(catalog))` と等価。
 */
export function buildFuda(hashtags: readonly string[], catalog: VarietyCategory[]): Fuda[] {
  return resolveFuda(hashtags, buildVarietyIndex(catalog));
}

/**
 * 単一の品種/属名から札を1枚解決する（#343・プロフィールの「好きな品種」用）。カタログに在れば
 * `resolveFuda` と同じ規則で学名＋和名の札（投稿の札と同一表示）を返し、引けない自由入力品種は
 * **消さず**和名のみの札（`sci=null`）へフォールバックする。`index` は `buildVarietyIndex` の結果。
 * 名称1つは属コンテキストが無いので、品種は catalog 先頭候補（#223 既定）に倒れる（投稿札と同じ挙動）。
 */
export function fudaForName(name: string, index: FudaIndex): Fuda {
  const resolved = resolveFuda([name], index);
  return resolved[0] ?? { key: name, name, sci: null, filterTags: [name] };
}
