// 投稿下書きの永続化（#228）。書きかけのひとこと・写真・クロップ枠・フィルタ・並び順・選択中の写真を
// 黙って自動保存し、次に開いたら黙って復元する。「バックアップ／復旧」という概念はユーザーに見せない。
//
// taxonomy（不変の Def）ではなく**実行時状態**（アップロード下書き）なので、カタログとは別管理（DESIGN の Def/状態分離）。
// このモジュールは「下書きの永続化」だけを担う純粋に近い島の外側ヘルパで、Nostr/relay には一切触れない。
//
// 保存先は IndexedDB に一本化する。写真は最大4枚・各数MB で localStorage（約5MB）を超えるうえ、
// 写真が無いと本文入力欄自体が出ない＝下書きは必ず写真とセットなので、localStorage は併用しない（二重管理のバグ源回避）。
// IndexedDB は Blob をネイティブ格納できる（base64 不要）。`idb` 等のランタイム依存は足さず、
// recent-tags.ts が raw localStorage を薄く使うのと同じ精神で、ネイティブ IndexedDB API を Promise で薄く包む。
//
// SSR 安全: indexedDB は必ず関数内で参照し、`typeof indexedDB === "undefined"` のサーバ評価時は no-op / null を返す
// （keys.ts / recent-tags.ts と同じ getLS パターン）。壊れた値は握り潰して null / 空に倒す。

import type { SquareCropRect } from "../image/crop.ts";
import type { SelectedFilter } from "../image/presets.ts";

const DB_NAME = "hanoba-composer";
const DB_VERSION = 1;
const BLOBS_STORE = "blobs";
const META_STORE = "meta";
// meta は singleton（下書きは常に1件）。固定キーで1レコードだけ持つ。
const META_KEY = "current";

/** blobs ストアの1レコード（写真の追加/削除時だけ同期する重い側）。 */
export interface DraftImageRecord {
  /** 写真の id（Composer の DraftImage.id と一致）。 */
  id: string;
  /** 画像本体（File も Blob として格納できる）。 */
  blob: Blob;
  /** 元ファイル名（復元時の new File 名に使う）。 */
  name: string;
  /** MIME タイプ（復元時の new File type に使う）。 */
  type: string;
  /** 並び順（0 始まり・昇順で復元する）。 */
  order: number;
}

/** meta ストアの1写真ぶんの軽い状態（クロップ枠・フィルタ）。 */
export interface DraftMetaItem {
  id: string;
  crop: SquareCropRect | null;
  filters: SelectedFilter[];
}

/** meta ストアの singleton レコード（デバウンス保存する軽い側）。 */
export interface DraftMeta {
  /** 本文（ひとこと）。 */
  caption: string;
  /** 選択中の写真 id（null＝先頭にフォールバック）。 */
  currentId: string | null;
  /** 写真ごとの軽い状態（並び順は items の順＝blobs の order と揃える）。 */
  items: DraftMetaItem[];
  /** 最終更新（ms）。保存専用＝loadDraft は読まないし、復元用の DraftSnapshot にも載せない（saveMeta が焼くだけ）。 */
  updatedAt: number;
}

/** loadDraft が返す復元用スナップショット（blobs と meta を id で join 済み・order 昇順）。 */
export interface DraftSnapshot {
  caption: string;
  currentId: string | null;
  /** order 昇順に並んだ写真。blob＋name＋type と、対応する crop / filters を結合して返す。 */
  images: Array<{
    id: string;
    blob: Blob;
    name: string;
    type: string;
    crop: SquareCropRect | null;
    filters: SelectedFilter[];
  }>;
}

/** SSR 安全に IndexedDB を取得する（サーバ評価時は null）。 */
function getIDB(): IDBFactory | null {
  return typeof indexedDB === "undefined" ? null : indexedDB;
}

/** DB を開く（無ければ onupgradeneeded で2ストアを作る）。失敗は reject。 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIDB();
    if (idb === null) {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS_STORE)) db.createObjectStore(BLOBS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
  });
}

/** 1トランザクション分を待つヘルパ（commit/abort を Promise 化）。 */
function awaitTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB tx aborted"));
  });
}

/** IDBRequest を Promise 化する小さなヘルパ。 */
function awaitReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
  });
}

/** 値が DraftImageRecord として妥当か（壊れた永続値を握り潰すための最小ガード）。 */
function isImageRecord(value: unknown): value is DraftImageRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    r.blob instanceof Blob &&
    typeof r.name === "string" &&
    typeof r.type === "string" &&
    typeof r.order === "number"
  );
}

