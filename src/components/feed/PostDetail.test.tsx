import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";

// relay 取得はモック境界で止める（実ネットワークを呼ばない・#12）。
const fetchReactionCount = vi.fn();
// コメント欄（#142）も同じ client を使う。PostDetail のテストはコメント機能の検証対象外なので、
// fetchReplies は空（コメント0件）で固定し、いいね/シェア/札のテストに影響を与えない。
const fetchReplies = vi.fn().mockResolvedValue([]);

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchReactionCount: (...args: unknown[]) => fetchReactionCount(...args),
  fetchReplies: (...args: unknown[]) => fetchReplies(...args),
}));

import PostDetail from "./PostDetail.tsx";

// matchMedia を差し替えて reduced-motion の on/off を制御する（#275・DandelionBurst と同型）。
// グローバル汚染しないよう afterEach の vi.unstubAllGlobals() で戻す。
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

function makePost(overrides: Partial<FeedPost> & { id: string }): FeedPost {
  return {
    id: overrides.id,
    pubkey: overrides.pubkey ?? "0".repeat(64),
    createdAt: overrides.createdAt ?? Math.floor(Date.now() / 1000),
    caption: overrides.caption ?? "開花した",
    imageUrls: overrides.imageUrls ?? [overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`],
    imageUrl: overrides.imageUrl ?? `https://image.nostr.build/${overrides.id}.jpg`,
    hashtags: overrides.hashtags ?? [],
  };
}

describe("PostDetail いいね数表示", () => {
  beforeEach(() => {
    fetchReactionCount.mockReset();
  });

  afterEach(() => {
    cleanup();
    // reduced-motion 等の matchMedia スタブを毎回外す（グローバル汚染防止・#275）。
    vi.unstubAllGlobals();
  });

  it("取得したいいね数を花アイコン＋数で表示する", async () => {
    fetchReactionCount.mockResolvedValue(3);
    render(<PostDetail post={makePost({ id: "p1" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    // 花アイコン化したので数は aria-label（いいね N）で確認する。
    const like = await screen.findByLabelText("いいね 3");
    expect(like).toHaveTextContent("3");
    expect(fetchReactionCount).toHaveBeenCalledWith("p1");
  });

  it("0 でも いいね 0 を表示する", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(<PostDetail post={makePost({ id: "p2" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const like = await screen.findByLabelText("いいね 0");
    expect(like).toHaveTextContent("0");
  });

  it("取得前は いいね 取得中（プレースホルダ -）を出す", async () => {
    // 解決しない Promise で「取得中」のまま固定する。
    fetchReactionCount.mockReturnValue(new Promise(() => {}));
    render(<PostDetail post={makePost({ id: "p3" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    await waitFor(() => {
      const like = screen.getByLabelText("いいね 取得中");
      expect(like).toHaveTextContent("-");
    });
  });

  it("複数画像は前後ボタンで切り替えられる", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({
          id: "multi1",
          caption: "成長記録",
          imageUrls: ["https://image.nostr.build/one.jpg", "https://image.nostr.build/two.jpg"],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "成長記録 1枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/one.jpg",
    );
    fireEvent.click(screen.getByRole("button", { name: "次の写真" }));
    expect(screen.getByRole("img", { name: "成長記録 2枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/two.jpg",
    );
    expect(screen.getByRole("button", { name: "2枚目を表示" })).toHaveAttribute("aria-current", "true");
  });

  it("複数画像は写真領域の左スワイプで次へ・右スワイプで前へ切り替えられる（#184）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({
          id: "swipe1",
          caption: "成長記録",
          imageUrls: [
            "https://image.nostr.build/one.jpg",
            "https://image.nostr.build/two.jpg",
            "https://image.nostr.build/three.jpg",
          ],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 写真領域＝画像の親（onTouchStart/End を載せた要素）。
    const area = screen.getByRole("img", { name: "成長記録 1枚目" }).parentElement!;

    // 左スワイプ（dx<0・水平優位）＝次へ。happy-dom 向けに touches/changedTouches を明示。
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 80, clientY: 105 }] });
    expect(screen.getByRole("img", { name: "成長記録 2枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/two.jpg",
    );

    // 右スワイプ（dx>0・水平優位）＝前へ＝1枚目へ戻る。
    fireEvent.touchStart(area, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 200, clientY: 95 }] });
    expect(screen.getByRole("img", { name: "成長記録 1枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/one.jpg",
    );

    // 縦優位スワイプは無視＝枚数は変わらない（縦スクロールと競合させない）。
    fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 60 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 95, clientY: 220 }] });
    expect(screen.getByRole("img", { name: "成長記録 1枚目" })).toBeInTheDocument();
  });

  it("単一画像はスワイプしても切り替わらない（スワイプ無効・#184）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(<PostDetail post={makePost({ id: "single1", caption: "一枚だけ" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const img = screen.getByRole("img", { name: "一枚だけ" });
    const area = img.parentElement!;
    const src = img.getAttribute("src");
    // 1枚はドットも矢印も無く、スワイプも index を動かさない（src 不変・例外を出さない）。
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 60, clientY: 100 }] });
    expect(screen.getByRole("img", { name: "一枚だけ" })).toHaveAttribute("src", src!);
    expect(screen.queryByRole("button", { name: "次の写真" })).toBeNull();
  });

  it("複数画像はスワイプ中に写真ラッパへ blur が付き、指を離すと消える（#275）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    // reduced-motion なし（ぼかしが効く側）を明示する。
    stubMatchMedia(false);
    render(
      <PostDetail
        post={makePost({
          id: "blur-multi",
          caption: "成長記録",
          imageUrls: ["https://image.nostr.build/one.jpg", "https://image.nostr.build/two.jpg"],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const img = screen.getByRole("img", { name: "成長記録 1枚目" });
    // 画像は blur を当てるラッパ div に包まれる（その親がタッチ領域＝touch ハンドラ）。
    const blurWrapper = img.parentElement!;
    const area = blurWrapper.parentElement!;

    // 水平優位（dx 大・縦は微小）のドラッグ中＝ラッパに blur(px) が付く（px>0・インライン style で確認）。
    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 120, clientY: 105 }] });
    const m = blurWrapper.style.filter.match(/blur\(([\d.]+)px\)/);
    expect(m).not.toBeNull();
    expect(Number.parseFloat(m![1]!)).toBeGreaterThan(0);

    // 指を離すと blur は解ける（filter は undefined ＝空文字）。
    fireEvent.touchEnd(area, { changedTouches: [{ clientX: 120, clientY: 105 }] });
    expect(blurWrapper.style.filter).toBe("");
  });

  it("単一画像はスワイプしてもぼかさない（#275・onTouchMove 早期 return）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    stubMatchMedia(false);
    render(<PostDetail post={makePost({ id: "blur-single", caption: "一枚だけ" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const img = screen.getByRole("img", { name: "一枚だけ" });
    const blurWrapper = img.parentElement!;
    const area = blurWrapper.parentElement!;

    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 100, clientY: 105 }] });
    // 1枚は始点も記録されない＝ blur は付かない。
    expect(blurWrapper.style.filter).toBe("");
  });

  it("reduced-motion ではスワイプしてもぼかさない（#275・prefersReducedMotion）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    // matchMedia('(prefers-reduced-motion: reduce)') を matches:true にする。
    stubMatchMedia(true);
    render(
      <PostDetail
        post={makePost({
          id: "blur-reduce",
          caption: "成長記録",
          imageUrls: ["https://image.nostr.build/one.jpg", "https://image.nostr.build/two.jpg"],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const img = screen.getByRole("img", { name: "成長記録 1枚目" });
    const blurWrapper = img.parentElement!;
    const area = blurWrapper.parentElement!;

    fireEvent.touchStart(area, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchMove(area, { touches: [{ clientX: 100, clientY: 105 }] });
    // reduced-motion は onTouchMove が即 return＝ blur は付かない。
    expect(blurWrapper.style.filter).toBe("");
  });

  it("縦優位ドラッグはぼかさない（#275・縦スクロール優先で 0 に戻す）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    stubMatchMedia(false);
    render(
      <PostDetail
        post={makePost({
          id: "blur-vertical",
          caption: "成長記録",
          imageUrls: ["https://image.nostr.build/one.jpg", "https://image.nostr.build/two.jpg"],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const img = screen.getByRole("img", { name: "成長記録 1枚目" });
    const blurWrapper = img.parentElement!;
    const area = blurWrapper.parentElement!;

    fireEvent.touchStart(area, { touches: [{ clientX: 100, clientY: 100 }] });
    // dy が dx を上回る＝縦優位なので blur は 0 のまま。
    fireEvent.touchMove(area, { touches: [{ clientX: 110, clientY: 200 }] });
    expect(blurWrapper.style.filter).toBe("");
  });

  it("本文 <p> から #タグ を除き、タグはチップにだけ出す（二重表示解消・#43）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "t1", caption: "きれいに咲いた #アガベ", hashtags: ["アガベ"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // モーダルは body にポータルされるので container でなく dialog を起点に探す。
    const body = screen.getByRole("dialog").querySelector("p.whitespace-pre-wrap");
    expect(body?.textContent).toBe("きれいに咲いた");
    expect(body?.textContent).not.toContain("#");
    // タグは下のチップ（ボタン）にだけ出る。
    expect(screen.getByRole("button", { name: "#アガベ" })).toBeInTheDocument();
  });

  it("タグだけの投稿は本文 <p> を出さない（空段落の余白を作らない・#43）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "t2", caption: "#アガベ #多肉", hashtags: ["アガベ", "多肉"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    expect(screen.getByRole("dialog").querySelector("p.whitespace-pre-wrap")).toBeNull();
    expect(screen.getByRole("button", { name: "#アガベ" })).toBeInTheDocument();
  });

  it("X でシェア（短文）= 1クリックで X intent を開く・採番なし（#37）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <PostDetail
        // permalink（njump nevent）は 64hex の id を要求するため有効な id を使う。
        post={makePost({ id: "e".repeat(64), caption: "開花した #アガベ", hashtags: ["アガベ"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const shareBtn = screen.getByRole("button", { name: "X でシェア" });
    // 短文はメニューを開かず直接 intent（aria-haspopup なし）。
    expect(shareBtn).not.toHaveAttribute("aria-haspopup");
    fireEvent.click(shareBtn);
    expect(open).toHaveBeenCalledTimes(1);
    const url = open.mock.calls[0]![0] as string;
    expect(url.startsWith("https://twitter.com/intent/tweet?text=")).toBe(true);
    const text = decodeURIComponent(url.replace("https://twitter.com/intent/tweet?text=", ""));
    // 生 caption（インライン #タグ込み）を共有し、採番は付かない。njump パーマリンクが末尾に付く。
    expect(text).toContain("開花した #アガベ");
    expect(text).not.toMatch(/\(\d+\/\d+\)/);
    expect(text).toContain("https://njump.me/");
    open.mockRestore();
  });

  it("X でシェア（長文）= ポップオーバーで全文／各パートを開ける（#37）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <PostDetail
        post={makePost({ id: "f".repeat(64), caption: "あ".repeat(400) })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const shareBtn = screen.getByRole("button", { name: "X でシェア" });
    // 長文はポップオーバー（aria-haspopup="true"）。矢印キー移動を実装していないので
    // role="menu" は名乗らない＝ボタン列のまま（aria-label 付きコンテナ）。
    expect(shareBtn).toHaveAttribute("aria-haspopup", "true");
    fireEvent.click(shareBtn);
    // ポップオーバーは aria-label 付きの単なるボタン列。「全文」と 各パート（1/n…）が並ぶ。
    const popover = screen.getByLabelText("X でシェア（分割）");
    expect(popover).toBeInTheDocument();
    // menu/menuitem ロールは付けていない。
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(screen.getByRole("button", { name: "全文" })).toBeInTheDocument();
    const part1 = screen.getByRole("button", { name: /^1\/\d+$/ });
    fireEvent.click(part1);
    expect(open).toHaveBeenCalledTimes(1);
    // パートを開いたらポップオーバーは閉じる。
    expect(screen.queryByLabelText("X でシェア（分割）")).toBeNull();
    open.mockRestore();
  });

  it("Esc は まずシェアのポップオーバーを閉じ、もう一度でモーダルを閉じる（#37）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    const onClose = vi.fn();
    render(
      <PostDetail
        // 分割が起きる長文＝ポップオーバーを出せる caption。
        post={makePost({ id: "f".repeat(64), caption: "あ".repeat(400) })}
        onClose={onClose}
        onSelectHashtag={() => {}}
      />,
    );
    // 非同期のいいね数取得を先に確定させてから操作する（act 警告回避）。
    await screen.findByLabelText("いいね 0");
    // ポップオーバーを開く。
    fireEvent.click(screen.getByRole("button", { name: "X でシェア" }));
    expect(screen.getByLabelText("X でシェア（分割）")).toBeInTheDocument();

    // 1回目の Esc: ポップオーバーだけ閉じる（モーダルは閉じない）。
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByLabelText("X でシェア（分割）")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // 2回目の Esc: モーダルを閉じる。
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("属タグから札を組み 学名＋和名を並べ discover 検索へリンクする（属単独・#182/#23）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "p4", caption: "うちのパキポ、いい形", hashtags: ["パキポディウム"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 札は hashtags から動的 import した catalog で組む（caption の free-text は使わない・#182）。
    // #23: 学名（dictionary 由来）＋和名を並列表示。属単独なので和名は属名。
    expect(await screen.findByText("Pachypodium")).toBeInTheDocument();
    expect(screen.getByText("パキポディウム")).toBeInTheDocument();
    // クリックでその札の discover 絞り込みへ（最具体の和名＝属名・#239 で ?tags= に統一）。
    const link = screen.getByRole("link", { name: /Pachypodium/ });
    expect(link).toHaveAttribute("href", `/discover?tags=${encodeURIComponent("パキポディウム")}`);
  });

  it("属＋品種タグは品種1枚に畳み 学名＋品種和名を並べる（属単独札は出さない・#182/#23）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({
          id: "p5",
          caption: "開花",
          // #181 で属＋品種が両方タグに入る。札は属単独を捨てて品種1枚に畳む。
          hashtags: ["パキポディウム", "グラキリス"],
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 札の和名は「グラキリス」1枚（属名「パキポディウム」は和名に出さない・属単独札も出ない）。
    const label = await screen.findByText("グラキリス");
    expect(label).toBeInTheDocument();
    expect(screen.queryByText("パキポディウム")).toBeNull();
    // 学名は catalog.sci / dictionary の品種（グラキリス）から引ける。SciName が空白で
    // トークン分割するので、各トークン（直立の var. 含む）が出ていること＝学名併記を確認する。
    const link = screen.getByRole("link", { name: /Pachypodium rosulatum var\. gracilius/ });
    expect(link).toHaveTextContent("Pachypodium");
    expect(link).toHaveTextContent("rosulatum");
    expect(link).toHaveTextContent("gracilius");
    // discover リンクは最も具体的な品種和名へ（#グラキリス）。
    expect(link).toHaveAttribute("href", `/discover?tags=${encodeURIComponent("グラキリス")}`);
  });

  it("非 pickable 見出し属配下の品種は学名＋品種和名だけ・見出し語を出さない（should #1 回帰ガード・#182/#23）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "p7", caption: "胞子葉が展開", hashtags: ["リドレイ"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // リドレイは ビカクシダ › 原種(pickable:false) 配下。札の name は「リドレイ」だけ＝見出し語
    // 「原種」を前置しない（should#1）。学名 sci の有無は学名付与の進捗で変わるので、ここでは
    // 見出し語が出ないこと（name＝リドレイ・「原種」非表示）だけを固定する。
    const label = await screen.findByText("リドレイ");
    expect(label).toBeInTheDocument();
    expect(screen.queryByText("原種")).toBeNull();
    expect(screen.queryByText(/原種\s*リドレイ/)).toBeNull();
    const link = screen.getByRole("link", { name: /リドレイ/ });
    expect(link).toHaveAttribute("href", `/discover?tags=${encodeURIComponent("リドレイ")}`);
  });

  it("学名が引けない札は和名のみ描画する（グレースフル・#23）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "p8", caption: "玄関に飾った", hashtags: ["苔玉"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 「苔玉」は様式（グループ概念）の variety＝species でないので catalog.sci も dictionary も
    // 恒久的に無い＝学名トークンを出さず和名「苔玉」のみ（グレースフル）。学名付与が進んでも
    // 個別 species でない group 概念は sci が付かないため、このテストは実データ変化に強い。
    const link = await screen.findByRole("link", { name: "苔玉" });
    expect(link).toHaveTextContent("苔玉");
    // 学名（ラテン文字トークン）が出ていないこと＝SciName を描画していない。
    expect(link.textContent).not.toMatch(/[A-Za-z]/);
    expect(link).toHaveAttribute("href", `/discover?tags=${encodeURIComponent("苔玉")}`);
  });

  it("カテゴリタグ（塊根植物）は札にしない（#182）", async () => {
    fetchReactionCount.mockResolvedValue(0);
    render(
      <PostDetail
        post={makePost({ id: "p6", caption: "観察", hashtags: ["塊根植物", "水やり"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // catalog ロードを待ってから（札セクションは出ないことを確認）。
    await screen.findByLabelText("いいね 0");
    // カテゴリ・世話タグは札にならない＝「この投稿の植物」見出しは出ない。
    expect(screen.queryByText("この投稿の植物")).toBeNull();
    // ハッシュタグチップは従来どおり出る。
    expect(screen.getByRole("button", { name: "#塊根植物" })).toBeInTheDocument();
  });
});
