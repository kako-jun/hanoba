import { describe, expect, it } from "vitest";
import { nip19 } from "nostr-tools";
import {
  authorHref,
  filterByHashtag,
  mergePostsById,
  parseProfile,
  parseProfileName,
  parsePost,
  relativeTime,
  shortNpub,
  type FeedPost,
} from "./parse.ts";
import type { NostrEvent } from "../nostr/types.ts";

describe("parseProfileName", () => {
  it("kind:0 content の name を返す", () => {
    expect(parseProfileName('{"name":"カコ栽培家","about":"x"}')).toBe("カコ栽培家");
  });
  it("前後空白は trim する", () => {
    expect(parseProfileName('{"name":"  葉子  "}')).toBe("葉子");
  });
  it("name 無し・空・不正 JSON は null", () => {
    expect(parseProfileName('{"about":"x"}')).toBeNull();
    expect(parseProfileName('{"name":"   "}')).toBeNull();
    expect(parseProfileName("not json")).toBeNull();
  });
});

describe("parseProfile (#35)", () => {
  it("name / picture / about / websites を取り出す", () => {
    const p = parseProfile(
      '{"name":"カコ","picture":"https://x/a.jpg","about":"育てる","website":"https://kako.example"}',
    );
    expect(p.name).toBe("カコ");
    expect(p.picture).toBe("https://x/a.jpg");
    expect(p.about).toBe("育てる");
    expect(p.websites).toEqual(["https://kako.example"]);
  });

  it("mypace 拡張 websites:[{url}] を複数拾い、website とマージ・重複除去", () => {
    const p = parseProfile(
      '{"name":"x","websites":[{"url":"https://a.example"},{"url":"https://b.example"}],"website":"https://a.example"}',
    );
    expect(p.websites).toEqual(["https://a.example", "https://b.example"]);
  });

  it("websites は http(s) の絶対 URL だけ通す（危険スキーム・相対を弾く・#77）", () => {
    const p = parseProfile(
      '{"websites":["https://ok.example","javascript:alert(1)","/relative","data:text/html,x","http://plain.example"]}',
    );
    expect(p.websites).toEqual(["https://ok.example", "http://plain.example"]);
  });

  it("name 無しは display_name にフォールバック", () => {
    expect(parseProfile('{"display_name":"葉子"}').name).toBe("葉子");
  });

  it("不正 JSON は空 Profile", () => {
    expect(parseProfile("nope")).toEqual({ name: null, picture: null, about: null, websites: [] });
  });
});

describe("shortNpub (#35)", () => {
  it("hex pubkey を npub1…短縮にする", () => {
    const s = shortNpub("a".repeat(64));
    expect(s.startsWith("npub1")).toBe(true);
    expect(s).toContain("…");
  });

  it("不正 pubkey でも壊れず文字列を返す", () => {
    expect(typeof shortNpub("zzz")).toBe("string");
  });
});

describe("authorHref (#272 段階3)", () => {
  it("hex pubkey を /u?npub=… の相対パスにする（npub は round-trip で復元できる）", () => {
    const pubkey = "a".repeat(64);
    const href = authorHref(pubkey);
    expect(href).not.toBeNull();
    expect(href!.startsWith("/u?npub=npub1")).toBe(true);
    // クエリの npub を decode すると元の pubkey に戻る（/u 島が読む経路と一致）。
    const npub = new URLSearchParams(href!.slice(href!.indexOf("?"))).get("npub")!;
    const decoded = nip19.decode(npub);
    expect(decoded.type).toBe("npub");
    expect(decoded.data).toBe(pubkey);
  });

  it("空 pubkey は null（リンクにしない）", () => {
    expect(authorHref("")).toBeNull();
  });

  it("npub にできない不正 pubkey は null", () => {
    // 64桁 hex でない（npubEncode が throw する）→ null。
    expect(authorHref("zzz")).toBeNull();
  });
});

// テスト用の最小イベント。署名等は parsePost で参照しないので未設定で良い。
function makeEvent(overrides: Partial<NostrEvent> & { content: string }): NostrEvent {
  return {
    id: overrides.id ?? "id0",
    pubkey: overrides.pubkey ?? "pk0",
    created_at: overrides.created_at ?? 1000,
    kind: 1,
    tags: [],
    content: overrides.content,
    sig: "",
  };
}

