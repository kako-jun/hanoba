import { describe, expect, it } from "vitest";
import { detectPlants } from "./detect.ts";

function ids(text: string): string[] {
  return detectPlants(text).map((p) => p.id);
}

describe("detectPlants", () => {
  it("俗称（カナ）から学名エントリを引く", () => {
    const [p] = detectPlants("今日のアガベ、いい感じ");
    expect(p?.id).toBe("agave");
    expect(p?.sci).toBe("Agave");
    expect(p?.name).toBe("アガベ");
  });

  it("略称でも引く（パキポ → パキポディウム）", () => {
    expect(ids("うちのパキポ")).toContain("pachypodium");
  });

  it("英語表記でも引く（大小無視）", () => {
    expect(ids("my MONSTERA deliciosa")).toContain("monstera");
  });

  it("別の俗称でも同じ植物に当たる（コウモリラン → ビカクシダ）", () => {
    expect(ids("コウモリラン育成中")).toEqual(["platycerium"]);
  });

  it("タグ（#付き）の語でも反応する", () => {
    expect(ids("開花 #ビカクシダ")).toContain("platycerium");
  });

  it("文中に複数並んでいたら全部拾う", () => {
    const got = ids("モンステラとアガベとガジュマル");
    expect(got).toEqual(["agave", "monstera", "ficus-microcarpa"]); // 辞書順
  });

  it("同一植物は別名が複数当たっても 1 件に畳む", () => {
    expect(ids("サンスベリア＝サンセベリア＝トラノオ")).toEqual(["sansevieria"]);
  });

  it("該当しなければ空", () => {
    expect(detectPlants("ただの石ころ")).toEqual([]);
  });

  it("誤字はサポートしない（別名にない綴りは拾わない）", () => {
    expect(detectPlants("もんすてら")).toEqual([]); // ひらがな表記は別名に無い＝拾わない
  });

  it("空文字は空", () => {
    expect(detectPlants("")).toEqual([]);
  });

  it("曖昧な短い別名による誤爆を避ける（フィロソフィー → フィロデンドロンにしない）", () => {
    expect(detectPlants("植物のフィロソフィー")).toEqual([]);
  });

  it("ラテン別名は語境界で照合し、語の一部では誤爆しない", () => {
    expect(detectPlants("agavextract serum")).toEqual([]); // "agave" を含むが語ではない
    expect(ids("I grow agave at home")).toContain("agave"); // 語としてなら拾う
  });
});
