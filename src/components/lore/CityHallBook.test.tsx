import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { TENURE_DAYS, TENURE_POSTS } from "../../lib/lore/citizen.ts";

// ネットワーク・鍵はモック境界で止める（実 relay・localStorage を呼ばない）。
const fetchMyPosts = vi.fn();
const getDisplayName = vi.fn();
const getPublicKeyHex = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyPosts: (...a: unknown[]) => fetchMyPosts(...a),
}));
vi.mock("../../lib/nostr/keys.ts", () => ({
  getDisplayName: (...a: unknown[]) => getDisplayName(...a),
  getPublicKeyHex: (...a: unknown[]) => getPublicKeyHex(...a),
}));

import CityHallBook from "./CityHallBook.tsx";

const NOW_MS = 1781913600 * 1000;
const DAY = 86400;

function makePost(createdAt: number, id: string): FeedPost {
  return {
    id,
    pubkey: "a".repeat(64),
    createdAt,
    caption: "",
    imageUrls: ["https://x/y.jpg"],
    imageUrl: "https://x/y.jpg",
    hashtags: [],
  };
}

/** L2（古参）相当の投稿: 5 件・最古は 20 日前。 */
function tenuredPosts(): FeedPost[] {
  const now = Math.floor(NOW_MS / 1000);
  return Array.from({ length: TENURE_POSTS }, (_, i) =>
    makePost(now - (TENURE_DAYS + 6) * DAY + i * DAY, `p${i}`),
  );
}

