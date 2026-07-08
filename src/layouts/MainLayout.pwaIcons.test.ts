import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// #511: #478 で theme_color を上げたとき PWA アイコンの URL を据え置いたため WebAPK が
// 焼き直されず、スプラッシュ上端の枠が残った。本質は「PWA アイコンの版数サフィックスが
// 3ソース（manifest = astro.config.mjs / apple-touch = MainLayout.astro / 生成スクリプト =
// scripts/generate-icons.mjs）でドリフトし、参照先が古い/不在になる」設定整合の事故。
//
// このリポには .astro / astro.config を直接評価するテストインフラが無い（icons は AstroPWA
// factory の引数に飲まれて露出しない）。既存 MainLayout.headSlot.test.ts と同じく
// 3ソースとも fs でソーステキストを読み、正規表現で抽出して静的に守る。
// 実在確認は常在の public/（コミット済み）を読む＝未ビルドの dist/ に依存しない。
// 期待版数（-v3）はハードコードせず「3ソース間で版数が一致する」関係だけを縛る＝
// 将来 v4 に上げてもテスト不変で、かつ「片方だけ上げ忘れ」を赤にできる。

const configSrc = readFileSync(join(import.meta.dirname, "..", "..", "astro.config.mjs"), "utf8");
const layoutSrc = readFileSync(join(import.meta.dirname, "MainLayout.astro"), "utf8");
const iconScriptSrc = readFileSync(join(import.meta.dirname, "..", "..", "scripts", "generate-icons.mjs"), "utf8");
const publicDir = join(import.meta.dirname, "..", "..", "public");

/** astro.config.mjs の manifest.icons 配列ブロックの中身（角括弧の内側）を文字列で返す。 */
function manifestIconsBlock(): string {
  const block = configSrc.match(/icons:\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error("astro.config.mjs に manifest.icons 配列が見つからない");
  return block[1];
}

/** astro.config.mjs の manifest.icons 配列から src 値を全抽出する（SVG も typo 検知目的で含める）。 */
function manifestIconSrcs(): string[] {
  return [...manifestIconsBlock().matchAll(/src:\s*["']([^"']+)["']/g)].map((m) => m[1]);
}

/** MainLayout.astro の rel="apple-touch-icon" の href を抽出する（属性順に依存しない）。 */
function appleTouchHref(): string {
  const linkTags = layoutSrc.match(/<link\b[^>]*\/?>/g) ?? [];
  const tag = linkTags.find((t) => t.includes('rel="apple-touch-icon"'));
  if (!tag) throw new Error("MainLayout.astro に apple-touch-icon の <link> が見つからない");
  const href = tag.match(/href="([^"]+)"/);
  if (!href) throw new Error("apple-touch-icon の <link> に href が無い");
  return href[1];
}

/** generate-icons.mjs の jobs 配列に並ぶ出力ファイル名（.png）を全抽出する。 */
function iconScriptJobFilenames(): string[] {
  const block = iconScriptSrc.match(/const jobs = \[([\s\S]*?)\];/);
  if (!block) throw new Error("generate-icons.mjs に jobs 配列が見つからない");
  return [...block[1].matchAll(/["']([^"']+\.png)["']/g)].map((m) => m[1]);
}

/** 文字列群から版数サフィックス（-vN）の N を数値で全収集する（-v を持たない SVG 等は無視）。 */
function versionsOf(strings: string[]): number[] {
  return strings.flatMap((s) => [...s.matchAll(/-v(\d+)/g)].map((m) => Number(m[1])));
}

