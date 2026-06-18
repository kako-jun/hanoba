import { describe, expect, it } from "vitest";
import { classifyDiscoverQuery, normalizeTag, selectAuthorsByName } from "./discover.ts";
import type { NostrEvent } from "../nostr/types.ts";

/** テスト用の最小 kind:0 イベント。 */
function profileEvent(pubkey: string, name: string, createdAt = 1000): NostrEvent {
  return {
    id: `${pubkey}-${createdAt}`,
    pubkey,
    created_at: createdAt,
    kind: 0,
    tags: [],
    content: JSON.stringify({ name }),
    sig: "",
  };
}

describe("normalizeTag", () => {
  it("前後の空白を trim する", () => {
    expect(normalizeTag("  アガベ  ")).toBe("アガベ");
  });

  it("先頭の # を除去する", () => {
    expect(normalizeTag("#アガベ")).toBe("アガベ");
  });

  it("空白と先頭 # の両方を処理する", () => {
    expect(normalizeTag("  #パキポ  ")).toBe("パキポ");
  });

  it("連続する先頭 # も除去する", () => {
    expect(normalizeTag("##植物")).toBe("植物");
  });

  it("先頭以外の # は残す", () => {
    expect(normalizeTag("#a#b")).toBe("a#b");
  });

  it("空文字・空白のみ・# のみは空になる", () => {
    expect(normalizeTag("")).toBe("");
    expect(normalizeTag("   ")).toBe("");
    expect(normalizeTag("#")).toBe("");
    expect(normalizeTag("  #  ")).toBe("");
  });
});

describe("classifyDiscoverQuery", () => {
  it("先頭 # はタグモード（term は # 除去）", () => {
    expect(classifyDiscoverQuery("#アガベ")).toEqual({ mode: "tag", term: "アガベ" });
  });

  it("先頭 # ＋前後空白もタグモードで正規化する", () => {
    expect(classifyDiscoverQuery("  #パキポ  ")).toEqual({ mode: "tag", term: "パキポ" });
  });

  it("# 無しはキーワードモード（term は trim のみ・# を付けない）", () => {
    expect(classifyDiscoverQuery("葉焼け")).toEqual({ mode: "keyword", term: "葉焼け" });
    expect(classifyDiscoverQuery("  徒長 ")).toEqual({ mode: "keyword", term: "徒長" });
  });

  it("空・空白のみは keyword/term='' （呼び出し側でリレーを叩かない）", () => {
    expect(classifyDiscoverQuery("")).toEqual({ mode: "keyword", term: "" });
    expect(classifyDiscoverQuery("   ")).toEqual({ mode: "keyword", term: "" });
  });

  it("語中の # はキーワード扱い（先頭でないため）", () => {
    expect(classifyDiscoverQuery("a#b")).toEqual({ mode: "keyword", term: "a#b" });
  });

  it("npub は著者モード（nostr: 接頭辞は除去・#68）", () => {
    expect(classifyDiscoverQuery("npub1abcdef0123")).toEqual({ mode: "author", term: "npub1abcdef0123" });
    expect(classifyDiscoverQuery("  nostr:npub1xyz789  ")).toEqual({ mode: "author", term: "npub1xyz789" });
  });

  it("@始まりはユーザー名モード（@ 除去後の名前・#68）", () => {
    expect(classifyDiscoverQuery("@カコ栽培家")).toEqual({ mode: "author-name", term: "カコ栽培家" });
    expect(classifyDiscoverQuery("  @kako  ")).toEqual({ mode: "author-name", term: "kako" });
  });

  it("@のみ（名前が空）はキーワード扱い", () => {
    expect(classifyDiscoverQuery("@")).toEqual({ mode: "keyword", term: "@" });
  });

  it("npub を含むが npub1 始まりでない語はキーワード", () => {
    expect(classifyDiscoverQuery("これは npub1abc です")).toEqual({
      mode: "keyword",
      term: "これは npub1abc です",
    });
  });

  it("大文字 NPUB1… は著者にしない（bech32 は小文字・decode 不能を避ける）", () => {
    expect(classifyDiscoverQuery("NPUB1ABCDEF")).toEqual({ mode: "keyword", term: "NPUB1ABCDEF" });
  });

  it("@npub1… は @ 始まりが優先されユーザー名モード（term は @ 除去後）", () => {
    expect(classifyDiscoverQuery("@npub1abc")).toEqual({ mode: "author-name", term: "npub1abc" });
  });
});

describe("selectAuthorsByName (#68)", () => {
  it("name に検索語を含む著者の pubkey を返す（大小無視・部分一致）", () => {
    const events = [
      profileEvent("pk1", "カコ栽培家"),
      profileEvent("pk2", "別の人"),
      profileEvent("pk3", "Kako Garden"),
    ];
    expect(selectAuthorsByName(events, "カコ")).toEqual(["pk1"]);
    expect(selectAuthorsByName(events, "kako")).toEqual(["pk3"]);
  });

  it("NIP-50 の誤ヒット（name に含まない kind:0）を除く", () => {
    const events = [profileEvent("pk1", "アガベ好き"), profileEvent("pk2", "無関係")];
    // search でヒットしても name に語が無ければ落とす。
    expect(selectAuthorsByName(events, "パキポ")).toEqual([]);
  });

  it("pubkey ごと最新の kind:0 を採用する（古い名前で誤ヒットしない）", () => {
    const events = [
      profileEvent("pk1", "旧カコ", 1000),
      profileEvent("pk1", "新しい名前", 2000),
    ];
    // 最新は「新しい名前」なので「カコ」では拾わない。
    expect(selectAuthorsByName(events, "カコ")).toEqual([]);
    expect(selectAuthorsByName(events, "新しい")).toEqual(["pk1"]);
  });

  it("max で件数を制限する", () => {
    const events = [
      profileEvent("pk1", "葉子A"),
      profileEvent("pk2", "葉子B"),
      profileEvent("pk3", "葉子C"),
    ];
    expect(selectAuthorsByName(events, "葉子", 2)).toHaveLength(2);
  });

  it("空の検索語は空配列", () => {
    expect(selectAuthorsByName([profileEvent("pk1", "カコ")], "  ")).toEqual([]);
  });
});
