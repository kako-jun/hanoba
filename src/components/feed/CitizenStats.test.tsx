import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CitizenStats from "./CitizenStats.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";

const NOW_DAY = 86400;

// CitizenStats は GreenArea（#310）を内包し、画像を crossOrigin で読む。jsdom の Image は
// onerror を非同期発火して late setState→act 警告を出すので、無反応 Image にして抑える
// （緑グリッドの描画は GreenArea.test と純関数 green.test／実機 blink が担保）。
beforeEach(() => {
  vi.stubGlobal(
    "Image",
    class {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {}
    },
  );
});

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    pubkey: "a".repeat(64),
    createdAt: Math.floor(Date.now() / 1000),
    caption: "",
    imageUrls: [],
    imageUrl: null,
    hashtags: [],
    shotDates: [],    ...overrides,
  };
}

describe("CitizenStats（活動スタッツ表示・#272）", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("名乗り済み（hasName）は市民・投稿数/写真数/居住日数を出す", () => {
    const now = Math.floor(Date.now() / 1000);
    const posts = [
      makePost({ id: "1", imageUrls: ["a.jpg", "b.jpg"], createdAt: now - 3 * NOW_DAY }),
      makePost({ id: "2", imageUrls: ["c.jpg"], createdAt: now - 1 * NOW_DAY }),
    ];
    render(<CitizenStats posts={posts} hasName subjectName="あなた" />);
    const section = screen.getByRole("region", { name: "あなたの活動" });
    // 市民レベル（旅人/市民）。名乗り済み＝市民。
    expect(within(section).getByText("市民")).toBeInTheDocument();
    // 投稿2件・写真3枚・居住3日（最古から floor）。
    expect(within(section).getByText("投稿").parentElement).toHaveTextContent("2件");
    expect(within(section).getByText("写真").parentElement).toHaveTextContent("3枚");
    expect(within(section).getByText("居住").parentElement).toHaveTextContent("3日");
  });

  it("名乗り無し（hasName=false）は旅人", () => {
    render(<CitizenStats posts={[]} hasName={false} subjectName="あなた" />);
    const section = screen.getByRole("region", { name: "あなたの活動" });
    expect(within(section).getByText("旅人")).toBeInTheDocument();
    expect(within(section).getByText("投稿").parentElement).toHaveTextContent("0件");
  });

  it("称号/実績バッジは出さない（脱ゲーム化・#272）: 「市民の称号」も ??? も無い", () => {
    const now = Math.floor(Date.now() / 1000);
    const posts = [makePost({ id: "1", imageUrls: ["a.jpg"], createdAt: now })];
    render(<CitizenStats posts={posts} hasName subjectName="あなた" />);
    expect(screen.queryByText("市民の称号")).not.toBeInTheDocument();
    expect(screen.queryByText("初めの一鉢")).not.toBeInTheDocument();
    expect(screen.queryAllByText("？？？")).toHaveLength(0);
  });

  it("育てた品種を catalog ロード後に一覧表示する（属＋品種で同定）", async () => {
    const posts = [
      makePost({ id: "1", hashtags: ["パキポディウム", "グラキリス"] }),
      makePost({ id: "2", hashtags: ["アガベ", "チタノタ"] }),
    ];
    render(<CitizenStats posts={posts} hasName subjectName="あなた" />);
    // catalog は動的 import なので、ロード後に品種チップが現れる。チップは学名のみ（#459）。
    // SciName は学名を空白でトークン分割して描画するので、各品種の固有トークンで確認する
    //（グラキリス→Pachypodium rosulatum var. gracilius / チタノタ→Agave titanota）。和名は出さない。
    await waitFor(() => expect(screen.getByText("rosulatum")).toBeInTheDocument());
    expect(screen.getByText("titanota")).toBeInTheDocument();
    expect(screen.queryByText("グラキリス")).toBeNull();
    expect(screen.queryByText("チタノタ")).toBeNull();
    const section = screen.getByRole("region", { name: "あなたの活動" });
    expect(within(section).getByText("品種").parentElement).toHaveTextContent("2種");
  });

  it("育てた品種のチップはその品種の discover 絞り込みリンク（#kako-jun）", async () => {
    const posts = [makePost({ id: "1", hashtags: ["パキポディウム", "グラキリス"] })];
    render(<CitizenStats posts={posts} hasName subjectName="あなた" />);
    // チップは学名のみ表示（#459）＝学名トークンで引いて親リンクを取る。
    const chip = await screen.findByText("rosulatum");
    const link = chip.closest("a");
    expect(link).not.toBeNull();
    // href の filterTags（[属, 品種]＝ja 正準）は不変なので、品種名 グラキリス で絞る AND リンクのまま。
    expect(link!.getAttribute("href")).toContain("/discover?tags=");
    expect(link!.getAttribute("href")).toContain(encodeURIComponent("グラキリス"));
  });
});
