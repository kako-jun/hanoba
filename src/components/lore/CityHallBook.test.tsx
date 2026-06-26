import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import { TENURE_DAYS, TENURE_POSTS } from "../../lib/lore/citizen.ts";
import { LOCKED_PAGE_VEIL } from "../../lib/lore/cityHall.ts";

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

// matchMedia を差し替えて reduced-motion の on/off を制御する（#275・DandelionBurst と同型）。
// グローバル汚染しないよう afterEach の vi.restoreAllMocks() が stub も戻す。
function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

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
    shotDates: [],  };
}

/** L2 相当の投稿: 5 件・最古は 20 日前（投稿数 5 / 居住 14 日〜の境界を満たす）。 */
function tenuredPosts(): FeedPost[] {
  const now = Math.floor(NOW_MS / 1000);
  return Array.from({ length: TENURE_POSTS }, (_, i) =>
    makePost(now - (TENURE_DAYS + 6) * DAY + i * DAY, `p${i}`),
  );
}

/** L3 相当の投稿: 15 件・最古は 35 日前（投稿数 15 / 居住 30 日〜の L3 tier を満たす・#469）。 */
function level3Posts(): FeedPost[] {
  const now = Math.floor(NOW_MS / 1000);
  return Array.from({ length: 15 }, (_, i) => makePost(now - 35 * DAY + i * DAY, `p${i}`));
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
    // matchMedia の stub も毎回外す（reduced-motion スタブのグローバル汚染防止・#275）。
    vi.unstubAllGlobals();
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

  it("移住案内の冒頭に語り手として「ボタニクス市長」の名を添える（フルネームは本文側・#262）", async () => {
    render(<CityHallBook />);
    // 本文（歓迎の辞）にはフルネームが残る。
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);
    // 肖像の脇は親しみのある短い呼び名「ボタニクス市長」。
    expect(screen.getByText("ボタニクス市長")).toBeInTheDocument();
  });

  it("街の地図（2p・map）でも冒頭に市長アイコンを出す（本全体が市長の語り＝全ページ共通・#455）", async () => {
    getDisplayName.mockReturnValue("みどり"); // L1: 既定 2p（街の地図）。
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    const { container } = render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);
    const imgs = Array.from(container.querySelectorAll("img"));
    const mayor = imgs.find((el) =>
      (el.getAttribute("src") ?? "").includes("mayor-botanics-watering-can.webp"),
    );
    expect(mayor).toBeDefined();
  });

  it("名乗り済み（L1/L2）は最初から2ページ目を出す（1ページ目フラッシュ・???ちらつきなし）", async () => {
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);
    // useIsoLayoutEffect が同期で 2p・最低 L1 を確定するので、最初の描画から:
    // ・1p 移住案内の歓迎の辞は出ない（page-1 フラッシュなし）
    expect(screen.queryByText(/ようこそ、緑の市へ/)).toBeNull();
    // ・2p 街の地図が即出る（maxUnlocked=2 なので ??? ティザーのちらつきもない）
    expect(screen.getByText(/我が市の地図である/)).toBeInTheDocument();
    expect(screen.queryByText("？？？")).toBeNull();
  });

  it("L0 訪問者（名前なし）: 1p 移住案内のみ・次はティザー止まり", async () => {
    getDisplayName.mockReturnValue(null);
    render(<CityHallBook />);

    // 移住案内の歓迎の辞が出る。
    expect(await screen.findByText(/ハノーバ市長、ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
    // L0（旅人）はタイトルにレベル番号を出さず素のタイトル＋副題「旅人」（#469 変更A）。
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳" })).toBeInTheDocument();
    expect(screen.getByText("旅人")).toBeInTheDocument();
    // 実務注（site の一言説明）も出る。
    expect(screen.getByText(/植物専用の写真SNSです/)).toBeInTheDocument();
    // 前は不可、次（ティザー）へは進める。
    expect(screen.getByRole("button", { name: "前のページ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeEnabled();
    // 解放済みページ（1p 本文）にはロック頁のぼかし装飾は出ない。
    expect(screen.queryByTestId("lore-veil")).toBeNull();
  });

  it("L0: 次を押すと？？？ティザー、その先へは進めない", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue(null);
    render(<CityHallBook />);
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);

    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    // ③ ロック頁: 「？？？」の背後に「読めない頁」（ぼかし崩し字）が装飾として敷かれる。
    const veil = screen.getByTestId("lore-veil");
    expect(veil).toHaveAttribute("aria-hidden", "true");
    expect(veil).toHaveTextContent(LOCKED_PAGE_VEIL[0]!);
    // ティザーの先（街の地図の中身）には行けない。
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    // 後方には戻れる。
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
  });

  it("L1 市民（名前あり・投稿少）: 既定で 2p 街の地図を開く（#469）", async () => {
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);

    // 既定ページ＝街の地図（早期のご褒美ページ）。
    expect(await screen.findByText(/我が市の地図である/)).toBeInTheDocument();
    // L1+ はタイトルにレベル番号を出し（「ハノーバ市民手帳 L1」）、副題「旅人」は出さない（#469 変更A）。
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳 L1" })).toBeInTheDocument();
    expect(screen.queryByText("旅人")).toBeNull();
    // 名所（ランドマーク）が読み物として並ぶ。
    expect(screen.getByText("葉脈川")).toBeInTheDocument();
    // 地図ビジュアルは未生成（image=null）＝仮置きフレームのキャプションが出る（#469・#137 で実画像差し込み）。
    expect(screen.getByText("地図 製作中")).toBeInTheDocument();
    // 機能導線（discover/ranking/me/compose）は手帳から外しヘッダ/フッタへ＝地図には出さない。
    expect(screen.queryByRole("link", { name: /人気ランキング/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /あなたの植物/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /投稿する/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /みんなの植物/ })).toBeNull();
    // 市政の窓口: 住民投票（#160）は /vote への実リンク（退避先として健在）。
    expect(screen.getByRole("link", { name: /住民投票/ })).toHaveAttribute("href", "/vote");
    // 残る窓口（品評会/市長ブログ）は「近日開庁」でリンクにならない＝丁度 2。
    expect(screen.getAllByText("近日開庁").length).toBe(2);
    expect(screen.queryByRole("link", { name: /品評会/ })).toBeNull();
    // 昇格の味付け（L1 が地図を開いた）。
    expect(screen.getByText(/移住、確かに受理した/)).toBeInTheDocument();
  });

  it("L1: 沿革（3p）はロックされ、次を押すとティザー", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([makePost(Math.floor(NOW_MS / 1000), "p0")]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    // 2p から次 → 3p はティザー。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("L2（名前＋5投稿＋14日以上）: 沿革（3p）まで開ける・条文（4p）はまだロック（1レベル=1ページ・#469）", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("ふるつわもの");
    fetchMyPosts.mockResolvedValue(tenuredPosts());
    render(<CityHallBook />);

    // 既定は 2p 街の地図（奥は自動で開かない）。
    await screen.findByText(/我が市の地図である/);
    // タイトルは真レベル表記「ハノーバ市民手帳 L2」（#469 変更A）。
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳 L2" })).toBeInTheDocument();
    // 古参は 2p で移住受理の文言を出さない（長く居る市民に再掲しない）。
    expect(screen.queryByText(/移住、確かに受理した/)).toBeNull();
    // 古参歓迎の味付けも、まだ奥に達していない 2p では出さない。
    expect(screen.queryByText(/諸君はもう、市の古い友人だ/)).toBeNull();
    // 3p 沿革へ。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/荒れ地に最初の一鉢を植える/)).toBeInTheDocument();
    // 沿革も冒頭に市長の前口上が出る（全ページ冒頭に市長の言葉・#469 変更B）。
    expect(screen.getByText(/我が市の来し方を、少し語らせてもらおう/)).toBeInTheDocument();
    // 古参歓迎は奥（3p）に初めて達したときだけ出す。
    expect(screen.getByText(/諸君はもう、市の古い友人だ/)).toBeInTheDocument();
    // 4p 条文はまだロック＝次はティザー止まり（L3 で開く）。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
  });

  it("L3（名前＋15投稿＋30日以上）: 条文（4p）まで開ける（最深ページ・#469）", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("ながいすまい");
    fetchMyPosts.mockResolvedValue(level3Posts());
    render(<CityHallBook />);

    // 既定は 2p（奥は自動で開かない）。
    await screen.findByText(/我が市の地図である/);
    // タイトルは真レベル表記「ハノーバ市民手帳 L3」（#469 変更A）。
    expect(screen.getByRole("heading", { level: 1, name: "ハノーバ市民手帳 L3" })).toBeInTheDocument();
    // 3p 沿革へ（古参歓迎は L3 でも維持）。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/荒れ地に最初の一鉢を植える/)).toBeInTheDocument();
    expect(screen.getByText(/諸君はもう、市の古い友人だ/)).toBeInTheDocument();
    // 4p 条文へ。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(await screen.findByText(/第一条（土地）/)).toBeInTheDocument();
    // 条文も冒頭に市長の前口上が出る（全ページ冒頭に市長の言葉・#469 変更B）。
    expect(screen.getByText(/これが我が市の憲章だ/)).toBeInTheDocument();
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

    // 投稿ゼロでも街の地図（2p）まで開く＝市民として扱う。
    expect(await screen.findByText(/我が市の地図である/)).toBeInTheDocument();
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

    // 鍵が取れなくても街の地図（2p）まで開く＝名乗った市民を締め出さない。
    expect(await screen.findByText(/我が市の地図である/)).toBeInTheDocument();
  });

  it("後方オープン: 2p から前へ戻ると 1p 移住案内に行ける", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    await user.click(screen.getByRole("button", { name: "前のページ" }));
    expect(await screen.findByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
  });

  it("←/→ キーで本をめくれる（前方ロックを尊重し、入力中は横取りしない）", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり"); // L1: 2p まで解放。
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    // → でティザー（3p）まで進める（前方ロックの上限の 1 枚先）。
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("？？？")).toBeInTheDocument();
    // その先（4p）へは → でも進めない（前方ロック）。
    await user.keyboard("{ArrowRight}");
    expect(screen.getByText("？？？")).toBeInTheDocument();
    // ← で街の地図（2p）へ戻る。
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText(/我が市の地図である/)).toBeInTheDocument();
    // ← で移住案内（1p）へ。
    await user.keyboard("{ArrowLeft}");
    expect(await screen.findByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
    // 1p より前（後方下限）には ← でも行かない。
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
  });

  it("左スワイプで次ページ・右スワイプで前ページにめくれる（#275）", async () => {
    getDisplayName.mockReturnValue("みどり"); // L1: 2p まで解放（次=ティザー3p）。
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    // 本パネル（touch ハンドラ）＝ aria-live のページ内容コンテナの親。
    const content = document.querySelector('[aria-live="polite"]')!;
    const panel = content.parentElement!;

    // 左スワイプ（dx<-40・水平優位）＝次へ＝ティザー（3p）。
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 80, clientY: 105 }] });
    expect(await screen.findByText("？？？")).toBeInTheDocument();

    // 右スワイプ（dx>+40・水平優位）＝前へ＝街の地図（2p）へ戻る。
    fireEvent.touchStart(panel, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 200, clientY: 95 }] });
    expect(await screen.findByText(/我が市の地図である/)).toBeInTheDocument();
  });

  it("先頭ページで右スワイプは no-op（後方下限・#275）", async () => {
    getDisplayName.mockReturnValue(null); // L0: 既定 1p 移住案内（前は無い）。
    render(<CityHallBook />);
    await screen.findByText(/ボタニクス・フォン・ハノーバである/);

    const content = document.querySelector('[aria-live="polite"]')!;
    const panel = content.parentElement!;

    // 右スワイプ（前へ）。1p より前は無い＝ページ不変。
    fireEvent.touchStart(panel, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 220, clientY: 100 }] });
    expect(screen.getByText(/ボタニクス・フォン・ハノーバである/)).toBeInTheDocument();
    expect(screen.queryByText("？？？")).toBeNull();
  });

  it("ロック境界で左スワイプは進めない（canNext=false・前方ロック・#275）", async () => {
    const user = userEvent.setup();
    getDisplayName.mockReturnValue("みどり"); // L1: 2p まで解放、3p はティザー上限。
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    // まずティザー（3p＝前方ロック上限）まで進める。
    await user.click(screen.getByRole("button", { name: "次のページ" }));
    expect(screen.getByText("？？？")).toBeInTheDocument();

    const content = document.querySelector('[aria-live="polite"]')!;
    const panel = content.parentElement!;

    // ティザーから更に左スワイプ（次へ）＝ロック越え不可（canNext=false）でページ不変＝ティザーのまま。
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 60, clientY: 100 }] });
    expect(screen.getByText("？？？")).toBeInTheDocument();
  });

  it("スワイプ中はページ内容に blur が付き、指を離すと消える（#275）", async () => {
    stubMatchMedia(false); // reduced-motion なし＝ぼかしが効く側。
    getDisplayName.mockReturnValue("みどり");
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    const content = document.querySelector('[aria-live="polite"]') as HTMLElement;
    const panel = content.parentElement!;

    // 水平優位ドラッグ中＝内容コンテナに blur(px)（px>0・インライン style で確認）。
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 120, clientY: 105 }] });
    const m = content.style.filter.match(/blur\(([\d.]+)px\)/);
    expect(m).not.toBeNull();
    expect(Number.parseFloat(m![1]!)).toBeGreaterThan(0);

    // 指を離すと blur は解ける。しきい値（40px）未満で離す＝ページ遷移は起こさず
    // 同じ内容コンテナ（key 不変）の filter が消えることを確認する。
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 190, clientY: 100 }] });
    expect(content.style.filter).toBe("");
  });

  it("reduced-motion はぼかさないがページ遷移は起きる（#275）", async () => {
    stubMatchMedia(true); // prefers-reduced-motion: reduce。
    getDisplayName.mockReturnValue("みどり"); // L1: 次=ティザー3p。
    fetchMyPosts.mockResolvedValue([]);
    render(<CityHallBook />);
    await screen.findByText(/我が市の地図である/);

    const content = document.querySelector('[aria-live="polite"]') as HTMLElement;
    const panel = content.parentElement!;

    // move 中も blur は付かない（onTouchMove が prefersReducedMotion で即 return）。
    fireEvent.touchStart(panel, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(panel, { touches: [{ clientX: 120, clientY: 105 }] });
    expect(content.style.filter).toBe("");

    // それでも左スワイプの遷移自体は起きる＝ティザー（3p）へ。
    fireEvent.touchEnd(panel, { changedTouches: [{ clientX: 80, clientY: 100 }] });
    expect(await screen.findByText("？？？")).toBeInTheDocument();
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
    await screen.findByText(/我が市の地図である/);

    const input = screen.getByRole("textbox", { name: "ダミー入力" });
    input.focus();
    await user.keyboard("{ArrowRight}");
    // 入力中なので本はめくれず、2p 街の地図のまま。
    expect(screen.getByText(/我が市の地図である/)).toBeInTheDocument();
    expect(screen.queryByText("？？？")).toBeNull();
  });
});
