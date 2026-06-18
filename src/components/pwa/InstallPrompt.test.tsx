// PWA「ホーム画面に追加」促し（#230）バナーの単体テスト。
// 純粋ロジック（却下記憶・抑制判定）は lib/pwa/install.test.ts で固定済み。ここでは
// コンポーネントの「いつ・どの種類のバナーを出すか／出さないか」の分岐と、却下時の
// 抑制記録・[追加]の prompt() 委譲を固定する（1テスト1観点）。
//
// happy-dom は beforeinstallprompt / matchMedia(standalone) / navigator.standalone の
// 実体を持たない（既定は desktop UA・matchMedia は matches:false）。そこで
// Object.defineProperty / vi.stubGlobal / 合成 Event で環境を作って検証する
// （ScrollToTop の matchMedia/window モック流儀に合わせる）。

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstallPrompt from "./InstallPrompt.tsx";
import { getInstallDismissedAt, setInstallDismissedAt } from "../../lib/pwa/install.ts";

// matchMedia('(display-mode: standalone)') の matches を制御する。
function stubStandaloneMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query.includes("standalone") ? matches : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    })),
  );
}

// navigator.userAgent を差し替える（happy-dom は proto の configurable getter なので own で上書き可能）。
function stubUserAgent(ua: string) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua });
}

// navigator.standalone（iOS Safari の既設置フラグ）を差し替える。
function stubNavigatorStandalone(value: boolean | undefined) {
  Object.defineProperty(navigator, "standalone", { configurable: true, value });
}

// beforeinstallprompt の合成イベント。prompt()/userChoice をスパイで持たせる。
function makeBeforeInstallPromptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: ReturnType<typeof vi.fn>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome, platform: "web" });
  return event;
}

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1";
const DESKTOP_CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const BANNER = { name: "ホーム画面に追加" } as const;

describe("InstallPrompt（#230 A2HS 促しバナー）", () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubStandaloneMedia(false); // 既定は未設置
    stubUserAgent(DESKTOP_CHROME); // 既定は iOS でない
    stubNavigatorStandalone(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("beforeinstallprompt を捕捉すると preventDefault し、[追加]付きバナーを出す", () => {
    render(<InstallPrompt />);
    // 捕捉前は何も出ていない。
    expect(screen.queryByRole("region", BANNER)).toBeNull();

    const event = makeBeforeInstallPromptEvent();
    const preventDefault = vi.spyOn(event, "preventDefault");
    act(() => {
      window.dispatchEvent(event);
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(screen.getByRole("region", BANNER)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "追加" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "あとで" })).toBeInTheDocument();
  });

  it("既設置（display-mode: standalone）ならマウントしてもバナーを出さない", () => {
    stubStandaloneMedia(true);
    render(<InstallPrompt />);
    // standalone のためリスナを張らない＝beforeinstallprompt が来ても無反応。
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("iOS Safari かつ未設置なら beforeinstallprompt 無しでも手動ヒント（共有→ホーム画面に追加）を出す", () => {
    stubUserAgent(IPHONE_SAFARI);
    render(<InstallPrompt />);
    expect(screen.getByRole("region", BANNER)).toBeInTheDocument();
    expect(screen.getByText(/共有メニュー/)).toBeInTheDocument();
    expect(screen.getByText(/ホーム画面に追加.+選ぶと/)).toBeInTheDocument();
    // 手動手順なので Chrome の[追加]ボタンは出さない。
    expect(screen.queryByRole("button", { name: "追加" })).toBeNull();
  });

  it("iOS でも非 Safari（CriOS）なら何も出さない（誤った Chrome 手順を見せない）", () => {
    stubUserAgent(IPHONE_CHROME);
    render(<InstallPrompt />);
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("[追加]クリックで握っておいた beforeinstallprompt の prompt() を呼ぶ", async () => {
    render(<InstallPrompt />);
    const event = makeBeforeInstallPromptEvent("accepted");
    act(() => {
      window.dispatchEvent(event);
    });

    // install() は async（prompt → userChoice → 閉じる）。microtask まで act でフラッシュする。
    await act(async () => {
      screen.getByRole("button", { name: "追加" }).click();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    // accepted なので却下記録はしない（抑制は appinstalled 任せ）。
    expect(getInstallDismissedAt()).toBeNull();
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("appinstalled イベントでバナーが消える", () => {
    render(<InstallPrompt />);
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(screen.getByRole("region", BANNER)).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("[あとで]クリックで却下時刻を記録しバナーが消える", () => {
    render(<InstallPrompt />);
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(getInstallDismissedAt()).toBeNull();

    act(() => {
      screen.getByRole("button", { name: "あとで" }).click();
    });
    expect(getInstallDismissedAt()).not.toBeNull();
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("×（閉じる）クリックでも却下時刻を記録しバナーが消える", () => {
    render(<InstallPrompt />);
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });

    act(() => {
      screen.getByRole("button", { name: "閉じる" }).click();
    });
    expect(getInstallDismissedAt()).not.toBeNull();
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("抑制期間内（直前に却下済み）ならマウントしてもバナーを出さず、リスナも張らない", () => {
    setInstallDismissedAt(Date.now());
    render(<InstallPrompt />);
    // 抑制中はリスナを張らない＝beforeinstallprompt も iOS でも出ない。
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent());
    });
    expect(screen.queryByRole("region", BANNER)).toBeNull();
  });

  it("マウント〜捕捉〜却下の一連で console.error を増やさない（act/警告の混入防止）", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<InstallPrompt />);
      act(() => {
        window.dispatchEvent(makeBeforeInstallPromptEvent());
      });
      act(() => {
        screen.getByRole("button", { name: "あとで" }).click();
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
