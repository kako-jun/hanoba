import { Profiler, type ProfilerOnRenderCallback } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #525 S1（セルフレビュー・should）: MyGrid の accountName state が種撒き無し（useState(null)）だと、
// 既存の名前を持つユーザーが /me を開いたとき、ProfileEditor の nameHint 同期エフェクトが
// マウント直後に自分自身の正しい値を一度 null へ巻き戻すレースがあった（AccountName の onChange が
// MyGrid へ最新値を伝える前に、nameHint 同期エフェクトがまだ render-1 時点の null を見てしまう）。
//
// AccountName/ProfileEditor は本テストの主役なので実装のまま使う（モックしない）。ネットワークだけ
// client.ts で止める。keys.ts も実装のまま（localStorage）で、既存名を hanoba:name に種撒きして検証する。
const fetchMyPosts = vi.fn();
const fetchMyProfileResilient = vi.fn();
const saveDisplayName = vi.fn();
const saveProfile = vi.fn();

vi.mock("../../lib/nostr/client.ts", () => ({
  fetchMyPosts: (...a: unknown[]) => fetchMyPosts(...a),
  deletePost: vi.fn(),
  fetchMyProfileResilient: (...a: unknown[]) => fetchMyProfileResilient(...a),
  // #537: fetchReactionCount → fetchReactionState（件数＋自分の反応）。
  fetchReactionState: () => Promise.resolve({ count: 0, myReactionId: undefined }),
  editPost: vi.fn(),
  fetchEngagementCountsBatch: () =>
    Promise.resolve({ reactions: new Map<string, number>(), comments: new Map<string, number>() }),
  fetchReplies: () => Promise.resolve([]),
  saveDisplayName: (...a: unknown[]) => saveDisplayName(...a),
  saveProfile: (...a: unknown[]) => saveProfile(...a),
}));

import MyGrid from "./MyGrid.tsx";

describe("MyGrid × AccountName/ProfileEditor 実結合（#525 S1 nameHint 初期同期レース回帰防止）", () => {
  beforeEach(() => {
    fetchMyPosts.mockReset().mockResolvedValue({ posts: [], rawCount: 0 });
    fetchMyProfileResilient.mockReset().mockResolvedValue(null);
    saveDisplayName.mockReset().mockResolvedValue(undefined);
    saveProfile.mockReset().mockResolvedValue({ id: "evt1" });
    localStorage.clear();
    // MyGrid は resolveClientLocale() 経由で hanoba:lang を読み、既定コンテキスト（"ja"）を上書きする
    // （test-setup.ts のグローバル beforeEach と同じ理由）。上の clear() が消すので明示的に戻す。
    localStorage.setItem("hanoba:lang", "ja");
  });

  afterEach(() => cleanup());

  it("既存の名前でマウントすると、ProfileEditor の編集トグルが即座に有効化され、無駄な再コミットが起きない（#525 S1）", async () => {
    // 既存の名乗り（種撒き）。AccountName/ProfileEditor は両方ともこの localStorage を
    // getDisplayName() 経由で読む（#525 S1 の再現条件）。
    localStorage.setItem("hanoba:name", "アガベ太郎");
    localStorage.setItem("hanoba:sk", "67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa");

    // load()（投稿取得）は本テストの関心外だが実行はされる。その非同期継続がこの後の
    // 同期アサーション区間で act() 追跡外にこぼれても実害は無い（アサート対象の commitCount は
    // その継続が走る前に読み切る）ので、警告だけ黙らせる。
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    // React Profiler でマウント〜同期完走までの実コミット回数を数える（子をモックせず実挙動で計測）。
    // レースがあると「初期コミット→(accountName 更新＋name 巻き戻し)→(nameHint 再同期)」で
    // 3 コミット目が余分に発生する。種撒き（本 PR の修正）があれば最大 2 コミットで収束する。
    let commitCount = 0;
    const onRender: ProfilerOnRenderCallback = () => {
      commitCount += 1;
    };

    render(
      <Profiler id="me-name-sync-probe" onRender={onRender}>
        <MyGrid />
      </Profiler>,
    );

    // マウント直後（load() の非同期投稿取得を待つ前）の時点で、既に名前は正しく確定しているはず。
    // レースがあると、この時点までに「正しい値→null への巻き戻し→再同期で正しい値」という
    // 無駄なコミットを踏んでから収束する（最終値は同じでも過程が汚れる＝S1 の核心）。
    const button = screen.getByRole("button", { name: /編集/ });
    expect(button).not.toBeDisabled();
    expect(screen.queryByText("先にハンドルネームを登録してください。")).not.toBeInTheDocument();

    // ProfileEditor 自身の初期化エフェクト（getDisplayName 読み直し）による1回の再コミットは織り込み
    // 済みだが、それ以上（nameHint 巻き戻し→再同期の余分な3コミット目）は許容しない。
    expect(commitCount).toBeLessThanOrEqual(2);

    // load() の残余更新を act 内で消化してから終える（他テストへの警告漏れ防止）。
    await screen.findByText("まだ、あなたの植物はありません。");
    consoleError.mockRestore();
  });

  it("名前未設定でマウントすると、編集トグルは無効化されたまま（回帰防止の対照ケース）", async () => {
    localStorage.setItem("hanoba:sk", "67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa");
    render(<MyGrid />);
    const button = screen.getByRole("button", { name: /編集/ });
    expect(button).toBeDisabled();
    expect(screen.getByText("先にハンドルネームを登録してください。")).toBeInTheDocument();
    await screen.findByText("まだ、あなたの植物はありません。");
  });
});
