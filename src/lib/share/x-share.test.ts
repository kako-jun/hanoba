import { describe, expect, it } from "vitest";
import { nip19 } from "nostr-tools";
import {
  buildNjumpPermalink,
  buildXShareParts,
  buildXShareWhole,
  getXIntentUrl,
  weightedLengthX,
} from "./x-share.ts";

describe("weightedLengthX", () => {
  it("ASCII/ラテンは重み1", () => {
    expect(weightedLengthX("hello")).toBe(5);
    expect(weightedLengthX("abc 123!")).toBe(8);
  });

  it("CJK・絵文字は重み2", () => {
    expect(weightedLengthX("あいう")).toBe(6); // 3 文字 × 2
    expect(weightedLengthX("漢字")).toBe(4); // 2 文字 × 2
    expect(weightedLengthX("🌱")).toBe(2); // 絵文字 1 つ = 2
  });

  it("URL は実長に関わらず固定 23 として加算", () => {
    expect(weightedLengthX("https://njump.me/nevent1abc")).toBe(23);
    // 非常に長い URL でも 23。
    expect(weightedLengthX("https://example.com/" + "a".repeat(200))).toBe(23);
    // 本文 + URL: "hi " (3) + URL (23) = 26。
    expect(weightedLengthX("hi https://example.com/x")).toBe(26);
  });

  it("複数 URL はそれぞれ 23", () => {
    expect(weightedLengthX("https://a.com/x https://b.com/y")).toBe(23 + 1 + 23);
  });
});

describe("buildXShareParts — 単一パート（採番なし）", () => {
  it("短い caption は1パートで採番が付かない", () => {
    const parts = buildXShareParts("アガベ かわいい", [], "");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe("アガベ かわいい");
    expect(parts[0]).not.toMatch(/\(\d+\/\d+\)/);
  });

  it("パーマリンクは末尾に \\n\\n 区切りで付く", () => {
    const parts = buildXShareParts("葉が出た", [], "https://njump.me/nevent1xyz");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe("葉が出た\n\nhttps://njump.me/nevent1xyz");
  });

  it("ハッシュタグは先頭パートに付く", () => {
    const parts = buildXShareParts("メモ", ["アガベ", "塊根"], "");
    expect(parts[0]).toBe("メモ\n\n#アガベ #塊根");
  });

  it("caption が空（写真のみ）ならパーマリンク単体＝先頭に空行を付けない", () => {
    const parts = buildXShareParts("", [], "https://njump.me/nevent1none");
    expect(parts).toHaveLength(1);
    // 先頭に \n\n を残さない（区切りは本文が空のとき付けない）。
    expect(parts[0]).toBe("https://njump.me/nevent1none");
    expect(parts[0]!.startsWith("\n")).toBe(false);
  });

  it("空白だけの caption もトリムされ、パーマリンク単体になる", () => {
    const parts = buildXShareParts("   \n\n  ", [], "https://njump.me/nevent1ws");
    expect(parts).toHaveLength(1);
    expect(parts[0]).toBe("https://njump.me/nevent1ws");
  });

  it("caption も permalink も空なら空文字1件（先頭空行なし）", () => {
    const parts = buildXShareParts("", [], "");
    expect(parts).toEqual([""]);
  });
});

describe("buildXShareParts — 複数パート分割と採番", () => {
  // 280 weighted を確実に超える長文を CJK で作る（全文字重み2）。
  const longCjk = "あ".repeat(200); // weighted 400 > 280

  it("長文は複数パートに割れ、各パートに (N/総数) が付く", () => {
    const parts = buildXShareParts(longCjk, [], "");
    expect(parts.length).toBeGreaterThan(1);
    const total = parts.length;
    parts.forEach((part, i) => {
      expect(part.startsWith(`(${i + 1}/${total})\n`)).toBe(true);
    });
  });

  it("各パートは X の加重長制限（280）に収まる", () => {
    const parts = buildXShareParts(longCjk, ["タグ"], "https://njump.me/nevent1long");
    for (const part of parts) {
      expect(weightedLengthX(part)).toBeLessThanOrEqual(280);
    }
  });

  it("ハッシュタグは先頭パートのみ、パーマリンクは最終パートのみ", () => {
    const parts = buildXShareParts(longCjk, ["アガベ"], "https://njump.me/nevent1tail");
    expect(parts.length).toBeGreaterThan(1);
    // 先頭パートにだけハッシュタグ。
    expect(parts[0]).toContain("#アガベ");
    for (const part of parts.slice(1)) {
      expect(part).not.toContain("#アガベ");
    }
    // 最終パートにだけパーマリンク。
    const last = parts[parts.length - 1]!;
    expect(last).toContain("https://njump.me/nevent1tail");
    for (const part of parts.slice(0, -1)) {
      expect(part).not.toContain("https://njump.me/nevent1tail");
    }
  });
});

