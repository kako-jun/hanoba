import { describe, expect, it } from "vitest";
import {
  buildDeletionEvent,
  buildNip98AuthEvent,
  buildNoteTemplate,
  buildProfileEvent,
  buildReplyTemplate,
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

  it("好きな品種を favorite_varieties に載せる（trim・空除去・dedupe・#141）", () => {
    const t = buildProfileEvent({
      name: "カコ",
      favoriteVarieties: ["グラキリス", "  チタノタ  ", "", "グラキリス"],
    });
    expect(JSON.parse(t.content)).toEqual({ name: "カコ", favorite_varieties: ["グラキリス", "チタノタ"] });
  });

  it("好きな品種が空なら favorite_varieties を載せない（#141）", () => {
    const t = buildProfileEvent({ name: "カコ", favoriteVarieties: ["", "  "] });
    expect(JSON.parse(t.content)).toEqual({ name: "カコ" });
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
      ["t", "plantstr"],
      ["client", "hanoba"],
    ]);
    // 本文の #アガベ は content に残るだけで、t タグには出ない
    expect(t.tags.some((tag) => tag[0] === "t" && tag[1] === "アガベ")).toBe(false);
  });

  it("画像 URL をインラインのプレーン URL で content に連結する（caption と URL の間に #plantstr を併記・#408）", () => {
    const t = buildNoteTemplate({
      caption: "開花した #アガベ",
      imageUrls: ["https://image.nostr.build/xxx.jpg"],
      createdAt: 1700000000,
    });
    expect(t.content).toBe("開花した #アガベ #plantstr\nhttps://image.nostr.build/xxx.jpg");
  });

  it("本文 caption 末尾に #plantstr を自動併記する（画像なし・#408）", () => {
    const t = buildNoteTemplate({ caption: "開花した", createdAt: 1700000000 });
    expect(t.content).toBe("開花した #plantstr");
  });

  it("#plantstr は caption と画像 URL の間（URL より前）に来る（#408）", () => {
    const t = buildNoteTemplate({
      caption: "成長記録",
      imageUrls: ["https://image.nostr.build/a.jpg", "https://image.nostr.build/b.jpg"],
      createdAt: 1700000000,
    });
    expect(t.content).toBe("成長記録 #plantstr\nhttps://image.nostr.build/a.jpg\nhttps://image.nostr.build/b.jpg");
    // URL より前に #plantstr が出る。
    expect(t.content.indexOf("#plantstr")).toBeLessThan(t.content.indexOf("https://"));
  });

  it("caption に既に #plantstr があれば二重化しない（手書き尊重・#408）", () => {
    const t = buildNoteTemplate({ caption: "開花した #plantstr", createdAt: 1700000000 });
    expect(t.content).toBe("開花した #plantstr");
    // #plantstr は1回だけ。
    expect(t.content.match(/#plantstr/gi)?.length).toBe(1);
  });

  it("#plantstrong など部分一致は別語＝#plantstr を付け損ねない（=== 完全一致ガード・#408 review）", () => {
    const t = buildNoteTemplate({ caption: "強い植物 #plantstrong", createdAt: 1700000000 });
    // 部分一致（plantstrong）は別語なので #plantstr を併記する（付け損ねない）。
    expect(t.content).toBe("強い植物 #plantstrong #plantstr");
  });

  it("caption の #Plantstr など大小違いも重複扱いで足さない（#408）", () => {
    const t = buildNoteTemplate({
      caption: "開花した #Plantstr",
      imageUrls: ["https://image.nostr.build/xxx.jpg"],
      createdAt: 1700000000,
    });
    expect(t.content).toBe("開花した #Plantstr\nhttps://image.nostr.build/xxx.jpg");
    // #plantstr 系は手書きの1つだけ（小文字版を足さない）。
    expect(t.content.match(/#plantstr/gi)?.length).toBe(1);
  });

  it("写真ごとの撮影日を位置配列タグ shot_dates に載せる（imageUrls 順・無い位置は空文字・#324）", () => {
    const t = buildNoteTemplate({
      caption: "記録",
      // 3枚目は不正→""、null→""。位置は imageUrls と1:1。
      photoShotDates: ["2024-06-15", null, "2024/06/17", "2024-06-22"],
      createdAt: 1700000000,
    });
    const shot = t.tags.find((tag) => tag[0] === "shot_dates");
    expect(shot).toEqual(["shot_dates", "2024-06-15", "", "", "2024-06-22"]);
    // 自動タグは保つ。
    expect(t.tags).toContainEqual(["t", "hanoba"]);
  });

  it("末尾の空（日付の無い末尾写真）は落とす＝読み側は足りない位置を null 扱い（#324）", () => {
    const t = buildNoteTemplate({
      caption: "記録",
      photoShotDates: ["2024-06-15", null, null],
    });
    const shot = t.tags.find((tag) => tag[0] === "shot_dates");
    expect(shot).toEqual(["shot_dates", "2024-06-15"]);
  });

  it("撮影日が1つも無ければ shot_dates タグは付けない（#324）", () => {
    expect(buildNoteTemplate({ caption: "記録" }).tags.some((tag) => tag[0] === "shot_dates")).toBe(false);
    expect(
      buildNoteTemplate({ caption: "記録", photoShotDates: [null, null] }).tags.some((tag) => tag[0] === "shot_dates"),
    ).toBe(false);
  });

  it("複数の画像 URL を改行で連結する（caption の後・#plantstr の後）", () => {
    const t = buildNoteTemplate({
      caption: "成長記録",
      imageUrls: ["https://image.nostr.build/a.jpg", "https://image.nostr.build/b.jpg"],
    });
    expect(t.content).toBe("成長記録 #plantstr\nhttps://image.nostr.build/a.jpg\nhttps://image.nostr.build/b.jpg");
  });

  it("imageUrls 省略時は caption（trim 済み）＋#plantstr のみ", () => {
    const t = buildNoteTemplate({ caption: "  種まきした  " });
    expect(t.content).toBe("種まきした #plantstr");
  });

  it("imageUrls が空配列なら caption＋#plantstr のみ", () => {
    const t = buildNoteTemplate({ caption: "一言だけ", imageUrls: [] });
    expect(t.content).toBe("一言だけ #plantstr");
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

describe("buildReplyTemplate", () => {
  it("kind=1・content は trim・親を e タグの root に印付ける（#142）", () => {
    const t = buildReplyTemplate("  いい色ですね  ", "parent123", 1700000000);
    expect(t.kind).toBe(1);
    expect(t.content).toBe("いい色ですね");
    expect(t.created_at).toBe(1700000000);
    expect(t.tags).toEqual([
      ["e", "parent123", "", "root"],
      ["t", "mypace"],
      ["client", "hanoba"],
    ]);
  });

  it("p タグ（@呼びかけ）を一切付けない（仕様・#142）", () => {
    const t = buildReplyTemplate("こんにちは", "parent123");
    expect(t.tags.some((tag) => tag[0] === "p")).toBe(false);
  });

  it("t:hanoba を付けない（コメントは hanoba フィード/タグ集計を汚さない・#142）", () => {
    const t = buildReplyTemplate("コメント", "parent123");
    expect(t.tags.some((tag) => tag[0] === "t" && tag[1] === "hanoba")).toBe(false);
    // mypace と client は付く。
    expect(t.tags.some((tag) => tag[0] === "t" && tag[1] === "mypace")).toBe(true);
    expect(t.tags.some((tag) => tag[0] === "client" && tag[1] === "hanoba")).toBe(true);
  });

  it("t:plantstr を付けない（#383 の plantstr 自動付与はポスト限定＝reply には波及しない）", () => {
    const t = buildReplyTemplate("コメント", "parent123");
    expect(t.tags.some((tag) => tag[0] === "t" && tag[1] === "plantstr")).toBe(false);
  });

  it("createdAt 省略時は現在時刻（秒）を入れる", () => {
    const before = Math.floor(Date.now() / 1000);
    const t = buildReplyTemplate("x", "parent123");
    const after = Math.floor(Date.now() / 1000);
    expect(t.created_at).toBeGreaterThanOrEqual(before);
    expect(t.created_at).toBeLessThanOrEqual(after);
  });

  it("空（空白のみ）の content は throw する", () => {
    expect(() => buildReplyTemplate("", "parent123")).toThrow();
    expect(() => buildReplyTemplate("   \n\t ", "parent123")).toThrow();
  });

  it("parentEventId が空なら throw する", () => {
    expect(() => buildReplyTemplate("コメント", "")).toThrow();
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
