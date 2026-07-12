import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPost } from "../../lib/feed/parse.ts";
import type { Profile } from "../../lib/feed/parse.ts";
import { nip19 } from "nostr-tools";

// relay 取得はモック境界で止める（実ネットワークを呼ばない・#12）。
// #537: 花リアクションをトグル化。件数＋自分の反応を返す fetchReactionState、取り消しの deleteReaction を
// publishReaction と並べてモックする。
const fetchReactionState = vi.fn();
const publishReaction = vi.fn();
const deleteReaction = vi.fn();
// コメント欄（#142）も同じ client を使う。PostDetail のテストはコメント機能の検証対象外なので、
// fetchReplies は空（コメント0件）で固定し、花/シェア/札のテストに影響を与えない。
const fetchReplies = vi.fn().mockResolvedValue([]);

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchReactionState: (...args: unknown[]) => fetchReactionState(...args),
  publishReaction: (...args: unknown[]) => publishReaction(...args),
  deleteReaction: (...args: unknown[]) => deleteReaction(...args),
  fetchReplies: (...args: unknown[]) => fetchReplies(...args),
}));

import PostDetail from "./PostDetail.tsx";
import { LocaleProvider } from "../../lib/i18n/index.ts";

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
    shotDates: [],  };
}

// 花ボタンの aria-label（#537・ja.ts「detail.likes.*」の実文言と一致させる）。
// 未反応/反応済みで押した時の挙動が変わることを伝える文言なので、件数だけでなく
// 全文を検証の同期点にする（部分一致の findByLabelText 誤マッチを避ける）。
const likeAria = (n: number | string) => `花 ${n}（押すと花を添える）`;
const unlikeAria = (n: number | string) => `花 ${n}（花を添えています。もう一度押すと取り消す）`;