describe("CityHallBook（ハノーバ市民手帳・#163）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset().mockResolvedValue([]);
    getDisplayName.mockReset().mockReturnValue(null);
    getPublicKeyHex.mockReset().mockResolvedValue("a".repeat(64));
    vi.spyOn(Date, "now").mockReturnValue(NOW_MS);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("常に手帳のタイトルを出す", async () => {
    render(<CityHallBook />);
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳" })).toBeInTheDocument();
  });

  it("移住案内（1p）の冒頭に市長ボタニクスのアイコン（ジョウロ写真）を出す", async () => {
    const { container } = render(<CityHallBook />);
    // L0（名前なし）の既定は 1p 移住案内。歓迎の辞が出るのを待ってから走査する。
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);
    // Avatar は装飾扱いで alt="" ＝ presentational なので role=img では拾えない。
    // 素の <img> を走査し src でジョウロ写真を絞り込む。
    const imgs = Array.from(container.querySelectorAll("img"));
    const mayor = imgs.find((el) =>
      (el.getAttribute("src") ?? "").includes("mayor-botanics-watering-can.webp"),
    );
    expect(mayor).toBeDefined();
  });

  it("移住案内の冒頭に語り手として市長ボタニクス・フォン・ハノーバの名を添える", async () => {
    render(<CityHallBook />);
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);
    expect(screen.getByText(/市長ボタニクス・フォン・ハノーバ/)).toBeInTheDocument();
  });

  it("市役所（2p・hub）では市長アイコンを出さない（語り手肖像は移住案内専用）", async () => {
    getDisplayName.mockReturnValue("みどり"); // L1: 既定 2p（市役所ハブ）。
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    const { container } = render(<CityHallBook />);
    await screen.findByText(/ここは市役所だ/);
    const imgs = Array.from(container.querySelectorAll("img"));
    const mayor = imgs.find((el) =>
      (el.getAttribute("src") ?? "").includes("mayor-botanics-watering-can.webp"),
    );
    expect(mayor).toBeUndefined();
  });

  it("L0 訪問者（名前なし）: 1p 移住案内のみ・次はティザー止まり", async () => {
    getDisplayName.mockReturnValue(null);
    render(<CityHallBook />);

    // 移住案内の歓迎の辞が出る。
    expect(await screen.findByText(/ハノーバ市長、ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
    // 実務注（site の一言説明）も出る。
    expect(screen.getByText(/植物専用の写真SNSです/)).toBeInTheDocument();
    // 前は不可、次（ティザー）へは進める。
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
  });

  it("L0: 次を押すと？？？ティザー、その先へは進めない", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue(null);
    render(<CityHallBook />);
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);

    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    // ティザーの先（市役所中身）には行けない。
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    // 後方には戻れる。
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
  });

  it("L1 市民（名前あり・投稿少）: 既定で 2p 市役所ハブを開く", async () => {
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);

    // 既定ページ＝市役所ハブ。
    expect(await screen.findByText(/ここは市役所だ/)).toBeInTheDocument();
    // 実在ルートはリンクとして機能する。
    const ranking = screen.getByRole("link", { name: /人気ランキング/ });
    expect(ranking).toHaveAttribute("href", "/ranking");
    expect(screen.getByRole("link", { name: /あなたの植物/ })).toHaveAttribute("href", "/me");
    expect(screen.getByRole("link", { name: /投稿する/ })).toHaveAttribute("href", "/compose");
    expect(screen.getByRole("link", { name: /みんなの植物/ })).toHaveAttribute("href", "/discover");
    // 住民投票（#160）は最初に開庁した役所＝/vote への実リンク。
    expect(screen.getByRole("link", { name: /住民投票/ })).toHaveAttribute("href", "/vote");
    // 残る 3 役所（品評会/市長ブログ/街の地図）は「近日開庁」でリンクにならない（住民投票が開庁したので丁度 3）。
    expect(screen.getAllByText("近日開庁").length).toBe(3);
    expect(screen.queryByRole("link", { name: /品評会/ })).toBeNull();
    // 昇格の味付け。
    expect(screen.getByText(/移住、確かに受理した/)).toBeInTheDocument();
  });

  it("L1: 沿革（3p）はロックされ、次を押すとティザー", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);
    await screen.findByText(/ここは市役所だ/);

    // 2p から次 → 3p はティザー。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("L2 古参（名前＋5投稿＋14日以上）: 沿革・条文まで開ける", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("ふるつわもの");
    fetchMyPosts.mockResolvedValue(tenuredPosts());
    render(<CityHallBook />);

    // 既定は 2p（奥は自動で開かない）。
    await screen.findByText(/ここは市役所だ/);
    // 古参は 2p で移住受理の文言を出さない（長く居る市民に再掲しない）。
    expect(screen.queryByText(/移住、確かに受理した/)).toBeNull();
    // 古参歓迎の味付けも、まだ奥に達していない 2p では出さない。
    expect(screen.queryByText(/諸君はもう、市の古い友人だ/)).toBeNull();
    // 3p 沿革へ。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/荒れ地に最初の一鉢を植える/)).toBeInTheDocument();
    // 古参歓迎は奥（3p）に初めて達したときだけ出す。
    expect(screen.getByText(/諸君はもう、市の古い友人だ/)).toBeInTheDocument();
    // 4p 条文へ。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/第一条（土地）/)).toBeInTheDocument();
    expect(screen.getByText(/育てる意志こそが地代だ/)).toBeInTheDocument();
    // 4p が最後（次は無い）。
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("relay ダウン（投稿が空）でも名前があれば L1 に落ちてロックアウトしない", async () => {
    // fetchMyPosts は client.ts 内で try/catch して [] を返す（reject しない）。
    // よって relay ダウンの実経路は「[] が返る → citizenLevel(hasName, 0, null) → L1」。
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);

    // 投稿ゼロでも市役所ハブ（2p）まで開く＝市民として扱う。
    expect(await screen.findByText(/ここは市役所だ/)).toBeInTheDocument();
    // L2 ではないので沿革（3p）はロックされ、次はティザー止まり。
    const next = screen.getByRole("button", { name: "次のページ" });
    expect(next).toBeEnabled();
  });

  it("鍵取得に失敗しても（NIP-07 reject 等）名前があれば L1 に落ちてロックアウトしない", async () => {
    // 実 catch 経路は getPublicKeyHex() の throw（NIP-07 拡張が拒否する等）。
    // deriveLevel の catch が hasName を尊重して L1 にフォールバックする。
    getDisplayName.mockReturnValue("みどり");
    getPublicKeyHex.mockRejectedValue(new Error("NIP-07 rejected"));
    render(<CityHallBook />);

    // 鍵が取れなくても市役所ハブ（2p）まで開く＝名乗った市民を締め出さない。
    expect(await screen.findByText(/ここは市役所だ/)).toBeInTheDocument();
  });

  it("後方オープン: 2p から前へ戻ると 1p 移住案内に行ける", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/ここは市役所だ/);

    await user.click(screen.getByRole("button", { name: "前のページ" }));
    expect(await screen.findByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
  });

  it("←/→ キーで本をめくれる（前方ロックを尊重し、入力中は横取りしない）", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり"); // L1: 2p まで解放。
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/ここは市役所だ/);

    // → でティザー（3p）まで進める（前方ロックの上限の 1 枚先）。
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("？？？")).toBeInTheDocument();
    // その先（4p）へは → でも進めない（前方ロック）。
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("？？？")).toBeInTheDocument();
    // ← で市役所（2p）へ戻る。
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText(/ここは市役所だ/)).toBeInTheDocument();
    // ← で移住案内（1p）へ。
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
    // 1p より前（後方下限）には ← でも行かない。
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
  });

  it("←/→: 入力欄にフォーカスがあるときはページめくりを横取りしない", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([]);
    render(
      <div>
        <input aria-label="ダミー入力" />
        <CityHallBook />
      </div>,
    );
    await screen.findByText(/ここは市役所だ/);

    const input = screen.getByRole("textbox", { name: "ダミー入力" });
    input.focus();
    await user.keyboard("{ArrowRight}");
    // 入力中なので本はめくれず、2p 市役所のまま。
    expect(screen.getByText(/ここは市役所だ/)).toBeInTheDocument();
    expect(screen.queryByText("？？？")).toBeNull();
  });
});
