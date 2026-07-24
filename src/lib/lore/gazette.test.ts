import { describe, expect, it } from "vitest";
import { buildGazette, gazetteTitle } from "./gazette.ts";
import { DEFAULT_LOCALE } from "../i18n/locale.ts";

// 市政だより（#164/#533）のデータモデル。最古→最新の時間順で採番することを固定する。
describe("buildGazette（#164）", () => {
  it("6件を1〜6の連番ページで返す", () => {
    const articles = buildGazette("ja");
    expect(articles).toHaveLength(6);
    expect(articles.map((a) => a.page)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("公開日は昇順＝1ページ目が最古(2026-06-16)、6ページ目が最新(2026-07-18)", () => {
    const articles = buildGazette("ja");
    expect(articles.map((a) => a.date)).toEqual([
      "2026-06-16",
      "2026-06-18",
      "2026-06-22",
      "2026-07-09",
      "2026-07-10",
      "2026-07-18",
    ]);
  });

  it("idはlocaleを跨いで不変（安定IDでURL/localStorage永続化する前提）", () => {
    const ja = buildGazette("ja").map((a) => a.id);
    const en = buildGazette("en").map((a) => a.id);
    expect(en).toEqual(ja);
  });

  it("linksの件数は記事ごとに異なる（0/1/複数件を固定）", () => {
    const articles = buildGazette("ja");
    expect(articles.map((a) => a.links.length)).toEqual([1, 2, 0, 1, 1, 2]);
  });

  it("最新記事（id: load-more-feed・#554発表）のlinksは/discoverと/meを指し、ラベルも正しい", () => {
    const articles = buildGazette("ja");
    const latest = articles[5]!;
    expect(latest.id).toBe("load-more-feed");
    expect(latest.links).toEqual([
      { label: "みんなの植物を見る", href: "/discover" },
      { label: "あなたの植物を見る", href: "/me" },
    ]);
  });

  it("最新記事（6件目）はimageを持ち、それ以外は持たない", () => {
    const articles = buildGazette("ja");
    expect(articles.map((a) => a.image)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "/hanoba-gazette-more-view.webp",
    ]);
  });

  it("bodyは各記事2段落、closingは非空文字列", () => {
    const articles = buildGazette("ja");
    for (const article of articles) {
      expect(article.body).toHaveLength(2);
      expect(article.closing.length).toBeGreaterThan(0);
    }
  });

  it("引数省略時はDEFAULT_LOCALE(en)で構築される", () => {
    expect(buildGazette()).toEqual(buildGazette(DEFAULT_LOCALE));
  });

  it("gazetteTitle(locale)は空文字にならない", () => {
    for (const locale of ["ja", "en", "es", "zh"] as const) {
      expect(gazetteTitle(locale).length).toBeGreaterThan(0);
    }
  });
});
