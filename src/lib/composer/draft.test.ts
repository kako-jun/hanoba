// 下書き永続化（#228）の round-trip 系。IndexedDB を提供しない happy-dom env のため、
// このファイルでだけ fake-indexeddb をグローバルに差し込む（SSR ガード検証は別ファイル draft.ssr.test.ts）。
import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import { vi } from "vitest";

// fake-indexeddb の構造化クローンは Node ネイティブの Blob しか復元できない。
// happy-dom 標準の Blob を put すると読み戻しで素の Object に潰れ、実装の isImageRecord の
// `blob instanceof Blob` を満たさず全レコードが落ちてしまう（happy-dom + fake-indexeddb の
// 環境制約で、実ブラウザの IndexedDB では Blob は同一性を保って往復する）。
// このファイルでだけ global Blob を Node ネイティブ実装に差し替え、実ブラウザ相当の
// 「Blob が instanceof を保って往復する」状態を再現する。draft.ts の import より前に差し替える。
vi.stubGlobal("Blob", NodeBlob);

import { beforeEach, describe, expect, it } from "vitest";
import type { DraftImageRecord, DraftMeta } from "./draft.ts";
import { clearDraft, loadDraft, saveMeta, syncBlobs } from "./draft.ts";

const DB_NAME = "hanoba-composer";

/** DB をまっさらにする（毎テスト前に呼ぶ）。 */
function wipeDB(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("deleteDatabase failed"));
    // 既に閉じていれば blocked にはならないが、保険として blocked でも先へ進める。
    req.onblocked = () => resolve();
  });
}

/** 低レベルに blobs / meta へ直接 put するヘルパ（壊れ値も入れたいので生 API を使う）。 */
function rawPut(store: "blobs" | "meta", value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(store, "readwrite");
      // 各ストアは keyPath（blobs=id / meta=key）を持つので、key は value 側に焼く前提＝put(value) のみ。
      tx.objectStore(store).put(value);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error("put failed"));
      };
    };
    open.onerror = () => reject(open.error ?? new Error("open failed"));
  });
}

function makeBlob(bytes: number[], type = "image/jpeg"): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

function makeRecord(over: Partial<DraftImageRecord> = {}): DraftImageRecord {
  return {
    id: "id-a",
    blob: makeBlob([1, 2, 3]),
    name: "a.jpg",
    type: "image/jpeg",
    order: 0,
    ...over,
  };
}

function makeMeta(over: Partial<DraftMeta> = {}): DraftMeta {
  return {
    caption: "ひとこと",
    currentId: null,
    items: [],
    updatedAt: 1000,
    ...over,
  };
}

