import { describe, expect, it } from "vitest";
import {
  buildDeletionEvent,
  buildNip98AuthEvent,
  buildNoteTemplate,
  buildProfileEvent,
} from "./events.ts";

describe("buildDeletionEvent", () => {
  it("kind=5 で対象イベントを e タグに列挙する", () => {
    const t = buildDeletionEvent(["aaa", "bbb"], "", 1700000000);
    expect(t.kind).toBe(5);
    expect(t.tags).toEqual([
      ["e", "aaa"],
      ["e", "bbb"],
    ]);
    expect(t.content).toBe("");
  });

  it("対象が空なら throw", () => {
    expect(() => buildDeletionEvent([])).toThrow();
  });
});

describe("buildProfileEvent", () => {
  it("kind=0 で content に name の JSON を入れる", () => {
    const t = buildProfileEvent({ name: "  カコ栽培家  " }, 1700000000);
    expect(t.kind).toBe(0);
    expect(JSON.parse(t.content)).toEqual({ name: "カコ栽培家" });
    expect(t.tags).toEqual([]);
  });

  it("picture/about/websites を載せる（websites は [{url}] 形式）", () => {
    const t = buildProfileEvent(
      {
        name: "カコ",
        picture: "  https://img.example/a.png  ",
        about: "  植物すき  ",
        websites: ["https://github.com/kako-jun", "  ", "https://llll-ll.com"],
      },
      1700000000,
    );
    expect(JSON.parse(t.content)).toEqual({
      name: "カコ",
      picture: "https://img.example/a.png",
      about: "植物すき",
      websites: [{ url: "https://github.com/kako-jun" }, { url: "https://llll-ll.com" }],
    });
  });

  it("空（trim後）の付加項目は JSON に入れない", () => {
    const t = buildProfileEvent({ name: "カコ", picture: "  ", about: "", websites: ["", "  "] });
    expect(JSON.parse(t.content)).toEqual({ name: "カコ" });
  });

  it("http(s) でない picture/websites は落とす（危険スキーム・壊れURL防止）", () => {
    const t = buildProfileEvent({
      name: "カコ",
      picture: "javascript:alert(1)",
      websites: ["data:text/html,x", "ftp://foo", "/relative", "https://ok.example"],
    });
    expect(JSON.parse(t.content)).toEqual({ name: "カコ", websites: [{ url: "https://ok.example" }] });
  });

  it("空名は throw", () => {
    expect(() => buildProfileEvent({ name: "   " })).toThrow();
  });
});

describe("buildNoteTemplate", () => {
  it("kind=1 で自動タグのみを付ける（本文 # は t タグ化しない）", () => {
    const t = buildNoteTemplate({ caption: "開花した #アガベ", createdAt: 1700000000 });
    expect(t.kind).toBe(1);
    expect(t.tags).toEqual([
      ["t", "mypace"],
      ["t", "hanoba"],
      ["client", "hanoba"],
    ]);
    // 本文の #アガベ は content に残るだけで、t タグには出ない
    expect(t.tags.some((tag) => tag[0] === "t" && tag[1] === "アガベ")).toBe(false);
  });

  it("画像 URL をインラインのプレーン URL で content に連結する", () => {
    const t = buildNoteTemplate({
      caption: "開花した #アガベ",
      imageUrls: ["https://image.nostr.build/xxx.jpg"],
      createdAt: 1700000000,
    });
    expect(t.content).toBe("開花した #アガベ\nhttps://image.nostr.build/xxx.jpg");
  });

  it("複数の画像 URL を改行で連結する", () => {
    const t = buildNoteTemplate({
      caption: "成長記録",
      imageUrls: ["https://image.nostr.build/a.jpg", "https://image.nostr.build/b.jpg"],
    });
    expect(t.content).toBe("成長記録\nhttps://image.nostr.build/a.jpg\nhttps://image.nostr.build/b.jpg");
  });

  it("imageUrls 省略時は caption（trim 済み）のみ", () => {
    const t = buildNoteTemplate({ caption: "  種まきした  " });
    expect(t.content).toBe("種まきした");
  });

  it("imageUrls が空配列なら caption のみ", () => {
    const t = buildNoteTemplate({ caption: "一言だけ", imageUrls: [] });
    expect(t.content).toBe("一言だけ");
  });

  it("createdAt を反映する", () => {
    const t = buildNoteTemplate({ caption: "x", createdAt: 1234567890 });
    expect(t.created_at).toBe(1234567890);
  });

  it("createdAt 省略時は現在時刻（秒）を入れる", () => {
    const before = Math.floor(Date.now() / 1000);
    const t = buildNoteTemplate({ caption: "x" });
    const after = Math.floor(Date.now() / 1000);
    expect(t.created_at).toBeGreaterThanOrEqual(before);
    expect(t.created_at).toBeLessThanOrEqual(after);
  });

  it("空の caption は throw する（一言必須）", () => {
    expect(() => buildNoteTemplate({ caption: "" })).toThrow();
  });

  it("空白のみの caption は throw する", () => {
    expect(() => buildNoteTemplate({ caption: "   \n\t " })).toThrow();
  });
});

describe("buildNip98AuthEvent", () => {
  it("kind=27235・u/method タグ・content 空で構築する", () => {
    const t = buildNip98AuthEvent("https://nostr.build/api/v2/upload/files", "POST", 1700000000);
    expect(t.kind).toBe(27235);
    expect(t.tags).toEqual([
      ["u", "https://nostr.build/api/v2/upload/files"],
      ["method", "POST"],
    ]);
    expect(t.content).toBe("");
    expect(t.created_at).toBe(1700000000);
  });
});
