import { type TouchEvent as ReactTouchEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import Avatar from "../feed/Avatar.tsx";
import Icon from "../ui/Icon.tsx";
import { swipeDirection, swipeProgress, swipeToBlur } from "../../lib/feed/carousel.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
import { fetchMyPosts } from "../../lib/nostr/client.ts";
import { getDisplayName, getPublicKeyHex } from "../../lib/nostr/keys.ts";
import {
  type CitizenLevel,
  citizenLevel,
  citizenLevelFull,
  defaultPage,
  maxUnlockedPage,
} from "../../lib/lore/citizen.ts";
import {
  type BookPage,
  buildCityHallBook,
  type HubLink,
  levelFlavor,
  LOCKED_PAGE_VEIL,
  lockedTeaser,
  mayorShortName,
} from "../../lib/lore/cityHall.ts";
import { useT, useLocale, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";

// 市長ボタニクス・フォン・ハノーバの肖像（語り手アイコン）。
// 顔は秘密という世界観のため、肖像の代わりにジョウロの写真を掲げる（public 直下の静的アセット）。
const MAYOR_AVATAR_SRC = "/mayor-botanics-watering-can.webp";

// ハノーバ市民手帳（#163）。市長ボタニクス・フォン・ハノーバの声で語られる「本」。
// = 図鑑（集めて埋める読み物・1 レベル=1 ページ解放・#469）。機能導線（discover/ranking/me/compose）は
//   ヘッダ/フッタ（SiteHeader/SiteFooter）が持つので手帳からは外し、ここはロアと早期ご褒美（街の地図）に割り切る。
//
// 市民レベル（Nostr 由来＝backendless）でページが 1 枚ずつ解放される（#469）。
// - L0 旅人: 名前未登録 → 1p 移住案内のみ。
// - L1 市民: 名前登録済み → 2p 街の地図まで（既定で 2p を開く＝ご褒美ページを先に見せる）。
// - L2:      名前＋投稿数 >= 5 ＋ 在籍 >= 14 日 → 3p 沿革まで。
// - L3:      名前＋投稿数 >= 15 ＋ 在籍 >= 30 日 → 4p 市の条文まで。
//
// 前方ロック／後方オープン: 解放済みページ（<= maxUnlocked）には自由に行き来でき、
// その先は「？？？」ティザー（枠は見えるが開けない・図鑑式）で進む動機にする。
//
// client:load。鍵・relay 取得はクライアントのみ（getDisplayName / getPublicKeyHex / fetchMyPosts）。
// SSR では window/localStorage を触らない（keys.ts が SSR 安全・取得は useEffect 内）。

// ページ数は locale 非依存（4 ページ固定）。既定 locale で 1 度組んで length を取る。
const TOTAL_PAGES = buildCityHallBook(DEFAULT_LOCALE).length; // 4

// SSR では useLayoutEffect が警告を出す（サーバに layout フェーズが無い）。
// クライアントでのみ layout（ペイント前）に走らせ、サーバでは no-op の effect に落とす。
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * 名前・投稿から市民レベルを判定する（クライアント専用）。
 * - `level`     ページ解放用のキャップ済みレベル（0|1|2|3・maxUnlocked 等に使う）。
 * - `levelFull` タイトル表記用の真レベル（非キャップ・L1〜L6＝CitizenStats と同じ・#469 変更A）。
 * 名前が無ければ即 L0。名前があれば投稿を引いて判定。
 * 投稿取得が失敗しても名前があれば L1（名乗った市民を締め出さない・resilient）。
 */
async function deriveLevel(): Promise<{ level: CitizenLevel; levelFull: number }> {
  const name = getDisplayName();
  const hasName = name !== null;
  if (!hasName) return { level: 0, levelFull: 0 };

  const now = Math.floor(Date.now() / 1000);
  const resolve = (postCount: number, earliestCreatedAt: number | null) => {
    const input = { hasName, postCount, earliestCreatedAt, now };
    return { level: citizenLevel(input), levelFull: citizenLevelFull(input) };
  };
  try {
    const pubkey = await getPublicKeyHex();
    const posts = await fetchMyPosts(pubkey);
    const earliestCreatedAt =
      posts.length > 0 ? posts.reduce((min, p) => Math.min(min, p.createdAt), Infinity) : null;
    return resolve(posts.length, earliestCreatedAt);
  } catch {
    // 取得失敗時は名乗りを尊重して市民扱い（締め出さない）。
    return resolve(0, null);
  }
}

// lang は about.astro がページの locale を流す（#147）＝SSR/初期描画の種（ja）。
// この島は LocaleProvider のルート（about.astro 直下・他の Provider に包まれない）なので、
// 自分で <LocaleProvider value={loc}> を張り、子（PageContent 等）は useLocale() で読む。
// loc はマウント後に resolveClientLocale() で確定する（en を選んでいれば en で描き直す）。
export default function CityHallBook({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  // lang は SSR/初期描画の種（既定言語＝go-live で en）。マウント後にクライアント解決値（ja を選んでいれば ja）へ寄せる。
  // 解決は下の useIsoLayoutEffect（ペイント前）で行う＝殻が既定言語で焼かれるため、非既定言語の
  // ユーザーで「一瞬 en → ja」のフラッシュが出るのを防ぐ（殻側の is:inline swap と同じ flash 回避方針）。
  const [loc, setLoc] = useState<Locale>(lang);
  const t = useT(loc);
  // 本文（構造化データ）と味付け文言は locale で組み直す。
  const bookPages = buildCityHallBook(loc);
  const bookTitleText = t("cityHall.book.title");
  const flavorMap = levelFlavor(loc);

  // 判定中は安全側＝L0（1p のみ）で始め、ロック状態を実市民に見せない。
  // 名乗り済みなら下の useIsoLayoutEffect がペイント前に L1/2p へ寄せる（フラッシュ防止）。
  // level=ページ解放用（capped）／levelFull=タイトル表記用の真レベル（非キャップ・#469 変更A）。
  const [level, setLevel] = useState<CitizenLevel>(0);
  const [levelFull, setLevelFull] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [page, setPage] = useState(1); // 1-indexed。安全既定は 1p。
  const aliveRef = useRef(true);
  // 本のスワイプ（#275）。←→ボタン・キーボード矢印と同じ goPrev/goNext を駆動する。
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // スワイプ中のページ内容ぼかし（px・#275）。0＝ぼかし無し。reduced-motion ではかからない。
  const [swipeBlur, setSwipeBlur] = useState(0);

  // 名乗り済みユーザーの「一瞬1ページ目→2ページ目」フラッシュを消す。
  // deriveLevel はネットワーク（fetchMyPosts）を待つので、それで page を寄せると 1p が一瞬見える。
  // getDisplayName は同期（localStorage）で読めるので、ペイント前（layout）に初期ページと
  // 最低レベルを確定する。名乗り済みは deriveLevel が必ず L1 以上を返す（取得失敗でも L1）ため、
  // 暫定 L1（maxUnlocked=2）にしておけば 2p が即解放され ??? ティザーのちらつきも出ない。
  // 正確な L1/L2 は下の deriveLevel が後から確定して解放範囲を更新する。
  useIsoLayoutEffect(() => {
    // 表示言語はクライアント解決（localStorage）。ペイント前（layout）に確定して
    // 「一瞬 en → ja」の言語フラッシュを消す（useEffect だと描画後に走り en が一瞬見える）。
    setLoc(resolveClientLocale());
    if (getDisplayName() !== null) {
      setLevel(1);
      setLevelFull(1); // 名乗り済みは最低 L1＝タイトルは即「… L1」。真レベルは下の deriveLevel が確定。
      setPage(defaultPage(1)); // = 2p
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void (async () => {
      const { level: lv, levelFull: lvFull } = await deriveLevel();
      if (!aliveRef.current) return;
      // 初期 page・最低レベルは useIsoLayoutEffect が同期確定済み。ここでは正確なレベルを
      // 確定して maxUnlocked（解放範囲・capped）とタイトル表記（levelFull・真レベル）を更新するだけ＝
      // page は触らない（ユーザー操作を奪わない）。
      setLevel(lv);
      setLevelFull(lvFull);
      setResolved(true);
    })();
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const maxUnlocked = maxUnlockedPage(level);
  // 手帳タイトルは進捗を一目で示すレベル番号表記（#469 変更A・kako-jun 確定）。
  // L0（旅人・未名乗り）はレベル番号を出さず素のタイトル＋副題「旅人」、L1+ は「… L{n}」で副題なし。
  // n は真レベル（levelFull・非キャップ）＝CitizenStats と同じ表記（ページ解放は capped の level）。
  // レベル番号は deriveLevel が真レベルを確定してから（resolved）だけ出す。名乗り済みは
  // useIsoLayoutEffect が暫定 levelFull=1 を置くが、それを番号として見せると実 L2 の人が
  // 「一瞬 L1 → L2」のフラッシュを踏む（#479-B）。番号は resolved まで伏せ、確定後に付くだけにする。
  // 暫定 levelFull=1 は副題「旅人」の抑止だけに使う（名乗り済みに旅人を出さない）。
  const showLevel = resolved && levelFull > 0;
  const subtitleText = levelFull === 0 ? t("citizen.level.traveler") : null;
  const current = bookPages.find((p) => p.page === page) ?? bookPages[0]!;
  const isLockedView = page > maxUnlocked;

  const canPrev = page > 1;
  // 前方は maxUnlocked の「次の 1 枚」（ティザー）まで進める。その先は無い。
  const canNext = page < Math.min(maxUnlocked + 1, TOTAL_PAGES);

  function goPrev() {
    if (canPrev) setPage((p) => p - 1);
  }
  function goNext() {
    if (canNext) setPage((p) => p + 1);
  }

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
  // ← = 前（後方オープン・1p 未満には行かない）／→ = 次（前方ロックを尊重し、
  // ティザー上限より先へは進めない）。入力欄にフォーカスがあるときは横取りしない。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // フォーム入力中・編集可能要素の上では矢印を奪わない（テキスト移動を妨げない）。
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable === true) {
        return;
      }
      if (e.key === "ArrowLeft" && canPrev) {
        setPage((p) => p - 1);
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowRight" && canNext) {
        setPage((p) => p + 1);
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canPrev, canNext]);

  // レベル昇格の味付け（小さく）。判定確定後、その本の入口で一度だけ添える。
  // - 市民歓迎: L1 が 2p（街の地図）を開いたときだけ。古参（L2 以上）には再掲しない
  //   （長く居る市民に毎回「移住を受理した」と告げない）。
  // - 古参歓迎: L2 以上が初めて奥（3p 沿革・古参の最初のページ）に達したときだけ。2p では出さない。
  //   #469 で L3 まで解放が伸びても、奥に達した古参へ古参歓迎を出す挙動は保つ（level >= 2）。
  const flavor =
    resolved && level === 1 && page === 2
      ? flavorMap.citizen
      : resolved && level >= 2 && page === 3
        ? flavorMap.tenured
        : null;

  return (
    <LocaleProvider value={loc}>
    <section className="ha-rise flex flex-col gap-5" aria-label={bookTitleText}>
      {/* 手帳の表題。L1+ は「ハノーバ市民手帳 L{n}」で進捗を一目で示す（#469 変更A）。
          L0（旅人）はレベル番号を出さず素のタイトル＋副題「旅人」。L1+ は副題なし（下に MayorMark）。 */}
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ha-green-deep">
          {bookTitleText}
          {/* レベル番号は真レベル確定後だけ付ける（#479-B）。{" "}＋ml で「L」の左に明確な間隔を空ける
              （#479-C・h1 の tracking-tight に潰されない margin で稼ぐ。読み上げ名は半角スペース込みで維持）。 */}
          {showLevel && (
            <>
              {" "}
              <span className="ml-1.5">L{levelFull}</span>
            </>
          )}
        </h1>
        {subtitleText !== null && <p className="text-sm text-ha-ink/55">{subtitleText}</p>}
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
          borderImageSource: "url('/book-frame-washi-v1.webp')",
          borderImageSlice: "120 120 120 150",
          borderImageRepeat: "stretch",
          backgroundImage: "url('/book-page-washi-v1.webp')",
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
          {isLockedView ? (
            <LockedTeaser />
          ) : (
            <PageContent page={current} />
          )}
        </div>

        {flavor !== null && (
          <p className="text-sm text-ha-green/90 italic [word-break:auto-phrase]" role="status">
            {flavor}
          </p>
        )}

        {/* めくり操作＋ページ表示。前=戻る（後方オープン）／次=進む（前方ロック）。 */}
        <nav className="flex items-center justify-between gap-3 pt-1" aria-label={t("cityHall.nav.aria")}>
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label={t("cityHall.nav.prev")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Icon name="chevron" className="w-4 h-4 rotate-90" />
            {t("cityHall.nav.prev.label")}
          </button>

          <span className="text-sm text-ha-ink/60 tabular-nums" aria-hidden="true">
            {t("cityHall.nav.indicator", { page, total: TOTAL_PAGES })}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label={t("cityHall.nav.next")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            {t("cityHall.nav.next.label")}
            <Icon name="chevron" className="w-4 h-4 -rotate-90" />
          </button>
        </nav>
      </div>
    </section>
    </LocaleProvider>
  );
}

/**
 * ロックされたページのティザー（？？？・開けない枠）。
 * 「？？？」＋ひとことは残しつつ、背後に「読めない頁」＝ぼかした崩し字を敷き、
 * 「頁はあるが今は読めない」図鑑的な示唆を出す（#219 ③）。
 * blur は静的（アニメ無し）なので reduced-motion 懸念なし。暗地に沈めた低グレア（§5）。
 */
function LockedTeaser() {
  const locale = useLocale();
  const teaser = lockedTeaser(locale);
  return (
    <div
      className="relative isolate flex min-h-[360px] flex-col items-center justify-center gap-3 overflow-hidden py-10 text-center select-none"
      aria-disabled="true"
    >
      {/* 読めない頁＝ぼかした崩し字（純粋な装飾）。仮名を流し blur で潰して不可読にする。
          支援技術・コピーからは隠す（aria-hidden / select-none / pointer-events-none）。 */}
      <div
        data-testid="lore-veil"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex flex-col justify-center gap-3 px-7 [filter:blur(5px)]"
      >
        {LOCKED_PAGE_VEIL.map((line, i) => (
          <span
            key={i}
            className="block text-base leading-relaxed tracking-[0.2em] text-ha-ink/15 [word-break:break-all]"
          >
            {line}
          </span>
        ))}
      </div>
      {/* 中央を少し沈める scrim＝ぼかし頁の上で「？？？」を読みやすく（低グレア・地と同色 #13161e）。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 45%, rgba(19,22,30,0.72) 0%, rgba(19,22,30,0) 78%)",
        }}
      />
      <p className="font-display text-4xl font-extrabold tracking-widest text-ha-ink/30">
        {teaser.title}
      </p>
      <p className="text-sm text-ha-ink/50 [word-break:auto-phrase]">{teaser.note}</p>
    </div>
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
          <Icon name="chevron" className="w-4 h-4 -rotate-90 text-ha-green/70 shrink-0" />
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
      <Avatar src={MAYOR_AVATAR_SRC} name={shortName} className="w-16 h-16 ring-1 ring-white/10" />
      <span className="text-sm text-ha-ink/60">{t("cityHall.mayorTitle", { name: shortName })}</span>
    </div>
  );
}

/** 解放済みページの中身を種類ごとに描く。 */
function PageContent({ page }: { page: BookPage }) {
  const locale = useLocale();
  const t = useT(locale);
  switch (page.kind) {
    case "welcome":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
          {/* 見出しの下に市長アイコン＋肩書き（語り手・#455 で全ページ共通化）。顔は秘密＝ジョウロ（#219①）。 */}
          <MayorMark />
          {page.blocks.map((b, i) =>
            b.kind === "note" ? (
              <p key={i} className="text-xs text-ha-ink/55 leading-relaxed [word-break:auto-phrase]">
                {b.text}
              </p>
            ) : (
              <p
                key={i}
                className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]"
              >
                {b.text}
              </p>
            ),
          )}
        </article>
      );

    case "map":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
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
              className="w-full rounded-xl border border-white/10 object-cover ring-1 ring-white/10"
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
              <li key={lm.name} className="flex flex-col gap-0.5 border-l-2 border-ha-green/30 pl-4">
                <span className="text-sm font-semibold text-ha-green-deep">{lm.name}</span>
                <span className="text-sm text-ha-ink/80 leading-relaxed [word-break:auto-phrase]">
                  {lm.text}
                </span>
              </li>
            ))}
          </ul>
          {/* 地図はまだ描きかけ、の注記（小さく添える）。 */}
          <p className="text-xs text-ha-ink/50 [word-break:auto-phrase]">{page.note}</p>
          {/* 市政の窓口（civic strip）。地図本体との間は「にじみ」（.ha-bleed）の柔らかい境界で区切る（#263 踏襲）。
              開庁＝リンク／近日開庁＝非リンク（HubLinkItem が出し分ける）。 */}
          <section className="flex flex-col gap-2">
            <div className="ha-bleed" aria-hidden="true" />
            <h3 className="px-1 text-sm font-semibold tracking-wide text-ha-green-deep/75">
              {t("cityHall.map.civic.heading")}
            </h3>
            <ul className="flex flex-col gap-2">
              {page.civic.map((link) => (
                <HubLinkItem key={link.label} link={link} />
              ))}
            </ul>
          </section>
        </article>
      );

    case "chronicle":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
          <MayorMark />
          {/* 市長の前口上（全ページ冒頭に市長の言葉を必須化・#469 変更B）。 */}
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">
            {page.lead}
          </p>
          <ol className="flex flex-col gap-3">
            {page.entries.map((e) => (
              <li key={e.era} className="flex flex-col gap-0.5 border-l-2 border-ha-green/30 pl-4">
                <span className="text-sm font-semibold text-ha-green-deep">{e.era}</span>
                <span className="text-sm text-ha-ink/80 leading-relaxed [word-break:auto-phrase]">
                  {e.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-ha-ink/50 [word-break:auto-phrase]">{page.note}</p>
        </article>
      );

    case "ordinances":
      return (
        <article className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
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
