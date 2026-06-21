import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GreenArea from "./GreenArea.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";

// 緑のサンプリングは canvas getImageData（jsdom 非対応）＝実機 blink で確認する領域。
// jsdom の Image は src 設定で onerror を非同期発火し「全失敗→節を隠す」へ進む＋act 警告も出る。
// ここでは **無反応の Image** にして pending 状態（見出し＋空きマス）を決定的に検証する
// （濃淡の出方そのものは純関数 green.ts のテストと実機 blink が担保する）。
beforeEach(() => {
  vi.stubGlobal(
    "Image",
    class {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        /* 無反応＝promise は解決しない＝pending のまま */
      }
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makePost(id: string, imageUrls: string[]): FeedPost {
  return {
    pubkey: "a".repeat(64),
    createdAt: 0,
    caption: "",
    imageUrls,
    imageUrl: imageUrls[0] ?? null,
    hashtags: [],
    id,
  };
}

describe("GreenArea（緑の総面積・#310）", () => {
  it("写真ゼロは節ごと出さない", () => {
    render(<GreenArea posts={[makePost("1", [])]} subject="あなた" />);
    expect(screen.queryByText(/街に足した緑/)).not.toBeInTheDocument();
  });

  it("写真があれば「○○が街に足した緑」の見出しと 1投稿1マスのグリッドを出す", () => {
    const posts = [makePost("1", ["a.jpg"]), makePost("2", ["b.jpg", "c.jpg"]), makePost("3", ["d.jpg"])];
    const { container } = render(<GreenArea posts={posts} subject="あなた" />);
    expect(screen.getByText("あなたが街に足した緑")).toBeInTheDocument();
    // 写真のある投稿数ぶんのマス（pending は空きマス level0）。
    const cells = container.querySelectorAll("div[aria-hidden] > span");
    expect(cells).toHaveLength(3);
  });

  it("CAP（60件）を超えると「直近60件」と明記する＝silent cap にしない", () => {
    const many = Array.from({ length: 65 }, (_, i) => makePost(`p${i}`, ["x.jpg"]));
    render(<GreenArea posts={many} subject="あなた" />);
    expect(screen.getByText(/直近60件/)).toBeInTheDocument();
    // CAP 以下では明記しない。
    cleanup();
    render(<GreenArea posts={many.slice(0, 60)} subject="あなた" />);
    expect(screen.queryByText(/直近60件/)).not.toBeInTheDocument();
  });

  it("subject を見出しに差す（他人プロフィール）", () => {
    render(<GreenArea posts={[makePost("1", ["a.jpg"])]} subject="ボタニ子" />);
    expect(screen.getByText("ボタニ子が街に足した緑")).toBeInTheDocument();
  });
});
