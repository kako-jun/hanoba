import {
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Avatar from "../feed/Avatar.tsx";
import Icon from "../ui/Icon.tsx";
import {
  swipeDirection,
  swipeProgress,
  swipeToBlur,
} from "../../lib/feed/carousel.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
import {
  type BookPage,
  buildCityHallBook,
  civicHub,
  type HubLink,
  mayorShortName,
} from "../../lib/lore/cityHall.ts";
import {
  useT,
  useLocale,
  LocaleProvider,
  resolveClientLocale,
  DEFAULT_LOCALE,
  type Locale,
} from "../../lib/i18n/index.ts";
import {
  BOOK_FRAME_SRC,
  BOOK_PAGE_SRC,
  MAYOR_AVATAR_SRC,
} from "../../lib/lore/cityHallAssets.ts";

// ハノーバ市民手帳（#163）。市長ボタニクス・フォン・ハノーバの声で語られる「本」。
// = 図鑑（集めて埋める読み物・#469）。機能導線（discover/ranking/me/compose）は
//   ヘッダ/フッタ（SiteHeader/SiteFooter）が持つので手帳からは外し、ここはロアに割り切る。
//
// #137/#510: レベル解禁ゲートを撤去し、全10ページを最初から閲覧可能にした。
// 初期ページは URL指定→保存位置→1p。「市政の窓口」（civicHub）は全ページ下部に共通表示する。

// ページ数は locale 非依存（10ページ固定）。既定 locale で1度組んで length を取る。
const TOTAL_PAGES = buildCityHallBook(DEFAULT_LOCALE).length;
export const BOOK_PAGE_STORAGE_KEY = "hanoba:citizen-handbook-page";

// SSR では useLayoutEffect が警告を出す（サーバに layout フェーズが無い）。
// クライアントでのみ layout（ペイント前）に走らせ、サーバでは no-op の effect に落とす。
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

// lang は about.astro がページの locale を流す（#147）＝SSR/初期描画の種（ja）。
// この島は LocaleProvider のルート（about.astro 直下・他の Provider に包まれない）なので、
// 自分で <LocaleProvider value={loc}> を張り、子（PageContent 等）は useLocale() で読む。
// loc はマウント後に resolveClientLocale() で確定する（en を選んでいれば en で描き直す）。
export default function CityHallBook({
  lang = DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  // lang は SSR/初期描画の種（既定言語＝go-live で en）。マウント後にクライアント解決値（ja を選んでいれば ja）へ寄せる。
  // 解決は下の useIsoLayoutEffect（ペイント前）で行う＝殻が既定言語で焼かれるため、非既定言語の
  // ユーザーで「一瞬 en → ja」のフラッシュが出るのを防ぐ（殻側の is:inline swap と同じ flash 回避方針）。
  const [loc, setLoc] = useState<Locale>(lang);
  const t = useT(loc);
  // 本文（構造化データ）と味付け文言は locale で組み直す。
  const bookPages = buildCityHallBook(loc);
  const bookTitleText = t("cityHall.book.title");

  const [page, setPage] = useState(1); // 1-indexed。安全既定は 1p。
  const panelRef = useRef<HTMLDivElement>(null);
  // 本のスワイプ（#275）。←→ボタン・キーボード矢印と同じ goPrev/goNext を駆動する。
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // スワイプ中のページ内容ぼかし（px・#275）。0＝ぼかし無し。reduced-motion ではかからない。
  const [swipeBlur, setSwipeBlur] = useState(0);

  useIsoLayoutEffect(() => {
    // 表示言語はクライアント解決（localStorage）。ペイント前（layout）に確定して
    // 「一瞬 en → ja」の言語フラッシュを消す（useEffect だと描画後に走り en が一瞬見える）。
    setLoc(resolveClientLocale());
    const pages = buildCityHallBook(resolveClientLocale());
    const requestedId = new URLSearchParams(window.location.search).get("page");
    const savedId = window.localStorage.getItem(BOOK_PAGE_STORAGE_KEY);
    const initial = pages.find((item) => item.id === requestedId) ?? pages.find((item) => item.id === savedId);
    if (initial !== undefined) setPage(initial.page);
  }, []);
  const current = bookPages.find((p) => p.page === page) ?? bookPages[0]!;

  const canPrev = page > 1;
  // 全ページ最初から閲覧可能（#510 方針B）＝最終ページまで前送りできる。ロック上限は無い。
  const canNext = page < TOTAL_PAGES;

  function goTo(nextPage: number) {
    const bounded = Math.max(1, Math.min(TOTAL_PAGES, nextPage));
    setPage(bounded);
    const id = bookPages.find((item) => item.page === bounded)?.id;
    if (id !== undefined) {
      const url = new URL(window.location.href);
      url.searchParams.set("page", id);
      window.history.replaceState(null, "", url);
    }
    panelRef.current?.scrollIntoView({
      block: "start",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  function goPrev() {
    if (canPrev) goTo(page - 1);
  }
  function goNext() {
    if (canNext) goTo(page + 1);
  }

  useEffect(() => {
    const id = bookPages.find((item) => item.page === page)?.id;
    if (id !== undefined) window.localStorage.setItem(BOOK_PAGE_STORAGE_KEY, id);
  }, [page, bookPages]);

  // 本のスワイプでページめくり＋スワイプ量で中身をぼかす（#275・PostDetail と同じ作法）。
  // 写真カルーセルと純関数（swipeProgress/swipeToBlur/swipeDirection）を共有する。
  function onTouchStart(e: ReactTouchEvent) {
    const t = e.touches[0];
    if (t === undefined) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  // ドラッグ中はスワイプ量で中身をぼかす（水平優位のときだけ＝縦スクロールを邪魔しない）。
  // 始点なし・縦優位・reduced-motion ではぼかさない（0 のまま／0 に戻す）。
  function onTouchMove(e: ReactTouchEvent) {
    const start = touchStartRef.current;
    if (start === null) return;
    if (prefersReducedMotion()) return;
    const t = e.touches[0];
    if (t === undefined) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
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
    const t = e.changedTouches[0];
    if (t === undefined) return;
    // 左スワイプ＝次（next）／右スワイプ＝前（prev）。ロック越え・端は goPrev/goNext が no-op。
    const dir = swipeDirection(t.clientX - start.x, t.clientY - start.y);
    if (dir === "next") goNext();
    else if (dir === "prev") goPrev();
  }

  // ←/→ で本をめくる（本のメタファー・PostDetail のカルーセル操作に倣う）。
  // ← = 前（1p 未満には行かない）／→ = 次（最終ページより先へは進めない）。全ページ閲覧可（#510 方針B）。
  // 入力欄にフォーカスがあるときは横取りしない。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // フォーム入力中・編集可能要素の上では矢印を奪わない（テキスト移動を妨げない）。
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t?.isContentEditable === true
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

  return (
    <LocaleProvider value={loc}>
      <section
        className="ha-rise flex flex-col gap-5"
        aria-label={bookTitleText}
      >
        <header>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ha-green-deep">
            {bookTitleText}
          </h1>
        </header>

        {/* 本体パネル（暗色グラス）。ページが切り替わるたび key で穏やかに描き直す。
          スワイプでページめくり（#275）＝左で次・右で前。ぼかしは中身（下の key={page}）だけにかけ、
          和綴じ枠（このパネルの border）は固定する＝枠ごとぼかす違和感を避ける。 */}
        <div
          ref={panelRef}
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
            <PageContent page={current} />
          </div>

          {/* 市政の窓口は全ページ下部に常設する。 */}
          <CivicWindows />

          <nav
            className="flex items-center justify-between gap-1 pt-1"
            aria-label={t("cityHall.nav.aria")}
          >
            <div className="flex items-center">
              <button type="button" onClick={() => goTo(1)} disabled={!canPrev} aria-label={t("cityHall.nav.first")} className="shrink-0 whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">|←</button>
              <button
                type="button"
                onClick={goPrev}
                disabled={!canPrev}
                aria-label={t("cityHall.nav.prev")}
                className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                <Icon name="chevron" className="w-4 h-4 rotate-90" />
                {t("cityHall.nav.prev.label")}
              </button>
            </div>

            <span
              className="shrink-0 text-sm text-ha-ink/60 tabular-nums"
              aria-hidden="true"
            >
              {t("cityHall.nav.indicator", { page, total: TOTAL_PAGES })}
            </span>

            <div className="flex items-center">
              <button
                type="button"
                onClick={goNext}
                disabled={!canNext}
                aria-label={t("cityHall.nav.next")}
                className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                {t("cityHall.nav.next.label")}
                <Icon name="chevron" className="w-4 h-4 -rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => goTo(TOTAL_PAGES)}
                disabled={!canNext}
                aria-label={t("cityHall.nav.last")}
                className="shrink-0 whitespace-nowrap rounded-full px-1 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              >
                →|
              </button>
            </div>
          </nav>
        </div>
      </section>
    </LocaleProvider>
  );
}

/**
 * 市政の窓口（civic strip）。全ページ下部に置く導線。
 * 住民投票（/vote・#160 開庁）はヘッダ/フッタに無く手帳が唯一の入口なので健在。品評会（#161）・
 * 市長ブログ（#164）は近日開庁のまま並ぶ。地図本体との間は「にじみ」（.ha-bleed）の柔らかい境界で
 * 区切る（#263 踏襲）。開庁＝リンク／近日開庁＝非リンク（HubLinkItem が出し分ける）。
 */
function CivicWindows() {
  const locale = useLocale();
  const t = useT(locale);
  const links = civicHub(locale);
  return (
    <section className="flex flex-col gap-2">
      <div className="ha-bleed" aria-hidden="true" />
      <h3 className="px-1 text-sm font-semibold tracking-wide text-ha-green-deep/75">
        {t("cityHall.map.civic.heading")}
      </h3>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <HubLinkItem key={link.label} link={link} />
        ))}
      </ul>
    </section>
  );
}

/** ハブのリンク 1 件。開庁＝リンク／近日開庁＝非リンク。群分けで各群から使うので切り出す（#263）。 */
function HubLinkItem({ link }: { link: HubLink }) {
  if (link.route !== null) {
    return (
      <li>
        <a
          href={link.route}
          className="flex items-center justify-between gap-3 rounded-xl bg-white/5 hover:bg-ha-green/10 border border-white/10 px-4 py-3 text-ha-ink hover:text-ha-green-deep transition-colors"
        >
          <span className="font-medium">{link.label}</span>
          <Icon
            name="chevron"
            className="w-4 h-4 -rotate-90 text-ha-green/70 shrink-0"
          />
        </a>
      </li>
    );
  }
  return (
    <li
      aria-disabled="true"
      className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 px-4 py-3 text-ha-ink/40"
    >
      <span>{link.label}</span>
      <span className="text-xs text-ha-ink/40 shrink-0">{link.comingSoon}</span>
    </li>
  );
}

/**
 * 全ページ共通の語り手マーク（#455）。市長ボタニクス・フォン・ハノーバのアイコン＋肩書きを各ページ冒頭に出す
 * （本全体が市長の声なので 2ページ目以降も）。顔は秘密＝ジョウロの肖像（#219①）。Avatar は装飾（alt 空）扱いで
 * 隣に市長名テキストを置き a11y を満たす。短い呼び名「ボタニクス市長」（フルネームは本文側・#262）。
 */
function MayorMark() {
  const locale = useLocale();
  const t = useT(locale);
  const shortName = mayorShortName(locale);
  return (
    <div className="flex items-center gap-3">
      <Avatar
        src={MAYOR_AVATAR_SRC}
        name={shortName}
        className="w-16 h-16 ring-1 ring-white/10"
      />
      <span className="text-sm text-ha-ink/60">
        {t("cityHall.mayorTitle", { name: shortName })}
      </span>
    </div>
  );
}

/** 解放済みページの中身を種類ごとに描く。 */
function PageContent({ page }: { page: BookPage }) {
  const locale = useLocale();
  const t = useT(locale);
  switch (page.kind) {
    case "guide":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
          <MayorMark />
          {page.image !== undefined && (
            <div className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl">
              <img src={page.image} alt={page.title} className="w-full scale-[1.02] object-cover" />
            </div>
          )}
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">{page.lead}</p>
          {page.note !== undefined && <p className="text-xs text-ha-ink/50 [word-break:auto-phrase]">{page.note}</p>}
        </article>
      );

    case "welcome":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">
            {page.title}
          </h2>
          {/* 見出しの下に市長アイコン＋肩書き（語り手・#455 で全ページ共通化）。顔は秘密＝ジョウロ（#219①）。 */}
          <MayorMark />
          {page.blocks.map((b, i) => {
            if (b.kind === "image") {
              return (
                <img
                  key={i}
                  src={b.src}
                  alt={b.alt}
                  className="mx-auto w-full max-w-[280px] rounded-xl object-cover"
                />
              );
            }
            if (b.kind === "note") {
              return (
                <p
                  key={i}
                  className="text-xs text-ha-ink/55 leading-relaxed [word-break:auto-phrase]"
                >
                  {b.text}
                </p>
              );
            }
            return (
              <p
                key={i}
                className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]"
              >
                {b.text}
              </p>
            );
          })}
        </article>
      );

    case "map":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">
            {page.title}
          </h2>
          <MayorMark />
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">
            {page.lead}
          </p>
          {/* 地図ビジュアルの枠（#469・#137 で実画像を差し込むまでの前方互換スロット）。
              lead（市長の前口上）の直後・名所（注釈）の前に置く＝絵が上、注釈が下。 */}
          {page.image ? (
            <img
              src={page.image}
              alt={page.title}
              className="mx-auto w-full max-w-[280px] rounded-xl object-cover"
            />
          ) : (
            // 仮置きフレーム＝「絵は近日」の軽い未完感（ロック頁の veil ほど沈めない）。
            // 薄いインクの破線枠＋ごく薄い地、中央に読めるキャプション。
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl border border-dashed border-ha-green/30 bg-white/[0.03] px-6 text-center">
              <span className="font-display text-sm tracking-wide text-ha-ink/45">
                {t("cityHall.map.placeholder")}
              </span>
            </div>
          )}
          {/* 名所（ランドマーク）＝沿革（chronicle）風の体裁に寄せる。名を太字、説明を小さく添える。 */}
          <ul className="flex flex-col gap-3">
            {page.landmarks.map((lm) => (
              <li
                key={lm.name}
                className="flex flex-col gap-0.5 border-l-2 border-ha-green/30 pl-4"
              >
                <span className="text-sm font-semibold text-ha-green-deep">
                  {lm.name}
                </span>
                <span className="text-sm text-ha-ink/80 leading-relaxed [word-break:auto-phrase]">
                  {lm.text}
                </span>
              </li>
            ))}
          </ul>
          {/* 地図の注記。市政の窓口はページ共通領域に置く。 */}
          <p className="text-xs text-ha-ink/50 [word-break:auto-phrase]">
            {page.note}
          </p>
        </article>
      );

    case "chronicle":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">
            {page.title}
          </h2>
          <MayorMark />
          {/* 市長の前口上（全ページ冒頭に市長の言葉を必須化・#469 変更B）。 */}
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">
            {page.lead}
          </p>
          <ol className="flex flex-col gap-3">
            {page.entries.map((e) => (
              <li
                key={e.era}
                className="flex flex-col gap-0.5 border-l-2 border-ha-green/30 pl-4"
              >
                <span className="text-sm font-semibold text-ha-green-deep">
                  {e.era}
                </span>
                <span className="text-sm text-ha-ink/80 leading-relaxed [word-break:auto-phrase]">
                  {e.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ha-ink/50 [word-break:auto-phrase]">
            {page.note}
          </p>
        </article>
      );

    case "ordinances":
      return (
        <article className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">
            {page.title}
          </h2>
          <MayorMark />
          {/* 市長の前口上（全ページ冒頭に市長の言葉を必須化・#469 変更B）。 */}
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">
            {page.lead}
          </p>
          <dl className="flex flex-col gap-5">
            {page.ordinances.map((o) => (
              <div key={o.article} className="flex flex-col gap-1.5">
                <dt className="text-base font-semibold text-ha-ink">
                  {o.article} {o.text}
                </dt>
                <dd className="text-sm text-ha-ink/70 leading-relaxed [word-break:auto-phrase] border-l-2 border-ha-green/30 pl-4">
                  {o.commentary}
                </dd>
              </div>
            ))}
          </dl>
        </article>
      );
  }
}
