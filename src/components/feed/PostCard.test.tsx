import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import PostCard from "./PostCard.tsx";
import type { FeedPost } from "../../lib/feed/parse.ts";
import type { VarietyCategory } from "../../lib/plants/variety-catalog.ts";
import { buildVarietyIndex } from "../../lib/plants/fuda.ts";

// 植物札テスト用の最小カタログ（パキポディウム属＋品種グラキリス／フィカス属＋複数語品種）。
const TEST_CATALOG: VarietyCategory[] = [
  {
    label: "多肉植物",
    genera: [
      {
        name: "パキポディウム",
        pickable: true,
        varieties: [{ name: "グラキリス", sci: "Pachypodium rosulatum var. gracilius" }],
      },
      {
        name: "フィカス",
        pickable: true,
        // 複数語の品種名（カタログは空白・投稿のタグは _）。両者を札で一致させる（#239 S1）。
        varieties: [{ name: "フィカス ペティオラリス", sci: "Ficus petiolaris" }],
      },
    ],
  },
];

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

  it("植物札をカードに出し、クリックでその品種の discover 絞り込みへリンクする（#239）", () => {
    const restore = mockSizes(0, 0);
    try {
      render(
        <PostCard
          post={makePost({ hashtags: ["パキポディウム", "グラキリス"] })}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
          fudaIndex={buildVarietyIndex(TEST_CATALOG)}
        />,
      );
      // 属＋品種は品種1枚に畳む。札クリックは **属＋品種の AND**（?tags=属,品種）で絞る（#272 逆算）。
      const link = screen.getByRole("link", { name: /グラキリス/ });
      expect(link).toHaveAttribute(
        "href",
        `/discover?tags=${encodeURIComponent("パキポディウム")},${encodeURIComponent("グラキリス")}`,
      );
    } finally {
      restore();
    }
  });

  it("複数語の品種名（投稿は _ 区切り）でも札を出す＝空白/_ を同一視（#239 S1）", () => {
    const restore = mockSizes(0, 0);
    try {
      // 投稿本文のタグは insertTag で空白→_ に畳まれて保存される（#フィカス_ペティオラリス）。
      render(
        <PostCard
          post={makePost({ hashtags: ["フィカス_ペティオラリス"] })}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
          fudaIndex={buildVarietyIndex(TEST_CATALOG)}
        />,
      );
      // カタログ名（空白）の札が出て、リンクは正規化（_）された discover 絞り込みへ。
      const link = screen.getByRole("link", { name: /フィカス ペティオラリス/ });
      expect(link).toHaveAttribute("href", `/discover?tags=${encodeURIComponent("フィカス_ペティオラリス")}`);
    } finally {
      restore();
    }
  });

  it("catalog 未ロード（null）なら札を出さない（グレースフル・#239）", () => {
    const restore = mockSizes(0, 0);
    try {
      render(
        <PostCard
          post={makePost({ hashtags: ["パキポディウム"] })}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
          fudaIndex={null}
        />,
      );
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
    } finally {
      restore();
    }
  });

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
          profile={{ name: "カコ栽培家", picture: null, about: null, websites: [], favoriteVarieties: [] }}
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

  // いいね数・コメント数の表示（#276）。カードは 1 以上のときだけ控えめに添え、
  // 0 / undefined はその要素ごと描画しない（hidden/style でなく DOM の有無で判定）。
  describe("いいね/コメント数（#276・カードは0非表示）", () => {
    function renderCard(props: { reactionCount?: number; commentCount?: number }) {
      return render(
        <PostCard
          post={makePost()}
          index={0}
          now={2000}
          onOpen={noop}
          onSelectHashtag={noop}
          {...props}
        />,
      );
    }

    it("reactionCount=5 のときいいね要素が出て「5」を表示する", () => {
      const restore = mockSizes(0, 0);
      try {
        renderCard({ reactionCount: 5 });
        const like = screen.getByLabelText("いいね 5");
        expect(like).toBeInTheDocument();
        // 数字「5」は いいね要素の中に出る。
        expect(within(like).getByText("5")).toBeInTheDocument();
      } finally {
        restore();
      }
    });

    it("commentCount=3 のときコメント要素が出て「3」を表示する", () => {
      const restore = mockSizes(0, 0);
      try {
        renderCard({ commentCount: 3 });
        const comment = screen.getByLabelText("コメント 3");
        expect(comment).toBeInTheDocument();
        expect(within(comment).getByText("3")).toBeInTheDocument();
      } finally {
        restore();
      }
    });

    it("reactionCount=0 のときいいね要素は DOM に存在しない（要素の有無で判定）", () => {
      const restore = mockSizes(0, 0);
      try {
        renderCard({ reactionCount: 0 });
        // hidden/style でなく、要素そのものが描画されていないことを確認する。
        expect(screen.queryByLabelText(/^いいね/)).toBeNull();
      } finally {
        restore();
      }
    });

    it("commentCount=0 のときコメント要素は DOM に存在しない", () => {
      const restore = mockSizes(0, 0);
      try {
        renderCard({ commentCount: 0 });
        expect(screen.queryByLabelText(/^コメント/)).toBeNull();
      } finally {
        restore();
      }
    });

    it("どちらも渡さない（undefined）ときは いいね/コメント要素とも存在しない", () => {
      const restore = mockSizes(0, 0);
      try {
        renderCard({});
        expect(screen.queryByLabelText(/^いいね/)).toBeNull();
        expect(screen.queryByLabelText(/^コメント/)).toBeNull();
      } finally {
        restore();
      }
    });

    it("reactionCount=2・commentCount=0 ではいいねだけ出てコメントは出ない（片方0の出し分け）", () => {
      const restore = mockSizes(0, 0);
      try {
        renderCard({ reactionCount: 2, commentCount: 0 });
        expect(screen.getByLabelText("いいね 2")).toBeInTheDocument();
        expect(screen.queryByLabelText(/^コメント/)).toBeNull();
      } finally {
        restore();
      }
    });
  });
});
