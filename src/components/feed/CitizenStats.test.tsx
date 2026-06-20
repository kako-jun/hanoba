import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import CitizenStats from "./CitizenStats.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";

const NOW_DAY = 86400;

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    pubkey: "a".repeat(64),
    createdAt: Math.floor(Date.now() / 1000),
    caption: "",
    imageUrls: [],
    imageUrl: null,
    hashtags: [],
    ...overrides,
  };
}

describe("CitizenStats（活動スタッツ表示・#272）", () => {
  afterEach(() => cleanup());

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

  it("実績バッジ（#272 段階2）: 投稿1件で『初めの一鉢』を解除し、未解除は ??? で出す", () => {
    const now = Math.floor(Date.now() / 1000);
    const posts = [makePost({ id: "1", imageUrls: ["a.jpg"], createdAt: now })];
    render(<CitizenStats posts={posts} hasName subjectName="あなた" />);
    expect(screen.getByText("市民の称号")).toBeInTheDocument();
    // 解除済み称号のラベルが見える。
    expect(screen.getByText("初めの一鉢")).toBeInTheDocument();
    // 未解除は図鑑式 ???（複数）。
    expect(screen.getAllByText("？？？").length).toBeGreaterThan(0);
  });

  it("育てた品種を catalog ロード後に一覧表示する（属＋品種で同定）", async () => {
    const posts = [
      makePost({ id: "1", hashtags: ["パキポディウム", "グラキリス"] }),
      makePost({ id: "2", hashtags: ["アガベ", "チタノタ"] }),
    ];
    render(<CitizenStats posts={posts} hasName subjectName="あなた" />);
    // catalog は動的 import なので、ロード後に品種チップが現れる。
    await waitFor(() => expect(screen.getByText("グラキリス")).toBeInTheDocument());
    expect(screen.getByText("チタノタ")).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "あなたの活動" });
    expect(within(section).getByText("品種").parentElement).toHaveTextContent("2種");
  });
});
