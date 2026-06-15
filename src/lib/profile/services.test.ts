import { describe, expect, it } from "vitest";
import { detectServiceLabel, serviceIconName, toSiteLinks } from "./services.ts";

describe("detectServiceLabel", () => {
  it("グローバルサービスを判定する", () => {
    expect(detectServiceLabel("https://github.com/kako-jun")).toBe("GitHub");
    expect(detectServiceLabel("https://x.com/kako_jun_42")).toBe("X");
    expect(detectServiceLabel("https://twitter.com/foo")).toBe("X");
    expect(detectServiceLabel("https://youtu.be/abc")).toBe("YouTube");
    expect(detectServiceLabel("https://www.instagram.com/foo")).toBe("Instagram");
    expect(detectServiceLabel("https://bsky.app/profile/foo")).toBe("Bluesky");
    expect(detectServiceLabel("https://mstdn.jp/@foo")).toBe("Mastodon");
  });

  it("日本のサービスを判定する", () => {
    expect(detectServiceLabel("https://zenn.dev/kako_jun")).toBe("Zenn");
    expect(detectServiceLabel("https://note.com/foo")).toBe("note");
    expect(detectServiceLabel("https://www.pixiv.net/users/1")).toBe("Pixiv");
    expect(detectServiceLabel("https://booth.pm/ja/items/1")).toBe("BOOTH");
    expect(detectServiceLabel("https://qiita.com/foo")).toBe("Qiita");
  });

  it("大文字小文字を無視する", () => {
    expect(detectServiceLabel("https://GitHub.com/Foo")).toBe("GitHub");
  });

  it("該当しなければ Website", () => {
    expect(detectServiceLabel("https://llll-ll.com")).toBe("Website");
    expect(detectServiceLabel("https://example.org/blog")).toBe("Website");
  });

  it("ホスト名照合で誤爆しない（部分一致の穴を塞ぐ）", () => {
    // x.com を末尾に含む別ドメイン / クエリ・パスに紛れた文字列は X にしない。
    expect(detectServiceLabel("https://maxx.com/foo")).toBe("Website");
    expect(detectServiceLabel("https://example.com/?ref=x.com")).toBe("Website");
    // t.me / line.me / blog.jp を別ドメインのサブドメインに含んでも誤爆しない。
    expect(detectServiceLabel("https://foo.t.me.evil.com")).toBe("Website");
    expect(detectServiceLabel("https://notion.so/foo")).toBe("Notion"); // note.com と衝突しない
    expect(detectServiceLabel("https://note.com/foo")).toBe("note");
  });

  it("サブドメインは正しく拾う", () => {
    expect(detectServiceLabel("https://gist.github.com/foo")).toBe("GitHub");
    expect(detectServiceLabel("https://open.spotify.com/foo")).toBe("Spotify");
    expect(detectServiceLabel("https://foo.itch.io")).toBe("itch.io");
    expect(detectServiceLabel("https://store.steampowered.com/app/1")).toBe("Steam");
  });

  it("URL としてパースできなければ Website", () => {
    expect(detectServiceLabel("not a url")).toBe("Website");
    expect(detectServiceLabel("")).toBe("Website");
  });
});

describe("serviceIconName", () => {
  it("X は専用アイコン", () => {
    expect(serviceIconName("X")).toBe("x");
  });

  it("カテゴリに対応付ける", () => {
    expect(serviceIconName("GitHub")).toBe("github");
    expect(serviceIconName("GitLab")).toBe("code");
    expect(serviceIconName("YouTube")).toBe("youtube");
    expect(serviceIconName("Instagram")).toBe("instagram");
    expect(serviceIconName("Zenn")).toBe("writing");
    expect(serviceIconName("Pixiv")).toBe("art");
    expect(serviceIconName("Spotify")).toBe("music");
    expect(serviceIconName("BOOTH")).toBe("shopping");
    expect(serviceIconName("Steam")).toBe("game");
    expect(serviceIconName("Mastodon")).toBe("at");
    expect(serviceIconName("Discord")).toBe("chat");
    expect(serviceIconName("Ko-fi")).toBe("heart");
  });

  it("既定は link（地球＝個人サイト/汎用）", () => {
    expect(serviceIconName("Website")).toBe("link");
    expect(serviceIconName("LinkedIn")).toBe("link");
    expect(serviceIconName("Linktree")).toBe("link");
  });
});

describe("toSiteLinks", () => {
  it("URL 配列を表示用 SiteLink[] に整形する", () => {
    const links = toSiteLinks([
      "https://github.com/kako-jun",
      "https://llll-ll.com",
    ]);
    expect(links).toEqual([
      { url: "https://github.com/kako-jun", label: "GitHub", icon: "github" },
      { url: "https://llll-ll.com", label: "Website", icon: "link" },
    ]);
  });

  it("空配列は空配列", () => {
    expect(toSiteLinks([])).toEqual([]);
  });
});
