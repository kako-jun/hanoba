import {
  type ReactNode,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Icon from "../ui/Icon.tsx";
import {
  swipeDirection,
  swipeProgress,
  swipeToBlur,
} from "../../lib/feed/carousel.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
import { useLocale, useT } from "../../lib/i18n/index.ts";
import { BOOK_FRAME_SRC, BOOK_PAGE_SRC } from "../../lib/lore/cityHallAssets.ts";

// 本ページャー（#164）。ハノーバ市民手帳（CityHallBook・#163/#137）から抽出した「本」の共通 UI。
// 枠/紙面の border-image + 背景画像・ページャーUI（先頭/前/次/末尾＋ページ表示）・キーボード矢印・
// スワイプ＋ぼかし遷移・URL同期（?page=<安定ID>）＋localStorage 永続化を担う。
// ページ内容の描画は呼び出し元（renderPage）に委譲する＝市民手帳・市政だより（#164）・将来の
// 品評会（#161）で共有する。
//
// **`LocaleProvider` の内側で使う前提**（呼び出し元が useT/useLocale の文脈を張る）。
// ページ位置は id（安定・locale 非依存）で永続化する＝locale 切替やページ内容の翻訳差に影響されない。

// SSR では useLayoutEffect が警告を出す（サーバに layout フェーズが無い）。
// クライアントでのみ layout（ペイント前）に走らせ、サーバでは no-op の effect に落とす。
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** ページャーが扱う最小のページ形。内容は呼び出し元が持つ（renderPage に委譲）。 */
export interface BookPagerPage {
  /** 安定 ID（locale 非依存）。URL（?page=）・localStorage の永続化キーに使う。 */
  id: string;
  /** 1-indexed のページ番号。 */
  page: number;
}

export interface BookPagerProps<T extends BookPagerPage> {
  /** 本の在世タイトル（見出し h1・section aria-label に使う）。 */
  title: string;
  /** 全ページ（呼び出し元が locale で組み立て済み・順序固定）。 */
  pages: T[];
  /** localStorage の永続化キー（本ごとに別キーにする＝手帳と市政だよりを混同しない）。 */
  storageKey: string;
  /** URL・保存位置に有効な ID が無いときに開く端。既定 first は市民手帳の挙動を維持する。 */
  defaultPage?: "first" | "last";
  /** 現在ページの中身を描画する（ページ種別ごとの描画は呼び出し元の責務）。 */
  renderPage: (page: T) => ReactNode;
  /** ページ内容の下・ページャー操作の上に置く共通領域（市民手帳の「市政の窓口」等・任意）。 */
  footer?: ReactNode;
}

export default function BookPager<T extends BookPagerPage>({
  title,
  pages,
  storageKey,
  defaultPage = "first",
  renderPage,
  footer,
}: BookPagerProps<T>) {
  const locale = useLocale();
  const t = useT(locale);
  const totalPages = pages.length;

  const [page, setPage] = useState(1); // 1-indexed。安全既定は 1p。
  // 初期解決前の暫定 1p を localStorage へ書き戻して保存位置を潰さないためのガード。
  const [initialized, setInitialized] = useState(false);
  // 本のスワイプ（#275）。←→ボタン・キーボード矢印と同じ goPrev/goNext を駆動する。
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // スワイプ中のページ内容ぼかし（px・#275）。0＝ぼかし無し。reduced-motion ではかからない。
  const [swipeBlur, setSwipeBlur] = useState(0);

  useIsoLayoutEffect(() => {
    // 初期ページは「有効なURL → 有効な保存位置 → defaultPage」の順。
    // 不正・削除済み ID は次の候補へ安全にフォールバックする。
    // id は locale 非依存なので、呼び出し元がどの locale で pages を組んでいても解決できる。
    const requestedId = new URLSearchParams(window.location.search).get("page");
    const savedId = window.localStorage.getItem(storageKey);
    const fallback = defaultPage === "last" ? pages.at(-1) : pages[0];
    const initial =
      pages.find((item) => item.id === requestedId) ??
      pages.find((item) => item.id === savedId) ??
      fallback;
    if (initial !== undefined) setPage(initial.page);
    setInitialized(true);
    // マウント時の初期解決のみ行う（pages 差し替えでの再解決はしない＝ページ送り中に locale が
    // 変わっても現在ページを保つ既存挙動を維持）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = pages.find((p) => p.page === page) ?? pages[0]!;

  const canPrev = page > 1;
  const canNext = page < totalPages;

  function goTo(nextPage: number) {
    const bounded = Math.max(1, Math.min(totalPages, nextPage));
    setPage(bounded);
    const id = pages.find((item) => item.page === bounded)?.id;
    if (id !== undefined) {
      const url = new URL(window.location.href);
      url.searchParams.set("page", id);
      window.history.replaceState(null, "", url);
    }
  }

  function goPrev() {
    if (canPrev) goTo(page - 1);
  }
  function goNext() {
    if (canNext) goTo(page + 1);
  }

  useEffect(() => {
    if (!initialized) return;
    const id = pages.find((item) => item.page === page)?.id;
    if (id !== undefined) window.localStorage.setItem(storageKey, id);
  }, [initialized, page, pages, storageKey]);

  // 本のスワイプでページめくり＋スワイプ量で中身をぼかす（#275・PostDetail と同じ作法）。
  // 写真カルーセルと純関数（swipeProgress/swipeToBlur/swipeDirection）を共有する。
  function onTouchStart(e: ReactTouchEvent) {
    const touch = e.touches[0];
    if (touch === undefined) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }
  // ドラッグ中はスワイプ量で中身をぼかす（水平優位のときだけ＝縦スクロールを邪魔しない）。
  // 始点なし・縦優位・reduced-motion ではぼかさない（0 のまま／0 に戻す）。
  function onTouchMove(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    if (start === null) return;
    if (prefersReducedMotion()) return;
    const touch = e.touches[0];
    if (touch === undefined) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) <= Math.abs(dy)) {
      setSwipeBlur(0);
      return;
    }
    // 整数 px に丸め、同値ならバイルアウト（毎フレームの無駄な再レンダを省く・#275）。
    const next = Math.round(swipeToBlur(swipeProgress(dx)));
    setSwipeBlur((prev) => (prev === next ? prev : next));
  }
  function onTouchEnd(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    // 指を離したらぼかしを解く（遷移できても／できなくても）。
    setSwipeBlur(0);
    if (start === null) return;
    const touch = e.changedTouches[0];
    if (touch === undefined) return;
    // 左スワイプ＝次（next）／右スワイプ＝前（prev）。ロック越え・端は goPrev/goNext が no-op。
    const dir = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (dir === "next") goNext();
    else if (dir === "prev") goPrev();
  }

  // ←/→ で本をめくる（本のメタファー・PostDetail のカルーセル操作に倣う）。
  // ← = 前（1p 未満には行かない）／→ = 次（最終ページより先へは進めない）。
  // 入力欄にフォーカスがあるときは横取りしない。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // フォーム入力中・編集可能要素の上では矢印を奪わない（テキスト移動を妨げない）。
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable === true
      ) {
        return;
      }
      if (e.key === "ArrowLeft" && canPrev) {
        goTo(page - 1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight" && canNext) {
        goTo(page + 1);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canPrev, canNext, page]);

  // pages=[] の防御（#164）。呼び出し元のデータ組み立てミス等で空配列を渡されても、
  // current（pages[0]!）が undefined になって renderPage が壊れる形でクラッシュしない
  // よう、ここで安全に空描画へ落とす。全 hooks の呼び出し後（rules-of-hooks を守る）。
  if (totalPages === 0) return null;

  return (
    <section className="ha-rise flex flex-col gap-5" aria-label={title}>
      <header>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ha-green-deep">
          {title}
        </h1>
      </header>

      {/* 本体パネル（暗色グラス）。ページが切り替わるたび key で穏やかに描き直す。
        スワイプでページめくり（#275）＝左で次・右で前。ぼかしは中身（下の key={page}）だけにかけ、
        和綴じ枠（このパネルの border）は固定する＝枠ごとぼかす違和感を避ける。 */}
      <div
        className="flex flex-col gap-5 border-solid border-[20px] sm:border-[32px] border-l-[40px] sm:border-l-[60px] p-5 sm:p-7 min-h-[520px]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          // 最初の AI 和綴じ枠（綴じ込み）。左（背）は綴じを見せるため厚い（slice 150）。
          borderImageSource: `url('${BOOK_FRAME_SRC}')`,
          borderImageSlice: "120 120 120 150",
          borderImageRepeat: "stretch",
          backgroundImage: `url('${BOOK_PAGE_SRC}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#13161e",
          // 地（台紙）の縁を全周ふんわりぼかす＝枠との境界を曖昧にし、各辺の事情の違い
          //（左=綴じ／上下右=マット）で隙間の見え方が揃わない問題を目立たなくする（kako-jun 案）。
          boxShadow: "inset 0 0 18px 5px #13161e",
        }}
      >
        {/* aria-live でページ遷移を読み上げる。reduced-motion は CSS 側で ha-rise が無効。
          スワイプ中はこの中身だけぼかす（#275）。ドラッグ中は即追従（transition none）、
          離したら 0.25s で戻す。swipeBlur は 1枚／reduced-motion では常に 0＝無効。 */}
        <div
          key={page}
          className="ha-rise flex flex-col gap-4"
          aria-live="polite"
          style={{
            filter: swipeBlur > 0 ? `blur(${swipeBlur}px)` : undefined,
            transition: swipeBlur > 0 ? "none" : "filter 0.25s ease",
          }}
        >
          {renderPage(current)}
        </div>

        {footer}

        <nav
          className="flex items-center justify-between gap-1 pt-1"
          aria-label={t("book.nav.aria")}
        >
          <div className="flex items-center">
            <button type="button" onClick={() => goTo(1)} disabled={!canPrev} aria-label={t("book.nav.first")} className="shrink-0 whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">|←</button>
            <button
              type="button"
              onClick={goPrev}
              disabled={!canPrev}
              aria-label={t("book.nav.prev")}
              className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Icon name="chevron" className="w-4 h-4 rotate-90" />
              {t("book.nav.prev.label")}
            </button>
          </div>

          <span
            className="shrink-0 text-sm text-ha-ink/60 tabular-nums"
            aria-hidden="true"
          >
            {t("book.nav.indicator", { page, total: totalPages })}
          </span>

          <div className="flex items-center">
            <button
              type="button"
              onClick={goNext}
              disabled={!canNext}
              aria-label={t("book.nav.next")}
              className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              {t("book.nav.next.label")}
              <Icon name="chevron" className="w-4 h-4 -rotate-90" />
            </button>
            <button
              type="button"
              onClick={() => goTo(totalPages)}
              disabled={!canNext}
              aria-label={t("book.nav.last")}
              className="shrink-0 whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              →|
            </button>
          </div>
        </nav>
      </div>
    </section>
  );
}