function stubFocusFrame() {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  const scrollIntoView = vi.fn();
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });

  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  let nextFrame = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
    const id = nextFrame;
    nextFrame += 1;
    frames.set(id, cb);
    return id;
  });
  const cancelAnimationFrame = vi.fn((id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

  return {
    scrollIntoView,
    focus,
    requestAnimationFrame,
    cancelAnimationFrame,
    runFrames() {
      for (const [id, cb] of [...frames]) {
        if (!frames.delete(id)) continue;
        cb(0);
      }
    },
    restore() {
      focus.mockRestore();
      if (originalScrollIntoView) Object.defineProperty(Element.prototype, "scrollIntoView", originalScrollIntoView);
      else delete (Element.prototype as unknown as { scrollIntoView?: Element["scrollIntoView"] }).scrollIntoView;
    },
  };
}

describe("PostDetail 花リアクション表示", () => {
  beforeEach(() => {
    fetchReactionState.mockReset();
    publishReaction.mockReset();
    deleteReaction.mockReset();
  });

  afterEach(() => {
    cleanup();
    // reduced-motion 等の matchMedia スタブを毎回外す（グローバル汚染防止・#275）。
    vi.unstubAllGlobals();
  });

  it("取得した花リアクション数をラベル＋花アイコン＋数で表示する", async () => {
    fetchReactionState.mockResolvedValue({ count: 3, myReactionId: undefined });
    render(<PostDetail post={makePost({ id: "p1" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const like = await screen.findByLabelText(likeAria(3));
    expect(like).toHaveTextContent("花を添える");
    expect(like).toHaveTextContent("3");
    expect(fetchReactionState).toHaveBeenCalledWith("p1");
  });

  it("0 でも 花 0 を表示する", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(<PostDetail post={makePost({ id: "p2" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const like = await screen.findByLabelText(likeAria(0));
    expect(like).toHaveTextContent("0");
  });

  it("取得前は 花 取得中（プレースホルダ -）を出す", async () => {
    // 解決しない Promise で「取得中」のまま固定する。
    fetchReactionState.mockReturnValue(new Promise(() => {}));
    render(<PostDetail post={makePost({ id: "p3" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    await waitFor(() => {
      const like = screen.getByLabelText(likeAria("取得中"));
      expect(like).toHaveTextContent("-");
    });
  });

  it("空白名は旅人として表示し、正しい npub href と aria 識別だけに npub を残す", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const pubkey = "4".repeat(64);
    const profile: Profile = {
      name: " \n ",
      picture: null,
      about: null,
      websites: [],
      favoriteVarieties: [],
    };
    render(
      <PostDetail
        post={makePost({ id: "author-empty", pubkey })}
        profile={profile}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    const link = screen.getByRole("link", { name: /^旅人（npub1.*….*）のプロフィール$/ });
    expect(link).toHaveAttribute("href", `/u?npub=${nip19.npubEncode(pubkey)}`);
    expect(link).toHaveTextContent("旅人");
    expect(link).not.toHaveTextContent("npub");
    await screen.findByLabelText(likeAria(0));
    await screen.findByText("まだコメントはありません");
  });

  it("表示名があれば前後空白を除去して維持する", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(
      <PostDetail
        post={makePost({ id: "author-named", pubkey: "5".repeat(64) })}
        profile={{ name: "  葉子  ", picture: null, about: null, websites: [], favoriteVarieties: [] }}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: "葉子 のプロフィール" })).toHaveTextContent("葉子");
    await screen.findByLabelText(likeAria(0));
    await screen.findByText("まだコメントはありません");
  });

  it("0件で送信成功すると1件へ増える", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined }) // 初期取得
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-zero" }); // 送信成功後の再取得
    publishReaction.mockResolvedValue({ status: "published" });
    const post = makePost({ id: "like-zero", pubkey: "author" });
    render(<PostDetail post={post} onClose={() => {}} onSelectHashtag={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: likeAria(0) }));
    expect(await screen.findByRole("button", { name: unlikeAria(1) })).toBeInTheDocument();
    expect(publishReaction).toHaveBeenCalledWith("like-zero", "author");
  });

  it("花の送信後に親へ件数と自分の反応IDを通知する", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-sync" });
    publishReaction.mockResolvedValue({ status: "published" });
    const onEngagementChange = vi.fn();
    render(
      <PostDetail
        post={makePost({ id: "like-sync" })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
        onEngagementChange={onEngagementChange}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: likeAria(0) }));
    await screen.findByRole("button", { name: unlikeAria(1) });
    expect(onEngagementChange).toHaveBeenCalledWith({ reactionCount: 1, myReactionId: "r-sync" });
  });

  it("既存件数で送信成功すると1件だけ増える", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 4, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 5, myReactionId: "r-four" });
    publishReaction.mockResolvedValue({ status: "published" });
    render(<PostDetail post={makePost({ id: "like-four" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: likeAria(4) }));
    expect(await screen.findByRole("button", { name: unlikeAria(5) })).toBeInTheDocument();
  });

  it("送信中は disabled・送信中 aria になり連打しても1回だけ送る", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 2, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 3, myReactionId: "r-two" });
    let resolve!: (value: { status: "published" }) => void;
    publishReaction.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<PostDetail post={makePost({ id: "like-pending" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const button = await screen.findByRole("button", { name: likeAria(2) });
    fireEvent.click(button);
    const sending = screen.getByRole("button", { name: "花を添えています" });
    expect(sending).toBeDisabled();
    fireEvent.click(sending);
    expect(publishReaction).toHaveBeenCalledTimes(1);
    resolve({ status: "published" });
    expect(await screen.findByRole("button", { name: unlikeAria(3) })).toBeInTheDocument();
  });

  it("既に反応済みなら件数を据え置き、後続の再取得でリレー側の反応済みへ収束する", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 3, myReactionId: undefined }) // ローカルは未反応表示
      .mockResolvedValueOnce({ count: 3, myReactionId: "already-id" }); // relay は既に反応済み
    publishReaction.mockResolvedValue({ status: "already-reacted" });
    render(<PostDetail post={makePost({ id: "already" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const button = await screen.findByRole("button", { name: likeAria(3) });
    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    // 件数は3のまま据え置き。後続の再取得で自分の反応が判明し isLikedByMe=true へ収束する。
    expect(await screen.findByRole("button", { name: unlikeAria(3) })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("失敗時は件数据え置き・alert関連付けし、再試行成功で増えてalertを消す", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 6, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 7, myReactionId: "r-six" });
    publishReaction
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ status: "published" });
    render(<PostDetail post={makePost({ id: "retry" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: likeAria(6) }));
    const alert = await screen.findByRole("alert");
    const button = screen.getByRole("button", { name: likeAria(6) });
    expect(button).toHaveAttribute("aria-describedby", alert.id);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: unlikeAria(7) })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("初期件数取得より送信成功が先でも古い取得結果で上書きしない", async () => {
    let resolveInitial!: (value: { count: number; myReactionId: string | undefined }) => void;
    fetchReactionState
      .mockReturnValueOnce(new Promise((r) => { resolveInitial = r; })) // 初期取得（保留のまま）
      .mockResolvedValueOnce({ count: 9, myReactionId: "r-nine" }); // 送信成功後の再取得（先に解決）
    publishReaction.mockResolvedValue({ status: "published" });
    render(<PostDetail post={makePost({ id: "race" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: likeAria("取得中") }));
    expect(await screen.findByRole("button", { name: unlikeAria(9) })).toBeInTheDocument();
    // 初期取得（保留していた）が後から解決しても、送信成功後の新しい状態を上書きしない（revision ガード）。
    resolveInitial({ count: 999, myReactionId: undefined });
    await waitFor(() => expect(screen.getByRole("button", { name: unlikeAria(9) })).toBeInTheDocument());
  });

  it("投稿切替後に旧投稿の取得・送信が完了しても新投稿を汚さない", async () => {
    let resolveOldCount!: (value: { count: number; myReactionId: string | undefined }) => void;
    let resolveOldPublish!: (value: { status: "published" }) => void;
    fetchReactionState
      .mockReturnValueOnce(new Promise((r) => { resolveOldCount = r; }))
      .mockResolvedValueOnce({ count: 9, myReactionId: undefined });
    publishReaction.mockReturnValueOnce(new Promise((r) => { resolveOldPublish = r; }));
    const { rerender } = render(
      <PostDetail post={makePost({ id: "old" })} onClose={() => {}} onSelectHashtag={() => {}} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: likeAria("取得中") }));
    rerender(<PostDetail post={makePost({ id: "new" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    expect(await screen.findByRole("button", { name: likeAria(9) })).not.toBeDisabled();
    resolveOldCount({ count: 20, myReactionId: "old-reaction" });
    resolveOldPublish({ status: "published" });
    await waitFor(() => expect(screen.getByRole("button", { name: likeAria(9) })).toBeInTheDocument());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("花ボタンはキーボード操作可能な44pxボタンとして表示する", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-a11y" });
    publishReaction.mockResolvedValue({ status: "published" });
    const user = userEvent.setup();
    render(<PostDetail post={makePost({ id: "a11y" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    const button = await screen.findByRole("button", { name: likeAria(0) });
    expect(button).toHaveClass("min-h-11");
    expect(button).toHaveTextContent("花を添える");
    button.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: unlikeAria(1) })).toBeInTheDocument();
  });

  // --- ここから #537 トグル化の新規ケース ---

  it("未反応→花を添える→もう一度押して取り消す往復が1回のクリックずつで成立する（#537）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined }) // 初期取得
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-1" }) // publish 後の再取得
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined }); // delete 後の再取得
    publishReaction.mockResolvedValue({ status: "published" });
    deleteReaction.mockResolvedValue(undefined);
    render(<PostDetail post={makePost({ id: "roundtrip" })} onClose={() => {}} onSelectHashtag={() => {}} />);

    const likeButton = await screen.findByRole("button", { name: likeAria(0) });
    fireEvent.click(likeButton);
    const likedButton = await screen.findByRole("button", { name: unlikeAria(1) });
    expect(likedButton.querySelector("svg")).toHaveClass("text-ha-yellow");

    fireEvent.click(likedButton);
    const unlikedButton = await screen.findByRole("button", { name: likeAria(0) });
    expect(unlikedButton.querySelector("svg")).toHaveClass("text-ha-orange");
    expect(deleteReaction).toHaveBeenCalledWith("r-1");
  });

  it("未反応はflowerOutline(オレンジ・線画)、反応済みはflower(黄・塗り)をDOMに出す（#537）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 2, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 3, myReactionId: "r-icon" });
    publishReaction.mockResolvedValue({ status: "published" });
    render(<PostDetail post={makePost({ id: "icon-check" })} onClose={() => {}} onSelectHashtag={() => {}} />);

    const button = await screen.findByRole("button", { name: likeAria(2) });
    const outlineIcon = button.querySelector("svg");
    expect(outlineIcon).toHaveClass("text-ha-orange");
    expect(outlineIcon).toHaveAttribute("fill", "none"); // flowerOutline は線画（STROKE.fill=none）。

    fireEvent.click(button);
    const likedButton = await screen.findByRole("button", { name: unlikeAria(3) });
    expect(likedButton).toHaveTextContent("花を添えた");
    const filledIcon = likedButton.querySelector("svg");
    expect(filledIcon).toHaveClass("text-ha-yellow");
    expect(filledIcon).toHaveAttribute("fill", "currentColor"); // flower は塗り。
  });

  it("取り消し失敗時は専用エラー文言を出し、状態不変・アイコンはflowerのまま（#537）", async () => {
    fetchReactionState.mockResolvedValue({ count: 5, myReactionId: "r-del-fail" }); // 常に反応済み状態
    deleteReaction.mockRejectedValue(new Error("offline"));
    render(<PostDetail post={makePost({ id: "del-fail" })} onClose={() => {}} onSelectHashtag={() => {}} />);

    const button = await screen.findByRole("button", { name: unlikeAria(5) });
    fireEvent.click(button);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("花を取り下げられませんでした。もう一度お試しください。");
    const stillLiked = screen.getByRole("button", { name: unlikeAria(5) });
    expect(stillLiked.querySelector("svg")).toHaveClass("text-ha-yellow");
    expect(publishReaction).not.toHaveBeenCalled();
  });

  it("取消中はdisabled・取り消し中ariaになり、連打してもdeleteReactionは1回だけ（#537）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 4, myReactionId: "r-unsend" })
      .mockResolvedValueOnce({ count: 3, myReactionId: undefined });
    let resolveDelete!: () => void;
    deleteReaction.mockReturnValue(new Promise<void>((r) => { resolveDelete = r; }));
    render(<PostDetail post={makePost({ id: "unsend-pending" })} onClose={() => {}} onSelectHashtag={() => {}} />);

    const button = await screen.findByRole("button", { name: unlikeAria(4) });
    fireEvent.click(button);
    const sending = screen.getByRole("button", { name: "花を取り下げています" });
    expect(sending).toBeDisabled();
    fireEvent.click(sending);
    expect(deleteReaction).toHaveBeenCalledTimes(1);
    resolveDelete();
    expect(await screen.findByRole("button", { name: likeAria(3) })).toBeInTheDocument();
  });

  it("publish成功後はfetchReactionStateを第2引数undefinedで呼ぶ（#537 再取得引数の非対称性）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-pub-args" });
    publishReaction.mockResolvedValue({ status: "published" });
    render(<PostDetail post={makePost({ id: "args-pub" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: likeAria(0) }));
    await screen.findByRole("button", { name: unlikeAria(1) });
    expect(fetchReactionState.mock.calls[1]).toEqual(["args-pub", undefined]);
  });

  it("delete成功後はfetchReactionStateをexcludeReactionId付きで呼ぶ（#537 再取得引数の非対称性）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-del-args" })
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined });
    deleteReaction.mockResolvedValue(undefined);
    render(<PostDetail post={makePost({ id: "args-del" })} onClose={() => {}} onSelectHashtag={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: unlikeAria(1) }));
    await screen.findByRole("button", { name: likeAria(0) });
    expect(fetchReactionState.mock.calls[1]).toEqual(["args-del", { excludeReactionId: "r-del-args" }]);
  });

  it("publish成功後にfetchReactionStateが失敗するとlikeError=trueで件数・状態は変わらない（#537）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 2, myReactionId: undefined })
      .mockRejectedValueOnce(new Error("refetch failed"));
    publishReaction.mockResolvedValue({ status: "published" });
    render(<PostDetail post={makePost({ id: "pub-refetch-fail" })} onClose={() => {}} onSelectHashtag={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: likeAria(2) }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("花を添えられませんでした。もう一度お試しください。");
    // publish 自体は成功したが再取得が失敗＝件数・isLikedByMe は初期取得のまま据え置き。
    expect(screen.getByRole("button", { name: likeAria(2) })).toBeInTheDocument();
  });

  it("delete成功後にfetchReactionStateが失敗するとlikeError=trueで件数・状態は変わらない（#537）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 5, myReactionId: "r-keep" })
      .mockRejectedValueOnce(new Error("refetch failed"));
    deleteReaction.mockResolvedValue(undefined);
    render(<PostDetail post={makePost({ id: "del-refetch-fail" })} onClose={() => {}} onSelectHashtag={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: unlikeAria(5) }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("花を取り下げられませんでした。もう一度お試しください。");
    expect(screen.getByRole("button", { name: unlikeAria(5) })).toBeInTheDocument();
  });

  // #537: isLikedByMe=true かつ myReactionId=undefined という不整合状態からの toggleLike 呼び出しは
  // toggleLike 内の早期 return（防御コード・PostDetail.tsx「自分の反応が見つからない場合は何もしない」）
  // でガードされる。しかし isLikedByMe と myReactionId は、初期取得・送信後の再取得のどちらでも常に
  // 同じ fetchReactionState 結果（state.myReactionId !== undefined ⇔ isLikedByMe）から同時に setState
  // される＝この組み合わせを作る setState 経路が存在しない。モック注入・rerender・イベント発火という
  // 外部からの操作では再現できず、実運用上も本テストの手段からも到達不能なため skip する
  // （到達させるには useState を直接書き換えるなど実装詳細に踏み込む必要があり、それは避けた）。
  it.skip("不整合ガード: isLikedByMe=trueかつmyReactionId=undefinedならpublish/deleteどちらも呼ばずlikingだけfalseに戻る（#537・外部からは到達不能）", async () => {
    // 到達手段が無いため未実装（コメント参照）。
  });

  it("i18nスモーク: en ロケールでは flower aria が英語文言になる（#537）", async () => {
    fetchReactionState
      .mockResolvedValueOnce({ count: 0, myReactionId: undefined })
      .mockResolvedValueOnce({ count: 1, myReactionId: "r-en" });
    publishReaction.mockResolvedValue({ status: "published" });
    render(
      <LocaleProvider value="en">
        <PostDetail post={makePost({ id: "i18n-en" })} onClose={() => {}} onSelectHashtag={() => {}} />
      </LocaleProvider>,
    );
    const button = await screen.findByRole("button", { name: "0 flowers. Tap to add a flower." });
    fireEvent.click(button);
    expect(
      await screen.findByRole("button", { name: "1 flowers. A flower is added. Tap again to remove it." }),
    ).toBeInTheDocument();
  });

  // --- ここまで #537 トグル化の新規ケース ---

  describe("初期 focus target（#550）", () => {
    it('initialFocusTarget="like" で rAF 後に花ボタンへ scroll/focus する', async () => {
      fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
      const stubs = stubFocusFrame();
      try {
        render(
          <PostDetail
            post={makePost({ id: "focus-like" })}
            initialFocusTarget="like"
            onClose={() => {}}
            onSelectHashtag={() => {}}
          />,
        );
        const like = await screen.findByRole("button", { name: likeAria(0) });

        stubs.runFrames();

        expect(stubs.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(stubs.scrollIntoView.mock.contexts[0]).toBe(like);
        expect(stubs.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
        expect(document.activeElement).toBe(like);
      } finally {
        stubs.restore();
      }
    });

    it('initialFocusTarget="comment" で hanoba-comment-${post.id} の入力へ scroll/focus する', async () => {
      fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
      const stubs = stubFocusFrame();
      try {
        const post = makePost({ id: "focus-comment" });
        render(
          <PostDetail
            post={post}
            initialFocusTarget="comment"
            onClose={() => {}}
            onSelectHashtag={() => {}}
          />,
        );
        await screen.findByLabelText(likeAria(0));
        const input = document.getElementById(`hanoba-comment-${post.id}`);
        expect(input).toBeInstanceOf(HTMLElement);

        stubs.runFrames();

        expect(stubs.scrollIntoView).toHaveBeenCalledTimes(1);
        expect(stubs.scrollIntoView.mock.contexts[0]).toBe(input);
        expect(stubs.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
        expect(document.activeElement).toBe(input);
      } finally {
        stubs.restore();
      }
    });

    it("initialFocusTarget=undefined では focus target 用の scrollIntoView が走らない", async () => {
      fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
      const stubs = stubFocusFrame();
      try {
        render(<PostDetail post={makePost({ id: "focus-none" })} onClose={() => {}} onSelectHashtag={() => {}} />);
        await screen.findByLabelText(likeAria(0));

        stubs.runFrames();

        expect(stubs.requestAnimationFrame).not.toHaveBeenCalled();
        expect(stubs.scrollIntoView).not.toHaveBeenCalled();
      } finally {
        stubs.restore();
      }
    });

    it("rAF 実行前に unmount しても cancelAnimationFrame され、unmounted DOM へ focus しない", async () => {
      fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
      const stubs = stubFocusFrame();
      try {
        const { unmount } = render(
          <PostDetail
            post={makePost({ id: "focus-unmount" })}
            initialFocusTarget="like"
            onClose={() => {}}
            onSelectHashtag={() => {}}
          />,
        );
        const like = await screen.findByRole("button", { name: likeAria(0) });
        stubs.focus.mockClear();
        stubs.scrollIntoView.mockClear();

        unmount();
        stubs.runFrames();

        expect(stubs.cancelAnimationFrame).toHaveBeenCalledWith(1);
        expect(stubs.scrollIntoView).not.toHaveBeenCalled();
        expect(stubs.focus.mock.contexts).not.toContain(like);
        expect(document.body.contains(like)).toBe(false);
      } finally {
        stubs.restore();
      }
    });
  });

  it("複数画像は前後ボタンで切り替えられる", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    expect(screen.getByRole("img", { name: "成長記録 1枚目" })).toHaveAttribute("loading", "eager");
    fireEvent.click(screen.getByRole("button", { name: "次の写真" }));
    expect(screen.getByRole("img", { name: "成長記録 2枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/two.jpg",
    );
    expect(screen.getByRole("button", { name: "2枚目を表示" })).toHaveAttribute("aria-current", "true");
  });

  it("複数画像は表示中の前後写真だけを先読みする", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const preloads: Array<{ src: string; decoding: string; decode: ReturnType<typeof vi.fn> }> = [];
    const ImageMock = vi.fn(function () {
      const img = {
        src: "",
        decoding: "",
        decode: vi.fn().mockResolvedValue(undefined),
      };
      preloads.push(img);
      return img;
    });
    vi.stubGlobal("Image", ImageMock);

    render(
      <PostDetail
        post={makePost({
          id: "preload-neighbors",
          caption: "成長記録",
          imageUrls: [
            "https://image.nostr.build/one.jpg",
            "https://image.nostr.build/two.jpg",
            "https://image.nostr.build/three.jpg",
          ],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        initialPhotoIndex={1}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );

    await waitFor(() => expect(preloads.map((img) => img.src)).toEqual([
      "https://image.nostr.build/one.jpg",
      "https://image.nostr.build/three.jpg",
    ]));
    expect(preloads.every((img) => img.decoding === "async")).toBe(true);
    expect(preloads.every((img) => img.decode.mock.calls.length === 1)).toBe(true);
  });

  it("2枚投稿の先読みは同じ隣接写真を重複して読まない", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const preloads: Array<{ src: string; decoding: string; decode: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("Image", vi.fn(function () {
      const img = {
        src: "",
        decoding: "",
        decode: vi.fn().mockResolvedValue(undefined),
      };
      preloads.push(img);
      return img;
    }));

    render(
      <PostDetail
        post={makePost({
          id: "preload-two",
          caption: "成長記録",
          imageUrls: ["https://image.nostr.build/one.jpg", "https://image.nostr.build/two.jpg"],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );

    await waitFor(() => expect(preloads.map((img) => img.src)).toEqual([
      "https://image.nostr.build/two.jpg",
    ]));
  });

  it("4枚以上の先読みは移動後も現在位置の前後だけを保持し、古い先読みを再利用し続けない", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const preloads: Array<{ src: string; decoding: string; decode: ReturnType<typeof vi.fn> }> = [];
    vi.stubGlobal("Image", vi.fn(function () {
      const img = {
        src: "",
        decoding: "",
        decode: vi.fn().mockResolvedValue(undefined),
      };
      preloads.push(img);
      return img;
    }));

    render(
      <PostDetail
        post={makePost({
          id: "preload-rolling-window",
          caption: "成長記録",
          imageUrls: [
            "https://image.nostr.build/one.jpg",
            "https://image.nostr.build/two.jpg",
            "https://image.nostr.build/three.jpg",
            "https://image.nostr.build/four.jpg",
          ],
          imageUrl: "https://image.nostr.build/one.jpg",
        })}
        initialPhotoIndex={1}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );

    await waitFor(() => expect(preloads.map((img) => img.src)).toEqual([
      "https://image.nostr.build/one.jpg",
      "https://image.nostr.build/three.jpg",
    ]));

    fireEvent.click(screen.getByRole("button", { name: "次の写真" }));
    await waitFor(() => expect(preloads.map((img) => img.src)).toEqual([
      "https://image.nostr.build/one.jpg",
      "https://image.nostr.build/three.jpg",
      "https://image.nostr.build/two.jpg",
      "https://image.nostr.build/four.jpg",
    ]));

    fireEvent.click(screen.getByRole("button", { name: "次の写真" }));
    await waitFor(() => expect(preloads.map((img) => img.src)).toEqual([
      "https://image.nostr.build/one.jpg",
      "https://image.nostr.build/three.jpg",
      "https://image.nostr.build/two.jpg",
      "https://image.nostr.build/four.jpg",
      "https://image.nostr.build/three.jpg",
      "https://image.nostr.build/one.jpg",
    ]));
  });

  it("initialPhotoIndex があればその写真から始まり、範囲外は末尾に丸める", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const post = makePost({
      id: "initial-index",
      caption: "成長記録",
      imageUrls: [
        "https://image.nostr.build/one.jpg",
        "https://image.nostr.build/two.jpg",
        "https://image.nostr.build/three.jpg",
      ],
      imageUrl: "https://image.nostr.build/one.jpg",
    });
    const { rerender } = render(
      <PostDetail
        post={post}
        initialPhotoIndex={1}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "成長記録 2枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/two.jpg",
    );
    await screen.findByLabelText(likeAria(0));
    await screen.findByText("まだコメントはありません");

    rerender(
      <PostDetail
        post={{ ...post, id: "initial-index-next" }}
        initialPhotoIndex={99}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    expect(screen.getByRole("img", { name: "成長記録 3枚目" })).toHaveAttribute(
      "src",
      "https://image.nostr.build/three.jpg",
    );
    await screen.findByLabelText(likeAria(0));
    await screen.findByText("まだコメントはありません");
  });

  it("複数画像は写真領域の左スワイプで次へ・右スワイプで前へ切り替えられる（#184）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <PostDetail
        // permalink（Hanoba 内 /p/<nevent>）は 64hex の id を要求するため有効な id を使う。
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
    // 生 caption（インライン #タグ込み）を共有し、採番は付かない。Hanoba 内パーマリンクが末尾に付く。
    expect(text).toContain("開花した #アガベ");
    expect(text).not.toMatch(/\(\d+\/\d+\)/);
    expect(text).toContain("https://hanoba.llll-ll.com/p/");
    open.mockRestore();
  });

  it("X でシェア（長文）= ポップオーバーで全文／各パートを開ける（#37）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
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
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    const onClose = vi.fn();
    render(
      <PostDetail
        // 分割が起きる長文＝ポップオーバーを出せる caption。
        post={makePost({ id: "f".repeat(64), caption: "あ".repeat(400) })}
        onClose={onClose}
        onSelectHashtag={() => {}}
      />,
    );
    // 非同期の花数取得を先に確定させてから操作する（act 警告回避）。
    await screen.findByLabelText(likeAria(0));
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

  it("属タグから札を組み 学名のみを出し discover 検索へリンクする（属単独・#182/#23/#459）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(
      <PostDetail
        post={makePost({ id: "p4", caption: "うちのパキポ、いい形", hashtags: ["パキポディウム"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 札は hashtags から動的 import した catalog で組む（caption の free-text は使わない・#182）。
    // 札は学名のみ表示（#459）。属単独札なので学名＝属名「Pachypodium」。和名「パキポディウム」は札にも title にも出さない。
    const link = await screen.findByRole("link", { name: /Pachypodium/ });
    expect(link).toHaveTextContent("Pachypodium");
    expect(link).not.toHaveTextContent("パキポディウム");
    // title は学名（「{学名}で探す」）＝和名は含まない（#459）。
    expect(link.getAttribute("title")).toContain("Pachypodium");
    expect(link.getAttribute("title")).not.toContain("パキポディウム");
    // クリックでその札の discover 絞り込みへ（?tags=パキポディウム・ja 正準で不変・#239）。
    expect(link).toHaveAttribute("href", `/discover?tags=${encodeURIComponent("パキポディウム")}`);
  });

  it("属＋品種タグは品種1枚に畳み 学名＋品種和名を並べる（属単独札は出さない・#182/#23）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(
      <PostDetail
        post={makePost({
          id: "p5",
          caption: "開花",
          // #181 で属＋品種が両方タグに入る。札は属単独を捨てて品種1枚に畳む。
          hashtags: ["パキポディウム", "グラキリス"],
          shotDates: [],        })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 札は学名のみ（#459）。属＋品種は品種1枚に畳み、学名＝品種の学名。SciName が空白で
    // トークン分割するので、各トークン（直立の var. 含む）が出ていること＝学名表示を確認する。
    const link = await screen.findByRole("link", { name: /Pachypodium rosulatum var\. gracilius/ });
    expect(link).toHaveTextContent("Pachypodium");
    expect(link).toHaveTextContent("rosulatum");
    expect(link).toHaveTextContent("gracilius");
    // 和名「グラキリス」は札にも title にも出さない（#459＝札は学名そのもの）。title は学名（「{学名}で探す」）。
    expect(link).not.toHaveTextContent("グラキリス");
    expect(link.getAttribute("title")).toContain("Pachypodium rosulatum var. gracilius");
    expect(link.getAttribute("title")).not.toContain("グラキリス");
    // 属名「パキポディウム」も和名に出さない（属単独札も出ない）。
    expect(screen.queryByText("パキポディウム")).toBeNull();
    // discover リンクは **属＋品種の AND**（?tags=パキポディウム,グラキリス）で絞る（#272 逆算）。
    expect(link).toHaveAttribute(
      "href",
      `/discover?tags=${encodeURIComponent("パキポディウム")},${encodeURIComponent("グラキリス")}`,
    );
  });

  it("非 pickable 見出し属配下の品種は学名のみ・見出し語を出さない（should #1 回帰ガード・#182/#23/#459）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(
      <PostDetail
        // リドレイは ビカクシダ › 原種(pickable:false) 配下＝属タグを持てずカテゴリ（ビカクシダ）が共起する（#448）。
        // #459: 親（カテゴリ）の無い素の品種タグは札にならないので、TagPicker と同じく #ビカクシダ を共起させる。
        post={makePost({ id: "p7", caption: "胞子葉が展開", hashtags: ["ビカクシダ", "リドレイ"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // 札は学名のみ（#459）＝「Platycerium ridleyi」。見出し語「原種」を前置しない（should#1）。
    // 和名「リドレイ」は札にも title にも出さない。title は学名（「{学名}で探す」）。
    const link = await screen.findByRole("link", { name: /Platycerium ridleyi/ });
    expect(link).not.toHaveTextContent("リドレイ");
    expect(link.getAttribute("title")).toContain("Platycerium ridleyi");
    expect(link.getAttribute("title")).not.toContain("リドレイ");
    // 見出し語「原種」を出さない（should#1 回帰ガード）。
    expect(screen.queryByText("原種")).toBeNull();
    expect(screen.queryByText(/原種\s*リドレイ/)).toBeNull();
    // discover は [カテゴリ, 品種] の AND（#448 逆算）。
    expect(link).toHaveAttribute(
      "href",
      `/discover?tags=${encodeURIComponent("ビカクシダ")},${encodeURIComponent("リドレイ")}`,
    );
  });

  it("学名がどこからも引けない品種は札にしない（#459＝和名へ倒さない・苔玉）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(
      <PostDetail
        // 「苔玉」は様式（グループ概念）の variety＝species でないので catalog.sci も dictionary も
        // 恒久的に無い。カテゴリ（コケ）を共起させても学名が引けないので札にしない（#459＝和名へ倒さない）。
        post={makePost({ id: "p8", caption: "玄関に飾った", hashtags: ["コケ", "苔玉"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // catalog ロードを待ってから（札セクションは出ないことを確認）。
    await screen.findByLabelText(likeAria(0));
    // 学名の無い植物は札にならない＝「この投稿の植物」見出しも札リンクも出ない。
    expect(screen.queryByText("この投稿の植物")).toBeNull();
    expect(screen.queryByRole("link", { name: "苔玉" })).toBeNull();
    // ハッシュタグチップは従来どおり出る。
    expect(screen.getByRole("button", { name: "#苔玉" })).toBeInTheDocument();
  });

  it("カテゴリタグ（塊根植物）は札にしない（#182）", async () => {
    fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
    render(
      <PostDetail
        post={makePost({ id: "p6", caption: "観察", hashtags: ["塊根植物", "水やり"] })}
        onClose={() => {}}
        onSelectHashtag={() => {}}
      />,
    );
    // catalog ロードを待ってから（札セクションは出ないことを確認）。
    await screen.findByLabelText(likeAria(0));
    // カテゴリ・世話タグは札にならない＝「この投稿の植物」見出しは出ない。
    expect(screen.queryByText("この投稿の植物")).toBeNull();
    // ハッシュタグチップは従来どおり出る。
    expect(screen.getByRole("button", { name: "#塊根植物" })).toBeInTheDocument();
  });

  // #460: ハッシュタグの**表示**だけ閲覧言語に訳す。実カタログを動的 import するので実 loc 値で検証する。
  describe("ハッシュタグ表示ローカライズ（#460・en・実タグは ja 正準）", () => {
    it("en ではカテゴリ/属タグの表示を loc.en に訳し、品種/世話タグは ja のまま", async () => {
      fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
      render(
        <LocaleProvider value="en">
          <PostDetail
            // 塊根植物=カテゴリ・パキポディウム=属（loc あり）／グラキリス=品種・板付け=世話タグ（loc 無し）。
            post={makePost({ id: "loc1", caption: "観察", hashtags: ["塊根植物", "パキポディウム", "グラキリス", "板付け"] })}
            onClose={() => {}}
            onSelectHashtag={() => {}}
          />
        </LocaleProvider>,
      );
      // catalog 動的 import 後に英表示のチップが出る。
      expect(await screen.findByRole("button", { name: "#Caudex Plants" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "#Pachypodium" })).toBeInTheDocument();
      // 品種・世話タグは ja のまま。
      expect(screen.getByRole("button", { name: "#グラキリス" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "#板付け" })).toBeInTheDocument();
      // ja 原典の表示は en では出ない（カテゴリ/属）。
      expect(screen.queryByRole("button", { name: "#塊根植物" })).toBeNull();
      expect(screen.queryByRole("button", { name: "#パキポディウム" })).toBeNull();
    });

    it("en でも onSelectHashtag は JA 正準タグで呼ぶ（表示=Pachypodium・値=パキポディウム）", async () => {
      fetchReactionState.mockResolvedValue({ count: 0, myReactionId: undefined });
      const picked: string[] = [];
      render(
        <LocaleProvider value="en">
          <PostDetail
            post={makePost({ id: "loc2", caption: "観察", hashtags: ["パキポディウム"] })}
            onClose={() => {}}
            onSelectHashtag={(tg) => picked.push(tg)}
          />
        </LocaleProvider>,
      );
      const chip = await screen.findByRole("button", { name: "#Pachypodium" });
      fireEvent.click(chip);
      expect(picked).toEqual(["パキポディウム"]);
    });
  });
});
