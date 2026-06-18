import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import {
  getInstallDismissedAt,
  isDismissActive,
  setInstallDismissedAt,
} from "../../lib/pwa/install.ts";

/**
 * PWA「ホーム画面に追加」促し（#230）。全ページ共通（MainLayout に島として差す）。
 * retention 直結。SW 登録済みでも A2HS の導線が無いので控えめなバナーで促す。
 * 設計思想は mypace 由来（捕捉→却下記憶→既設置なら出さない→iOS 分岐）。
 *
 * - Chrome/Edge/Android: `beforeinstallprompt` を捕捉して握り、[追加]で `prompt()` を呼ぶ。
 * - iOS Safari は `beforeinstallprompt` 非対応なので、未設置のときだけ手動手順ヒントを出す。
 * - 既に設置済み（standalone）なら出さない。却下は localStorage に記憶し一定期間抑制する。
 *
 * SSR 安全: window/navigator/localStorage はトップレベルで触らず、マウント後 useEffect で参照する。
 */

// beforeinstallprompt の型（標準 lib に無いので最小限を宣言する）。
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/** 既に PWA として設置済みか（standalone 起動）。マウント後に呼ぶ。 */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mql = window.matchMedia?.("(display-mode: standalone)");
  // iOS Safari は display-mode を持たず navigator.standalone で見る。
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(mql?.matches) || iosStandalone;
}

/** iOS（iPhone/iPad）の Safari か。iPadOS は Mac を騙るので touch を併用して判定する。 */
function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipod|ipad/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Safari 以外（Chrome=CriOS, Firefox=FxiOS 等）は手順が違うので Safari に限る。
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|opios/i.test(ua);
  return isIos && isSafari;
}

type Variant = "prompt" | "ios" | null;

export default function InstallPrompt() {
  // 表示する種類（prompt=beforeinstallprompt あり / ios=手動手順 / null=出さない）。
  const [variant, setVariant] = useState<Variant>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  // ネイティブダイアログ待機中（install() の await 中）にアンマウントされたら、
  // 復帰後の setState を止めるための生存フラグ。effect 本体先頭で true に戻し
  // （StrictMode の再マウント・島再利用に備える）、cleanup で false を立てる。
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    // 既設置・抑制中なら何もしない（リスナも張らない）。
    if (isStandalone()) return;
    if (isDismissActive(getInstallDismissedAt(), Date.now())) return;

    const onBeforeInstallPrompt = (e: Event) => {
      // 既定のミニインフォバーを抑え、独自バナーに置き換える。
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVariant("prompt");
    };
    const onAppInstalled = () => {
      setVariant(null);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // iOS Safari は beforeinstallprompt が来ないので、未設置なら手動手順ヒントを出す。
    if (isIosSafari()) setVariant("ios");

    return () => {
      aliveRef.current = false;
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  // 却下（[あとで]/×）。一定期間（7日）抑制する。
  function dismiss() {
    setInstallDismissedAt(Date.now());
    setVariant(null);
    setDeferred(null);
  }

  // [追加]: 握っておいた prompt() を呼ぶ。結果に関わらずバナーは閉じる
  //（accepted なら appinstalled、dismissed なら次回まで抑制）。
  async function install() {
    if (!deferred) return;
    try {
      await deferred.prompt();
      // ネイティブダイアログ待機中にアンマウントされていたら setState を打たない。
      if (!aliveRef.current) return;
      const choice = await deferred.userChoice;
      if (!aliveRef.current) return;
      if (choice.outcome === "dismissed") setInstallDismissedAt(Date.now());
    } catch {
      // prompt が二重呼び等で弾かれても黙って閉じる（うるさくしない）。
    }
    if (!aliveRef.current) return;
    setVariant(null);
    setDeferred(null);
  }

  if (variant === null) return null;

  return (
    <div
      role="region"
      aria-label="ホーム画面に追加"
      // 右下・ScrollToTop（bottom-5 right-5）と重ならないよう下げ、モバイルは左右に張る。
      className="fixed bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 z-40 sm:max-w-sm glass-strong rounded-2xl shadow-lg p-4 ha-rise"
    >
      <div className="flex items-start gap-3">
        {/* ホーム画面に追加される実アプリアイコン（ハノーバ市旗の H）を見せる＝何を追加するのか分かる。
            汎用の芽アイコンの仮置きを廃止（#230・kako-jun 実機指摘）。icon.svg は角丸・地色を内包。 */}
        <img src="/icon.svg" alt="" aria-hidden width={36} height={36} className="w-9 h-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ha-green-deep">ホーム画面に追加</p>
          {variant === "ios" ? (
            <p className="mt-1 text-sm text-ha-ink/80">
              共有メニュー <span aria-hidden>↑</span> から「ホーム画面に追加」を選ぶと、アプリのように開けます。
            </p>
          ) : (
            <p className="mt-1 text-sm text-ha-ink/80">アプリのように開けます。</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            {variant === "prompt" && (
              <button
                type="button"
                onClick={install}
                className="rounded-full bg-ha-green text-ha-white px-4 py-1.5 text-sm font-semibold hover:brightness-110 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
              >
                追加
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="text-sm text-ha-ink/55 hover:text-ha-ink transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green rounded"
            >
              あとで
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="閉じる"
          className="grid place-items-center w-7 h-7 shrink-0 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
        >
          <Icon name="close" className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