/** 値が DraftMeta として妥当か（最小ガード。items 内の crop/filters は型を信頼し中身までは検査しない）。 */
function isMeta(value: unknown): value is DraftMeta & { key: string } {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return typeof m.caption === "string" && Array.isArray(m.items);
}

/**
 * 下書きを読み出す。meta と blobs を読み、id で join、order 昇順で返す。
 * meta が無い・写真が無いなら null（＝復元するものが無い）。壊れた値・DB エラーは握り潰して null に倒す。
 */
export async function loadDraft(): Promise<DraftSnapshot | null> {
  if (getIDB() === null) return null;
  try {
    const db = await openDB();
    try {
      const tx = db.transaction([BLOBS_STORE, META_STORE], "readonly");
      const blobsReq = tx.objectStore(BLOBS_STORE).getAll();
      const metaReq = tx.objectStore(META_STORE).get(META_KEY);
      const [rawBlobs, rawMeta] = await Promise.all([awaitReq(blobsReq), awaitReq(metaReq)]);

      if (!isMeta(rawMeta)) return null;
      const meta = rawMeta;

      const records = (Array.isArray(rawBlobs) ? rawBlobs : [])
        .filter(isImageRecord)
        .sort((a, b) => a.order - b.order);
      if (records.length === 0) return null;

      // meta.items を id で引けるようにしておき、各写真へクロップ枠・フィルタを結合する。
      const metaById = new Map<string, DraftMetaItem>();
      for (const item of meta.items) {
        if (item !== null && typeof item === "object" && typeof (item as DraftMetaItem).id === "string") {
          metaById.set((item as DraftMetaItem).id, item as DraftMetaItem);
        }
      }

      const images = records.map((rec) => {
        const m = metaById.get(rec.id);
        return {
          id: rec.id,
          blob: rec.blob,
          name: rec.name,
          type: rec.type,
          crop: m?.crop ?? null,
          filters: Array.isArray(m?.filters) ? m!.filters : [],
        };
      });

      const ids = new Set(images.map((img) => img.id));
      const currentId =
        typeof meta.currentId === "string" && ids.has(meta.currentId) ? meta.currentId : null;

      return { caption: meta.caption, currentId, images };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/**
 * 現在の画像集合に blobs ストアを一致させる（写真の追加/削除時だけ呼ぶ）。
 * 枚数 ≤ 4 なので差分計算はせず clear＋putAll で十分（単純で取りこぼしが無い）。
 * SSR / DB エラーは握り潰して no-op（永続化は best-effort・本体の編集を止めない）。
 */
export async function syncBlobs(records: DraftImageRecord[]): Promise<void> {
  if (getIDB() === null) return;
  try {
    const db = await openDB();
    try {
      const tx = db.transaction(BLOBS_STORE, "readwrite");
      const store = tx.objectStore(BLOBS_STORE);
      store.clear();
      for (const rec of records) store.put(rec);
      await awaitTx(tx);
    } finally {
      db.close();
    }
  } catch {
    // best-effort: 保存に失敗しても編集体験は止めない。
  }
}

/**
 * meta（本文・各写真のクロップ枠/フィルタ・並び順・選択中 id）を保存する（デバウンスして呼ぶ軽い側）。
 * updatedAt は呼び出し側で渡せるが、省略時は Date.now() を入れる。
 * SSR / DB エラーは握り潰して no-op。
 */
export async function saveMeta(meta: Omit<DraftMeta, "updatedAt"> & { updatedAt?: number }): Promise<void> {
  if (getIDB() === null) return;
  try {
    const db = await openDB();
    try {
      const tx = db.transaction(META_STORE, "readwrite");
      tx.objectStore(META_STORE).put({
        key: META_KEY,
        caption: meta.caption,
        currentId: meta.currentId,
        items: meta.items,
        updatedAt: meta.updatedAt ?? Date.now(),
      });
      await awaitTx(tx);
    } finally {
      db.close();
    }
  } catch {
    // best-effort。
  }
}

/**
 * 下書きを全消去する（両ストアを空に）。本文を自分で空にした時・投稿成功時に呼ぶ。
 * SSR / DB エラーは握り潰して no-op。
 */
export async function clearDraft(): Promise<void> {
  if (getIDB() === null) return;
  try {
    const db = await openDB();
    try {
      const tx = db.transaction([BLOBS_STORE, META_STORE], "readwrite");
      tx.objectStore(BLOBS_STORE).clear();
      tx.objectStore(META_STORE).clear();
      await awaitTx(tx);
    } finally {
      db.close();
    }
  } catch {
    // best-effort。
  }
}