describe("draft 永続化（round-trip）", () => {
  beforeEach(async () => {
    await wipeDB();
  });

  it("save→load 往復で caption・currentId・images を復元する", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta(makeMeta({ caption: "開花した", currentId: "id-a", items: [{ id: "id-a", crop: null, filters: [] }] }));

    const snap = await loadDraft();
    expect(snap).not.toBeNull();
    expect(snap!.caption).toBe("開花した");
    expect(snap!.currentId).toBe("id-a");
    expect(snap!.images).toHaveLength(1);
    expect(snap!.images[0]!.id).toBe("id-a");
  });

  it("blob はネイティブ Blob で戻り、バイトが一致する（base64 化していない）", async () => {
    const bytes = [10, 20, 30, 40];
    await syncBlobs([makeRecord({ id: "id-a", blob: makeBlob(bytes) })]);
    await saveMeta(makeMeta({ items: [{ id: "id-a", crop: null, filters: [] }] }));

    const snap = await loadDraft();
    const got = snap!.images[0]!.blob;
    expect(got).toBeInstanceOf(Blob);
    const buf = new Uint8Array(await got.arrayBuffer());
    expect(Array.from(buf)).toEqual(bytes);
  });

  it("name / type を往復で保持する", async () => {
    await syncBlobs([makeRecord({ id: "id-a", name: "桜.png", type: "image/png" })]);
    await saveMeta(makeMeta({ items: [{ id: "id-a", crop: null, filters: [] }] }));

    const snap = await loadDraft();
    expect(snap!.images[0]!.name).toBe("桜.png");
    expect(snap!.images[0]!.type).toBe("image/png");
  });

  it("order を昇順に復元する（逆順 order で put しても 0,1,2 順で戻る）", async () => {
    await syncBlobs([
      makeRecord({ id: "id-c", order: 2 }),
      makeRecord({ id: "id-a", order: 0 }),
      makeRecord({ id: "id-b", order: 1 }),
    ]);
    await saveMeta(
      makeMeta({
        items: [
          { id: "id-a", crop: null, filters: [] },
          { id: "id-b", crop: null, filters: [] },
          { id: "id-c", crop: null, filters: [] },
        ],
      }),
    );

    const snap = await loadDraft();
    expect(snap!.images.map((i) => i.id)).toEqual(["id-a", "id-b", "id-c"]);
  });

  it("meta.items の crop / filters を id で join する（2枚別々の値）", async () => {
    await syncBlobs([
      makeRecord({ id: "id-a", order: 0 }),
      makeRecord({ id: "id-b", order: 1 }),
    ]);
    await saveMeta(
      makeMeta({
        items: [
          { id: "id-a", crop: { sx: 1, sy: 2, size: 3 }, filters: [{ name: "warm", strength: 1 }] },
          { id: "id-b", crop: { sx: 4, sy: 5, size: 6 }, filters: [{ name: "cool", strength: 2 }] },
        ],
      }),
    );

    const snap = await loadDraft();
    expect(snap!.images[0]!.crop).toEqual({ sx: 1, sy: 2, size: 3 });
    expect(snap!.images[0]!.filters).toEqual([{ name: "warm", strength: 1 }]);
    expect(snap!.images[1]!.crop).toEqual({ sx: 4, sy: 5, size: 6 });
    expect(snap!.images[1]!.filters).toEqual([{ name: "cool", strength: 2 }]);
  });

  it("撮影日 / 自動検出フラグ（shotDate / shotDateAuto）を往復する（#324）", async () => {
    await syncBlobs([
      makeRecord({ id: "id-auto", order: 0 }),
      makeRecord({ id: "id-manual", order: 1 }),
      makeRecord({ id: "id-none", order: 2 }),
    ]);
    await saveMeta(
      makeMeta({
        items: [
          // 自動抽出: shotDateAuto=true（「自動抽出しました。」を出してよい）。
          { id: "id-auto", crop: null, filters: [], shotDate: "2024-06-15", shotDateAuto: true },
          // 手入力: 同じ日付でも自動でない＝false（嘘をつかない・kako-jun）。
          { id: "id-manual", crop: null, filters: [], shotDate: "2024-06-15", shotDateAuto: false },
          // 未指定（旧ドラフト互換）: shotDate なし → shotDateAuto は既定 false。
          { id: "id-none", crop: null, filters: [] },
        ],
      }),
    );

    const snap = await loadDraft();
    expect(snap!.images[0]).toMatchObject({ shotDate: "2024-06-15", shotDateAuto: true });
    expect(snap!.images[1]).toMatchObject({ shotDate: "2024-06-15", shotDateAuto: false });
    expect(snap!.images[2]).toMatchObject({ shotDate: null, shotDateAuto: false });
  });

  it("currentId が現存する id ならそのまま維持する", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta(makeMeta({ currentId: "id-a", items: [{ id: "id-a", crop: null, filters: [] }] }));
    const snap = await loadDraft();
    expect(snap!.currentId).toBe("id-a");
  });

  it("currentId が現存しない id なら null に倒す", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta(makeMeta({ currentId: "id-gone", items: [{ id: "id-a", crop: null, filters: [] }] }));
    const snap = await loadDraft();
    expect(snap!.currentId).toBeNull();
  });

  it("currentId が null なら null のまま", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta(makeMeta({ currentId: null, items: [{ id: "id-a", crop: null, filters: [] }] }));
    const snap = await loadDraft();
    expect(snap!.currentId).toBeNull();
  });

  it("currentId が非 string（数値）なら null に倒す", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    // 型を曲げて壊れ currentId を直接書く。
    await rawPut("meta", { key: "current", caption: "x", currentId: 42, items: [{ id: "id-a", crop: null, filters: [] }], updatedAt: 1 });
    const snap = await loadDraft();
    expect(snap!.currentId).toBeNull();
  });

  it("meta が無ければ（blobs があっても）null", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    const snap = await loadDraft();
    expect(snap).toBeNull();
  });

  it("blobs が無ければ（meta があっても）null", async () => {
    await saveMeta(makeMeta({ items: [] }));
    const snap = await loadDraft();
    expect(snap).toBeNull();
  });

  it("両方無ければ null", async () => {
    const snap = await loadDraft();
    expect(snap).toBeNull();
  });

  it("meta.items に対応 id が無い写真は crop=null・filters=[] で埋める", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    // items は別 id しか持たない＝id-a に対応する meta が無い。
    await saveMeta(makeMeta({ items: [{ id: "id-other", crop: { sx: 0, sy: 0, size: 1 }, filters: [{ name: "x", strength: 1 }] }] }));
    const snap = await loadDraft();
    expect(snap!.images[0]!.crop).toBeNull();
    expect(snap!.images[0]!.filters).toEqual([]);
  });

  it("meta.items.filters が非配列なら filters=[] に倒す", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    // filters に配列でない値を直接書く。
    await rawPut(
      "meta",
      { key: "current", caption: "x", currentId: null, items: [{ id: "id-a", crop: null, filters: "壊れ" }], updatedAt: 1 },
    );
    const snap = await loadDraft();
    expect(snap!.images[0]!.filters).toEqual([]);
  });

  it("caption が非 string の壊れ meta は null に倒す", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await rawPut("meta", { key: "current", caption: 123, currentId: null, items: [], updatedAt: 1 });
    const snap = await loadDraft();
    expect(snap).toBeNull();
  });

  it("items が非配列の壊れ meta は null に倒す", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await rawPut("meta", { key: "current", caption: "x", currentId: null, items: "壊れ", updatedAt: 1 });
    const snap = await loadDraft();
    expect(snap).toBeNull();
  });

  it("blobs に壊れレコードが混ざっても、有効分だけで復元する", async () => {
    // 有効 1 件 + 壊れ 1 件（blob が Blob でない）を直接 put する。
    await rawPut("blobs", makeRecord({ id: "id-a", order: 0 }));
    await rawPut("blobs", { id: "id-broken", blob: "not-a-blob", name: "x", type: "y", order: 1 });
    await saveMeta(makeMeta({ items: [{ id: "id-a", crop: null, filters: [] }] }));
    const snap = await loadDraft();
    expect(snap!.images.map((i) => i.id)).toEqual(["id-a"]);
  });

  it("blobs が壊れレコードのみなら null", async () => {
    await rawPut("blobs", { id: "id-broken", blob: "not-a-blob", name: "x", type: "y", order: 0 });
    await saveMeta(makeMeta({ items: [] }));
    const snap = await loadDraft();
    expect(snap).toBeNull();
  });

  it("syncBlobs は clear+putAll する（3枚保存→1枚で再 sync すると 1 枚だけ戻る）", async () => {
    await syncBlobs([
      makeRecord({ id: "id-a", order: 0 }),
      makeRecord({ id: "id-b", order: 1 }),
      makeRecord({ id: "id-c", order: 2 }),
    ]);
    await syncBlobs([makeRecord({ id: "id-z", order: 0 })]);
    await saveMeta(makeMeta({ items: [{ id: "id-z", crop: null, filters: [] }] }));
    const snap = await loadDraft();
    expect(snap!.images.map((i) => i.id)).toEqual(["id-z"]);
  });

  it("clearDraft で両ストアが空になる（load が null）", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta(makeMeta({ items: [{ id: "id-a", crop: null, filters: [] }] }));
    expect(await loadDraft()).not.toBeNull();

    await clearDraft();
    expect(await loadDraft()).toBeNull();
  });

  it("saveMeta は upsert（singleton・後勝ち・1 件だけ残る）", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta(makeMeta({ caption: "1回目", items: [{ id: "id-a", crop: null, filters: [] }] }));
    await saveMeta(makeMeta({ caption: "2回目", items: [{ id: "id-a", crop: null, filters: [] }] }));

    const snap = await loadDraft();
    expect(snap!.caption).toBe("2回目");

    // meta ストアに 1 件しか無いことを生 API で確認する。
    const count = await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onsuccess = () => {
        const db = open.result;
        const req = db.transaction("meta", "readonly").objectStore("meta").count();
        req.onsuccess = () => {
          db.close();
          resolve(req.result);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      };
      open.onerror = () => reject(open.error);
    });
    expect(count).toBe(1);
  });

  it("saveMeta の updatedAt を省略すると呼び出し時刻付近の値が入る", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    const before = Date.now();
    await saveMeta({ caption: "x", currentId: null, items: [{ id: "id-a", crop: null, filters: [] }] });
    const after = Date.now();

    const updatedAt = await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onsuccess = () => {
        const db = open.result;
        const req = db.transaction("meta", "readonly").objectStore("meta").get("current");
        req.onsuccess = () => {
          db.close();
          resolve((req.result as DraftMeta).updatedAt);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      };
      open.onerror = () => reject(open.error);
    });
    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(after);
  });

  it("saveMeta に updatedAt を渡すとその値がそのまま入る", async () => {
    await syncBlobs([makeRecord({ id: "id-a", order: 0 })]);
    await saveMeta({ caption: "x", currentId: null, items: [{ id: "id-a", crop: null, filters: [] }], updatedAt: 777 });

    const updatedAt = await new Promise<number>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onsuccess = () => {
        const db = open.result;
        const req = db.transaction("meta", "readonly").objectStore("meta").get("current");
        req.onsuccess = () => {
          db.close();
          resolve((req.result as DraftMeta).updatedAt);
        };
        req.onerror = () => {
          db.close();
          reject(req.error);
        };
      };
      open.onerror = () => reject(open.error);
    });
    expect(updatedAt).toBe(777);
  });
});