describe("buildXShareParts — 区切り優先度", () => {
  it("空行（段落区切り）を優先して切る", () => {
    // 各段落 200 文字 CJK（weighted 400）。連結して空行で割れるはず。
    const a = "ア".repeat(120);
    const b = "イ".repeat(120);
    const parts = buildXShareParts(`${a}\n\n${b}`, [], "");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    // 先頭パートは a 由来の文字だけ（イが混ざらない＝空行で割れた）。
    const firstBody = parts[0]!.replace(/^\(\d+\/\d+\)\n/, "");
    expect(firstBody.startsWith("ア")).toBe(true);
    expect(firstBody).not.toContain("イ");
  });

  it("改行で切る（空行が無い場合）", () => {
    const a = "カ".repeat(120);
    const b = "キ".repeat(120);
    const parts = buildXShareParts(`${a}\n${b}`, [], "");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    const firstBody = parts[0]!.replace(/^\(\d+\/\d+\)\n/, "");
    expect(firstBody).not.toContain("キ");
  });

  it("句読点で切る（改行が無い場合）", () => {
    // 句点を挟んだ長文。改行が無いので句読点境界で切れる。
    const a = "サ".repeat(120);
    const b = "シ".repeat(120);
    const parts = buildXShareParts(`${a}。${b}。`, [], "");
    expect(parts.length).toBeGreaterThanOrEqual(2);
    // 先頭パートは句点で終わる（。の直後で切る）。
    const firstBody = parts[0]!.replace(/^\(\d+\/\d+\)\n/, "");
    expect(firstBody.endsWith("。")).toBe(true);
  });

  it("区切りが無い長文は強制分割される", () => {
    const parts = buildXShareParts("ナ".repeat(300), [], "");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(weightedLengthX(part)).toBeLessThanOrEqual(280);
    }
  });
});

describe("buildXShareParts — 書記素安全（絵文字を割らない）", () => {
  it("ZWJ 絵文字（👨‍👩‍👧‍👦）を分割境界で割らない", () => {
    const family = "👨‍👩‍👧‍👦";
    // family を大量に並べて確実に分割させる。
    const content = family.repeat(60);
    const parts = buildXShareParts(content, [], "");
    expect(parts.length).toBeGreaterThan(1);
    // 各パート本文（採番除く）を連結すると、family の整数個に分割されているはず＝
    // 半端な ZWJ シーケンスが残らない。各パート本文は family の繰り返しのみで構成される。
    for (const part of parts) {
      const body = part.replace(/^\(\d+\/\d+\)\n/, "");
      // family を全部除去したら空になる＝family が割れていない。
      const stripped = body.split(family).join("");
      expect(stripped).toBe("");
    }
  });

  it("肌色修飾子つき絵文字（👍🏽）を割らない", () => {
    const thumb = "👍🏽";
    const content = thumb.repeat(100);
    const parts = buildXShareParts(content, [], "");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      const body = part.replace(/^\(\d+\/\d+\)\n/, "");
      expect(body.split(thumb).join("")).toBe("");
    }
  });
});

describe("buildXShareWhole — 全文（無分割）", () => {
  it("長文でも分割せず1本に組み立てる（採番なし）", () => {
    const whole = buildXShareWhole("あ".repeat(300), ["タグ"], "https://njump.me/nevent1w");
    expect(whole).not.toMatch(/\(\d+\/\d+\)/);
    expect(whole).toContain("#タグ");
    expect(whole).toContain("https://njump.me/nevent1w");
    // 加重長は 280 を超えていてよい（X 側で切り詰めても本人が編集できる原文）。
    expect(weightedLengthX(whole)).toBeGreaterThan(280);
  });
});

describe("getXIntentUrl", () => {
  it("text を encodeURIComponent して intent URL を作る", () => {
    const url = getXIntentUrl("こんにちは #植物");
    expect(url.startsWith("https://twitter.com/intent/tweet?text=")).toBe(true);
    expect(url).toContain(encodeURIComponent("こんにちは #植物"));
  });
});

describe("buildNjumpPermalink", () => {
  const id = "e".repeat(64);
  const pubkey = "a".repeat(64);

  it("nevent を作り https://njump.me/nevent1... を返す", () => {
    const url = buildNjumpPermalink({ id, pubkey });
    expect(url.startsWith("https://njump.me/nevent1")).toBe(true);
    // 戻り URL の nevent を復号して id/author が一致することを確認。
    const nevent = url.replace("https://njump.me/", "");
    const decoded = nip19.decode(nevent);
    expect(decoded.type).toBe("nevent");
    if (decoded.type === "nevent") {
      expect(decoded.data.id).toBe(id);
      expect(decoded.data.author).toBe(pubkey);
      expect((decoded.data.relays ?? []).length).toBeGreaterThan(0);
    }
  });

  it("壊れた id（nevent 不能）でも空にせずフォールバックを試みる", () => {
    // 64hex でない id は neventEncode で throw → note へフォールバック（note も throw なら空）。
    const url = buildNjumpPermalink({ id: "not-hex", pubkey });
    // note も hex を要求するため空文字になる（リンク無し）。クラッシュしないことが要点。
    expect(typeof url).toBe("string");
  });

  it("空の id は encode せず空文字を返す（nevent1qqqq... の偽リンクを出さない）", () => {
    // nip19.neventEncode({id:""}) は throw せず見た目だけ正しい nevent を作る＝
    // njump で何も指さない壊れたリンクになる。エンコード前に 64hex で弾く。
    expect(buildNjumpPermalink({ id: "", pubkey })).toBe("");
  });

  it("63桁 hex（長さ不足）は空文字を返す", () => {
    expect(buildNjumpPermalink({ id: "e".repeat(63), pubkey })).toBe("");
  });

  it("大文字 hex（小文字でない）は空文字を返す", () => {
    expect(buildNjumpPermalink({ id: "E".repeat(64), pubkey })).toBe("");
  });

  it("正しい 64桁小文字 hex なら https://njump.me/nevent1... を返す", () => {
    expect(buildNjumpPermalink({ id, pubkey }).startsWith("https://njump.me/nevent1")).toBe(true);
  });
});