describe("PWA アイコンの参照先が public/ に実在する（#511）", () => {
  it("manifest.icons の各 src が public/ に実在する（typo 検知）", () => {
    const srcs = manifestIconSrcs();
    expect(srcs.length, "manifest.icons が空").toBeGreaterThan(0);
    for (const src of srcs) {
      const filename = src.replace(/^\//, "");
      expect(existsSync(join(publicDir, filename)), `${src} -> public/${filename}`).toBe(true);
    }
  });

  it("apple-touch-icon の href が public/ に実在する（typo 検知）", () => {
    const href = appleTouchHref();
    const filename = href.replace(/^\//, "");
    expect(existsSync(join(publicDir, filename)), `${href} -> public/${filename}`).toBe(true);
  });
});

describe("PWA アイコン版数の 3ソース整合（#511 ドリフト検出）", () => {
  it("manifest・apple-touch・生成スクリプトの版数サフィックスが全一致する", () => {
    const configVersions = versionsOf(manifestIconSrcs());
    const layoutVersions = versionsOf([appleTouchHref()]);
    const scriptVersions = versionsOf(iconScriptJobFilenames());
    // 各ソースが実際に版数を出していること（抽出失敗で偽の緑にしない）。
    expect(configVersions.length, "manifest から版数が採れない").toBeGreaterThan(0);
    expect(layoutVersions.length, "apple-touch から版数が採れない").toBeGreaterThan(0);
    expect(scriptVersions.length, "generate-icons から版数が採れない").toBeGreaterThan(0);
    const versions = new Set([...configVersions, ...layoutVersions, ...scriptVersions]);
    expect([...versions], `版数が割れている: ${[...versions].join(", ")}`).toHaveLength(1);
  });

  it("3ソースのどこにも旧版数が残っていない（コメント含む・取りこぼし検出）", () => {
    // 現行版数 = 実在ファイルの正本である生成スクリプトの jobs 出力ファイル名から採る。
    const current = [...new Set(versionsOf(iconScriptJobFilenames()))];
    expect(current, "生成スクリプトの版数が単一でない").toHaveLength(1);
    const currentVersion = current[0];

    // 昇版例コメント（「-vN → -vM」）は将来版を意図的に含むので走査対象から除く。
    // 「→」で 2 つ以上連なる版数チェーン（-v3 → -v4 → -v5）を丸ごと除く＝末尾版数の取りこぼしを防ぐ。
    const stripUpgradeExamples = (s: string) => s.replace(/-v\d+(?:\s*→\s*-v\d+)+/g, "");

    const sources: readonly [label: string, src: string][] = [
      ["astro.config.mjs", configSrc],
      ["MainLayout.astro", layoutSrc],
      ["generate-icons.mjs", iconScriptSrc],
    ];
    for (const [label, src] of sources) {
      const found = versionsOf([stripUpgradeExamples(src)]);
      for (const v of found) {
        expect(v, `${label} に旧版数 -v${v} が残存（現行 -v${currentVersion}）`).toBe(currentVersion);
      }
    }
  });
});

describe("manifest.icons に枠を生む maskable/SVG を持たない（#513 スプラッシュ枠再発防止）", () => {
  // #513: SVG（sizes=any）や maskable PNG を manifest.icons に足すと、Android スプラッシュが
  // アイコンを板／マスク付きに描いて極薄い四角い枠を生む。any PNG 2つだけの構成に絞って枠を
  // 消したので、将来またこの種のエントリが足されて枠が再発することをここで赤にして止める。
  it("purpose に maskable を含むエントリが存在しない", () => {
    const maskable = [...manifestIconsBlock().matchAll(/purpose:\s*["'][^"']*maskable[^"']*["']/g)];
    expect(maskable, "maskable アイコンは Android スプラッシュに四角い枠を生む（#513 で撤去済み）").toHaveLength(0);
  });

  it("SVG エントリを持たない（type 省略の .svg src も検出・枠再発防止）", () => {
    // type だけを見ると `{ src:"/icon.svg", sizes:"any", purpose:"any" }` のように type 省略で
    // 戻された SVG（ブラウザは拡張子から SVG と解釈する）を取りこぼす。type と src(.svg) の両方を縛る。
    const block = manifestIconsBlock();
    const byType = [...block.matchAll(/type:\s*["']image\/svg\+xml["']/g)];
    const bySrc = [...block.matchAll(/src:\s*["'][^"']*\.svg(?:[?#][^"']*)?["']/g)];
    expect(
      [...byType, ...bySrc],
      "SVG アイコンは Android スプラッシュで板状に描かれ枠を生む（#513 で撤去済み・type 省略の .svg src も含む）",
    ).toHaveLength(0);
  });
});

describe("maskable アセット/生成ジョブが物理的に復活していない（#515 撤去の回帰ガード）", () => {
  // #515: 未使用の maskable アイコン（icon-maskable.svg / icon-maskable-*.png）とその生成ジョブを撤去し、
  // apple-touch も含め全 PNG を icon.svg 1本由来に統一した。#513 ガードは manifest.icons 配列内の
  // maskable/SVG エントリ非在を守るが、こちらは別観点＝ディスク上の物理ファイルと生成器（jobs）に
  // maskable が再出現しないことを縛る。maskable アセットが復活すれば manifest に足す誘惑と枠再発の温床になる。
  it("public/ に maskable アイコンファイルが存在しない（icon-maskable.svg / icon-maskable-*.png の再出現を検出）", () => {
    const maskables = readdirSync(publicDir).filter((f) => /icon-maskable/.test(f));
    expect(maskables, `public/ に maskable アイコンが再出現（#515 で撤去済み）: ${maskables.join(", ")}`).toHaveLength(0);
  });

  it("generate-icons.mjs の生成ジョブに maskable 出力が無い", () => {
    const maskables = iconScriptJobFilenames().filter((f) => f.includes("maskable"));
    expect(maskables, `生成ジョブに maskable 出力が復活（#515 で撤去済み）: ${maskables.join(", ")}`).toHaveLength(0);
  });

  it("全 PNG 生成ジョブが単一の SVG ソース（anySvg = icon.svg）由来である", () => {
    // #515 の統一意図＝生成元を icon.svg 1本に絞る。jobs の各エントリ先頭のソース変数を採り、
    // すべて anySvg（= icon.svg 読み込み）であることを縛る。別ソース（maskable 専用 SVG 等）の復活を赤にする。
    const block = iconScriptSrc.match(/const jobs = \[([\s\S]*?)\];/);
    if (!block) throw new Error("generate-icons.mjs に jobs 配列が見つからない");
    const sources = [...block[1].matchAll(/\[\s*(\w+)\s*,/g)].map((m) => m[1]);
    expect(sources.length, "jobs からソース変数が採れない").toBeGreaterThan(0);
    expect([...new Set(sources)], `PNG 生成ソースが単一でない: ${sources.join(", ")}`).toEqual(["anySvg"]);
  });
});
