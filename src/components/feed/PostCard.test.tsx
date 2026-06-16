import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import PostCard from "./PostCard.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";

// jsdom はレイアウトしないため scrollHeight/clientHeight は常に 0。
// clip 判定（#50: scrollHeight > clientHeight）を検証するため両者をモックする。
function mockSizes(scroll: number, client: number) {
  const sh = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  const ch = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => scroll });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => client });
  return () => {
    if (sh) Object.defineProperty(HTMLElement.prototype, "scrollHeight", sh);
    else delete (HTMLElement.prototype as unknown as { scrollHeight?: number }).scrollHeight;
    if (ch) Object.defineProperty(HTMLElement.prototype, "clientHeight", ch);
    else delete (HTMLElement.prototype as unknown as { clientHeight?: number }).clientHeight;
  };
}

function makePost(overrides: Partial<FeedPost> = {}): FeedPost {
  return {
    id: "id1",
    pubkey: "pk1",
    createdAt: 1000,
    caption: "開花した #アガベ",
    imageUrls: ["https://example.com/a.jpg"],
    imageUrl: "https://example.com/a.jpg",
    hashtags: ["アガベ"],
    ...overrides,
  };
}

const noop = () => {};

describe("PostCard", () => {
  afterEach(() => cleanup());

  it("本文からタグを除いて表示し、タグは別に出す", () => {
    const restore = mockSizes(0, 0); // clip なし
    try {
      render(<PostCard post={makePost()} index={0} now={2000} onOpen={noop} onSelectHashtag={noop} />);
      // 本文は #アガベ を含まない（タグは右の列へ）。
      expect(screen.getByText("開花した")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "#アガベ" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("収まりきる時は「続きを読む」を出さない", () => {
    const restore = mockSizes(100, 100); // scrollHeight == clientHeight ＝ clip なし
    try {
      render(<PostCard post={makePost()} index={0} now={2000} onOpen={noop} onSelectHashtag={noop} />);
      expect(screen.queryByRole("button", { name: "続きを読む" })).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("clip されている時は「続きを読む」を出し、押すと展開・再押下で畳む", async () => {
    const restore = mockSizes(1000, 200); // scrollHeight > clientHeight ＝ clip
    try {
      const user = userEvent.setup();
      render(
        <PostCard
          post={makePost({ caption: "とても長い栽培ログ。".repeat(50) })}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
        />,
      );
      const more = screen.getByRole("button", { name: "続きを読む" });
      expect(more).toHaveAttribute("aria-expanded", "false");
      await user.click(more);
      expect(screen.getByRole("button", { name: "閉じる" })).toHaveAttribute("aria-expanded", "true");
      await user.click(screen.getByRole("button", { name: "閉じる" }));
      expect(screen.getByRole("button", { name: "続きを読む" })).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("写真タップで onOpen を呼ぶ（拡大）", async () => {
    const restore = mockSizes(0, 0);
    try {
      const user = userEvent.setup();
      let opened = 0;
      render(
        <PostCard post={makePost()} index={0} now={2000} onOpen={() => (opened += 1)} onSelectHashtag={noop} />,
      );
      await user.click(screen.getByRole("button", { name: "開花した #アガベ" }));
      expect(opened).toBe(1);
    } finally {
      restore();
    }
  });

  it("本文など非インタラクティブ領域クリックで onOpen を呼ぶ（#101）", async () => {
    const restore = mockSizes(0, 0);
    try {
      const user = userEvent.setup();
      let opened = 0;
      render(
        <PostCard post={makePost()} index={0} now={2000} onOpen={() => (opened += 1)} onSelectHashtag={noop} />,
      );
      // 写真でもタグでもない本文テキストをクリック → カード全体クリックで拡大。
      await user.click(screen.getByText("開花した"));
      expect(opened).toBe(1);
    } finally {
      restore();
    }
  });

  it("タグクリックは onSelectHashtag のみ・onOpen は呼ばない（stopPropagation・#101）", async () => {
    const restore = mockSizes(0, 0);
    try {
      const user = userEvent.setup();
      let opened = 0;
      const picked: string[] = [];
      render(
        <PostCard
          post={makePost()}
          index={0}
          now={2000}
          onOpen={() => (opened += 1)}
          onSelectHashtag={(t) => picked.push(t)}
        />,
      );
      await user.click(screen.getByRole("button", { name: "#アガベ" }));
      expect(picked).toEqual(["アガベ"]);
      expect(opened).toBe(0); // stopPropagation でカード拡大は発火しない
    } finally {
      restore();
    }
  });

  it("profile があれば著者名を出す（#35）", () => {
    const restore = mockSizes(0, 0);
    try {
      render(
        <PostCard
          post={makePost()}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
          profile={{ name: "カコ栽培家", picture: null, about: null, websites: [] }}
        />,
      );
      expect(screen.getByText("カコ栽培家")).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it("profile 未取得なら npub 短縮にフォールバック（#35）", () => {
    const restore = mockSizes(0, 0);
    try {
      render(
        <PostCard
          post={makePost({ pubkey: "a".repeat(64) })}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
          profile={null}
        />,
      );
      expect(screen.getByText(/^npub1.*…/)).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});
