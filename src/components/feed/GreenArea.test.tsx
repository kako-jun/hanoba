import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GreenArea from "./GreenArea.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";

// 緑のサンプリングは canvas getImageData（jsdom 非対応）＝累計の数値そのものは純関数 cumulativeGreen
// （green.test）と実機で確認する領域。ここでは **無反応の Image** で pending（見出し＋計測中）を
// 決定的に検証し、グリッド/凡例/上限明記が無いこと（#344 で廃止）を確かめる。
beforeEach(() => {
  vi.stubGlobal(
    "Image",
    class {
      crossOrigin = "";
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) {
        /* 無反応＝promise は解決しない＝pending（計測中）のまま */
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
    shotDates: [],
    id,
  };
}

describe("GreenArea（緑の総面積・累計・#310/#344）", () => {
  it("写真ゼロは節ごと出さない", () => {
    render(<GreenArea posts={[makePost("1", [])]} subject="あなた" />);
    expect(screen.queryByText(/街に足した緑/)).not.toBeInTheDocument();
  });

  it("写真があれば見出しを出し、計測中は累計数値の代わりに計測中を出す", () => {
    const posts = [makePost("1", ["a.jpg"]), makePost("2", ["b.jpg", "c.jpg"])];
    const { container } = render(<GreenArea posts={posts} subject="あなた" />);
    expect(screen.getByText("あなたが街に足した緑")).toBeInTheDocument();
    expect(screen.getByText(/計測中/)).toBeInTheDocument();
    // #344 で草グリッド・凡例は廃止＝aria-hidden の装飾マス群は出さない。
    expect(container.querySelector("div[aria-hidden]")).toBeNull();
  });

  it("草グリッド廃止に伴い「直近60件」等の上限明記は出さない（全写真累計）", () => {
    const many = Array.from({ length: 65 }, (_, i) => makePost(`p${i}`, ["x.jpg"]));
    render(<GreenArea posts={many} subject="あなた" />);
    expect(screen.queryByText(/直近/)).not.toBeInTheDocument();
  });

  it("subject を見出しに差す（他人プロフィール）", () => {
    render(<GreenArea posts={[makePost("1", ["a.jpg"])]} subject="ボタニ子" />);
    expect(screen.getByText("ボタニ子が街に足した緑")).toBeInTheDocument();
  });
});
