import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { timeOfDay } from "./timeOfDay.ts";
import { solarPhase } from "./solarPhase.ts";

// inline script ⇔ 純関数 の parity 回帰テスト（#231）。
//
// MainLayout.astro の <head> inline script は flash 回避のため timeOfDay.ts / solarPhase.ts と
// 同じバケット境界を直書きしている（is:inline は Vite を通らず import 不可なため）。境界がどちらか
// 一方だけズレると「描画前の値（inline）と島の再設定値（lib）」が食い違い、本番でフラッシュとして
// 顕在化する。inline の実際の三項演算式を取り出して lib と全入力で突き合わせ、ドリフトを検出する。

// vitest の cwd はリポジトリルート。MainLayout.astro を直接読む。
const LAYOUT = readFileSync(join(process.cwd(), "src/layouts/MainLayout.astro"), "utf8");

/** inline script から三項演算式を取り出す（式に固有の開始マーカー〜終端リテラルで一意に切る）。 */
function extractExpr(startMarker: string, endLiteral: string): string {
  const re = new RegExp(`(${startMarker}[\\s\\S]*?:\\s*"${endLiteral}")`);
  const expr = LAYOUT.match(re)?.[1];
  if (expr === undefined) throw new Error(`inline script に "${startMarker}…${endLiteral}" の式が見つからない`);
  return expr;
}

describe("inline script ⇔ lib の境界 parity", () => {
  it("時間帯（t の三項）が timeOfDay.ts と全時で一致", () => {
    const expr = extractExpr("h < 5", "evening");
    const inlineTime = new Function("h", `return (${expr});`) as (h: number) => string;
    for (let h = 0; h < 24; h++) {
      expect(inlineTime(h), `h=${h}`).toBe(timeOfDay(h));
    }
  });

  it("八節（s の三項）が solarPhase.ts と全月日で一致", () => {
    const expr = extractExpr("md >= 1222", "ritto");
    const inlineSekki = new Function("md", `return (${expr});`) as (md: number) => string;
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const md = month * 100 + day;
        expect(inlineSekki(md), `${month}/${day}`).toBe(solarPhase(month, day));
      }
    }
  });

  it("inline の PHASES 配列が solarPhase.ts の順と一致", () => {
    const body = LAYOUT.match(/PHASES\s*=\s*\[([^\]]*)\]/)?.[1] ?? "";
    const inlinePhases = (body.match(/"([a-z]+)"/g) ?? []).map((s) => s.replace(/"/g, ""));
    expect(inlinePhases).toEqual(["risshun", "shunbun", "rikka", "geshi", "risshu", "shubun", "ritto", "toji"]);
  });
});
