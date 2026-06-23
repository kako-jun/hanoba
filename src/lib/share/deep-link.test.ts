import { describe, expect, it } from "vitest";
import { nip19 } from "nostr-tools";
import { applyPostParamTo, encodePostNevent, readPostParam } from "./deep-link.ts";

// #386 deep-link `?p=<nevent>` の純粋ロジック。relay には触れず nip19 のみで往復を照合する。
const ID = "e".repeat(64);
const PUBKEY = "a".repeat(64);

describe("encodePostNevent", () => {
  it("正常 64hex の投稿は nevent を作り、復号で id/author/relays が一致する", () => {
    const nevent = encodePostNevent({ id: ID, pubkey: PUBKEY });
    expect(nevent).not.toBeNull();
    const decoded = nip19.decode(nevent!);
    expect(decoded.type).toBe("nevent");
    if (decoded.type === "nevent") {
      expect(decoded.data.id).toBe(ID);
      expect(decoded.data.author).toBe(PUBKEY);
      // 一般リレー2本をヒントに添える＝relays は1本以上。
      expect((decoded.data.relays ?? []).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("63桁 hex（長さ不足）は null", () => {
    expect(encodePostNevent({ id: "e".repeat(63), pubkey: PUBKEY })).toBeNull();
  });

  it("64桁 hex は非 null", () => {
    expect(encodePostNevent({ id: "e".repeat(64), pubkey: PUBKEY })).not.toBeNull();
  });

  it("65桁 hex（超過）は null", () => {
    expect(encodePostNevent({ id: "e".repeat(65), pubkey: PUBKEY })).toBeNull();
  });

  it("大文字混在（E×64）は null（小文字 hex のみ受ける）", () => {
    expect(encodePostNevent({ id: "E".repeat(64), pubkey: PUBKEY })).toBeNull();
  });

  it("空 id は null（見た目だけ正しい偽 nevent を作らせない）", () => {
    expect(encodePostNevent({ id: "", pubkey: PUBKEY })).toBeNull();
  });
});

describe("readPostParam（DT-1: URL → {id, relays}）", () => {
  it("`p` キーが無ければ null", () => {
    expect(readPostParam(new URLSearchParams(""))).toBeNull();
  });

  it("`p=\"\"`（空文字）は null", () => {
    expect(readPostParam(new URLSearchParams("p="))).toBeNull();
  });

  it("正常 nevent（relays 付き）は {id, relays} に往復一致する", () => {
    const relays = ["wss://relay.damus.io", "wss://nos.lol"];
    const nevent = nip19.neventEncode({ id: ID, author: PUBKEY, relays });
    const params = new URLSearchParams();
    params.set("p", nevent);
    const got = readPostParam(params);
    expect(got).not.toBeNull();
    expect(got!.id).toBe(ID);
    expect(got!.relays).toEqual(relays);
  });

  it("relays 未設定の nevent は relays: [] （空配列）になる", () => {
    const nevent = nip19.neventEncode({ id: ID, author: PUBKEY });
    const params = new URLSearchParams();
    params.set("p", nevent);
    const got = readPostParam(params);
    expect(got).not.toBeNull();
    expect(got!.id).toBe(ID);
    expect(got!.relays).toEqual([]);
  });

  it("正常 note（noteEncode）は {id, relays: []} になる", () => {
    const note = nip19.noteEncode(ID);
    const params = new URLSearchParams();
    params.set("p", note);
    const got = readPostParam(params);
    expect(got).not.toBeNull();
    expect(got!.id).toBe(ID);
    expect(got!.relays).toEqual([]);
  });

  it("npub を `p` に入れても（投稿でない型）null", () => {
    const npub = nip19.npubEncode(PUBKEY);
    const params = new URLSearchParams();
    params.set("p", npub);
    expect(readPostParam(params)).toBeNull();
  });

  it("壊れた bech32（decode が throw）は null（graceful）", () => {
    const params = new URLSearchParams();
    params.set("p", "nevent1brokenxxxxxxxxxxxxxxxxxxxxx");
    expect(readPostParam(params)).toBeNull();
  });

  it("平文 `p=hello`（bech32 でない）は null", () => {
    const params = new URLSearchParams();
    params.set("p", "hello");
    expect(readPostParam(params)).toBeNull();
  });

  it("非 64hex id の note（短い id で生成可能）は null で弾く", () => {
    // noteEncode は短い id でも throw せず note を作れる（neventEncode は 32 バイト必須で throw するので
    // 非 64hex nevent は作れない＝そのケースは作図不能）。decode 後の EVENT_ID_HEX で弾けることを確認する。
    const note = nip19.noteEncode("ab");
    const params = new URLSearchParams();
    params.set("p", note);
    expect(readPostParam(params)).toBeNull();
  });
});

describe("applyPostParamTo", () => {
  it("非 null の nevent は `p` を set する", () => {
    const params = new URLSearchParams();
    applyPostParamTo(params, "nevent1abc");
    expect(params.get("p")).toBe("nevent1abc");
  });

  it("null は `p` を delete する", () => {
    const params = new URLSearchParams("p=nevent1abc");
    applyPostParamTo(params, null);
    expect(params.has("p")).toBe(false);
  });

  it("`?tags=イネ` に `?p=` を set しても tags は残る（他クエリを触らない）", () => {
    const params = new URLSearchParams("tags=イネ");
    applyPostParamTo(params, "nevent1abc");
    expect(params.get("tags")).toBe("イネ");
    expect(params.get("p")).toBe("nevent1abc");
  });

  it("`?tags=イネ&p=...` から null で剥がすと tags だけ残る", () => {
    const params = new URLSearchParams("tags=イネ&p=nevent1abc");
    applyPostParamTo(params, null);
    expect(params.get("tags")).toBe("イネ");
    expect(params.has("p")).toBe(false);
  });
});