describe("parsePost", () => {
  it("画像 URL を抽出して imageUrl にする", () => {
    const post = parsePost(makeEvent({ content: "開花した\nhttps://image.nostr.build/abc.jpg" }));
    expect(post.imageUrl).toBe("https://image.nostr.build/abc.jpg");
    expect(post.imageUrls).toEqual(["https://image.nostr.build/abc.jpg"]);
  });

  it("caption は画像 URL を除去して trim する（連続改行は畳む）", () => {
    const post = parsePost(makeEvent({ content: "開花した #アガベ\n\nhttps://image.nostr.build/abc.jpg" }));
    expect(post.caption).toBe("開花した #アガベ");
  });

  it("hashtags を本文から抽出する", () => {
    const post = parsePost(makeEvent({ content: "開花 #アガベ #パキポ\nhttps://image.nostr.build/abc.png" }));
    expect(post.hashtags).toEqual(["アガベ", "パキポ"]);
  });

  it("画像 URL が無ければ imageUrl は null、caption は本文そのまま", () => {
    const post = parsePost(makeEvent({ content: "ただの一言 #植物" }));
    expect(post.imageUrl).toBeNull();
    expect(post.imageUrls).toEqual([]);
    expect(post.caption).toBe("ただの一言 #植物");
    expect(post.hashtags).toEqual(["植物"]);
  });

  it("空行（段落区切り）は残す（#65）", () => {
    const post = parsePost(makeEvent({ content: "一段目\n\n二段目\nhttps://image.nostr.build/a.jpg" }));
    expect(post.caption).toBe("一段目\n\n二段目");
  });

  it("過剰な連続改行（3つ以上）は空行1つに抑える", () => {
    const post = parsePost(makeEvent({ content: "a\n\n\n\nb" }));
    expect(post.caption).toBe("a\n\nb");
  });

  it("複数画像 URL は先頭を imageUrl にする", () => {
    const post = parsePost(
      makeEvent({
        content: "二枚\nhttps://image.nostr.build/a.jpg\nhttps://image.nostr.build/b.png",
      }),
    );
    expect(post.imageUrl).toBe("https://image.nostr.build/a.jpg");
    expect(post.imageUrls).toEqual(["https://image.nostr.build/a.jpg", "https://image.nostr.build/b.png"]);
    // caption からは両方の URL が消える。
    expect(post.caption).toBe("二枚");
  });

  it("クエリ付き URL も抽出する", () => {
    const post = parsePost(makeEvent({ content: "水やり\nhttps://image.nostr.build/x.webp?v=2" }));
    expect(post.imageUrl).toBe("https://image.nostr.build/x.webp?v=2");
    expect(post.caption).toBe("水やり");
  });

  it("二重拡張子は最後の拡張子までを 1 URL として採る（貪欲）", () => {
    const post = parsePost(makeEvent({ content: "二重\nhttps://h/x.jpg.png" }));
    expect(post.imageUrl).toBe("https://h/x.jpg.png");
    // caption に拡張子の断片（.png）が残らない。
    expect(post.caption).toBe("二重");
  });

  it("大文字拡張子・avif/gif も抽出する", () => {
    expect(parsePost(makeEvent({ content: "a https://h/x.AVIF" })).imageUrl).toBe("https://h/x.AVIF");
    expect(parsePost(makeEvent({ content: "b https://h/y.gif" })).imageUrl).toBe("https://h/y.gif");
  });

  it("id / pubkey / createdAt をイベントから写す", () => {
    const post = parsePost(makeEvent({ id: "e1", pubkey: "p1", created_at: 1700, content: "x https://h/x.jpg" }));
    expect(post.id).toBe("e1");
    expect(post.pubkey).toBe("p1");
    expect(post.createdAt).toBe(1700);
  });
});

describe("mergePostsById", () => {
  function p(id: string, createdAt: number): FeedPost {
    return { id, pubkey: "pk", createdAt, caption: "", imageUrls: [], imageUrl: null, hashtags: [] };
  }

  it("id で重複除去する（最初の出現を採用）", () => {
    const merged = mergePostsById([p("a", 1)], [p("a", 1), p("b", 2)]);
    expect(merged.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("createdAt 降順に並べる", () => {
    const merged = mergePostsById([p("a", 1), p("c", 3), p("b", 2)]);
    expect(merged.map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("空入力で空配列", () => {
    expect(mergePostsById()).toEqual([]);
    expect(mergePostsById([], [])).toEqual([]);
  });
});

describe("filterByHashtag", () => {
  function p(id: string, hashtags: string[]): FeedPost {
    return { id, pubkey: "pk", createdAt: 1, caption: "", imageUrls: [], imageUrl: null, hashtags };
  }
  const posts = [p("a", ["アガベ", "パキポ"]), p("b", ["植物"]), p("c", ["Agave"])];

  it("タグを含む投稿だけ返す", () => {
    expect(filterByHashtag(posts, "パキポ").map((x) => x.id)).toEqual(["a"]);
  });

  it("含まないタグは空", () => {
    expect(filterByHashtag(posts, "サボテン")).toEqual([]);
  });

  it("大小無視で一致する", () => {
    expect(filterByHashtag(posts, "agave").map((x) => x.id)).toEqual(["c"]);
    expect(filterByHashtag(posts, "AGAVE").map((x) => x.id)).toEqual(["c"]);
  });
});

describe("relativeTime", () => {
  it("1 分未満はたった今", () => {
    expect(relativeTime(1000, 1000)).toBe("たった今");
    expect(relativeTime(1000, 1059)).toBe("たった今");
  });

  it("分前（境界 60 秒）", () => {
    expect(relativeTime(0, 60)).toBe("1分前");
    expect(relativeTime(0, 3 * 60)).toBe("3分前");
    expect(relativeTime(0, 59 * 60 + 59)).toBe("59分前");
  });

  it("時間前（境界 3600 秒）", () => {
    expect(relativeTime(0, 3600)).toBe("1時間前");
    expect(relativeTime(0, 5 * 3600)).toBe("5時間前");
    expect(relativeTime(0, 23 * 3600 + 3599)).toBe("23時間前");
  });

  it("日前（境界 86400 秒）", () => {
    expect(relativeTime(0, 86400)).toBe("1日前");
    expect(relativeTime(0, 7 * 86400)).toBe("7日前");
  });

  it("未来はたった今に丸める", () => {
    expect(relativeTime(2000, 1000)).toBe("たった今");
  });
});
