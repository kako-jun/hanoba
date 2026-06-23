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
  defaultPage,
  maxUnlockedPage,
} from "../../lib/lore/citizen.ts";
import {
  type BookPage,
  buildCityHallBook,
  type HubLink,
  levelFlavor,
  levelSubtitle,
  LOCKED_PAGE_VEIL,
  lockedTeaser,
  mayorShortName,
} from "../../lib/lore/cityHall.ts";
import { useT, useLocale, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";

// 市長ボタニクス・フォン・ハノーバの肖像（語り手アイコン）。
// 顔は秘密という世界観のため、肖像の代わりにジョウロの写真を掲げる（public 直下の静的アセット）。
const MAYOR_AVATAR_SRC = "/mayor-botanics-watering-can.webp";

// ハノーバ市民手帳（#163）。市長ボタニクス・フォン・ハノーバの声で語られる「本」。
// = 市役所ハブ。すべての機能への単一の入口。
//
// 市民レベル（Nostr 由来＝backendless）でページが解放される。
// - L0 訪問者: 名前未登録 → 1p のみ。
// - L1 市民:   名前登録済み → 2p まで（既定で 2p を開く）。
// - L2 古参:   名前＋投稿数 >= 5 ＋ 在籍 >= 14 日 → 4p まで。
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
 * 名前が無ければ即 L0。名前があれば投稿を引いて L1/L2 を分ける。
 * 投稿取得が失敗しても名前があれば L1（名乗った市民を締め出さない・resilient）。
 */
async function deriveLevel(): Promise<CitizenLevel> {
  const name = getDisplayName();
  const hasName = name !== null;
  if (!hasName) return 0;

  const now = Math.floor(Date.now() / 1000);
  try {
    const pubkey = await getPublicKeyHex();
    const posts = await fetchMyPosts(pubkey);
    const earliestCreatedAt =
      posts.length > 0 ? posts.reduce((min, p) => Math.min(min, p.createdAt), Infinity) : null;
    return citizenLevel({ hasName, postCount: posts.length, earliestCreatedAt, now });
  } catch {
    // 取得失敗時は名乗りを尊重して市民扱い（締め出さない）。
    return citizenLevel({ hasName, postCount: 0, earliestCreatedAt: null, now });
  }
}

// lang は about.astro がページの locale を流す（#147）＝SSR/初期描画の種（ja）。
// この島は LocaleProvider のルート（about.astro 直下・他の Provider に包まれない）なので、
// 自分で <LocaleProvider value={loc}> を張り、子（PageContent 等）は useLocale() で読む。
// loc はマウント後に resolveClientLocale() で確定する（en を選んでいれば en で描き直す）。
export default function CityHallBook({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  // lang は SSR/初期描画の種（ja）。マウント後にクライアント解決値（en を選んでいれば en）へ寄せる。
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
  // 本文（構造化データ）と味付け文言は locale で組み直す。
  const bookPages = buildCityHallBook(loc);
  const bookTitleText = t("cityHall.book.title");
  const levelSubtitleMap = levelSubtitle(loc);
  const flavorMap = levelFlavor(loc);

  // 判定中は安全側＝L0（1p のみ）で始め、ロック状態を実市民に見せない。
  // 名乗り済みなら下の useIsoLayoutEffect がペイント前に L1/2p へ寄せる（フラッシュ防止）。
  const [level, setLevel] = useState<CitizenLevel>(0);
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
    if (getDisplayName() !== null) {
      setLevel(1);
      setPage(defaultPage(1)); // = 2p
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void (async () => {
      const lv = await deriveLevel();
      if (!aliveRef.current) return;
      // 初期 page・最低レベルは useIsoLayoutEffect が同期確定済み。ここでは正確な L1/L2 を
      // 確定して maxUnlocked（解放範囲）を更新するだけ＝page は触らない（ユーザー操作を奪わない）。
      setLevel(lv);
      setResolved(true);
    })();
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const maxUnlocked = maxUnlockedPage(level);
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
  // - 市民歓迎: L1 が 2p（市役所）を開いたときだけ。古参（L2）には再掲しない
  //   （長く居る市民に毎回「移住を受理した」と告げない）。
  // - 古参歓迎: L2 が初めて奥（3p 沿革・古参専用ページの先頭）に達したときだけ。2p では出さない。
  const flavor =
    resolved && level === 1 && page === 2
      ? flavorMap.citizen
      : resolved && level === 2 && page === 3
        ? flavorMap.tenured
        : null;

  return (
    <LocaleProvider value={loc}>
    <section className="ha-rise flex flex-col gap-5" aria-label={bookTitleText}>
      {/* 手帳の表題（在世タイトル）。肩書はレベルで変わる（menu 語の差し替えは defer・本側で適応）。 */}
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ha-green-deep">
          {bookTitleText}
        </h1>
        <p className="text-sm text-ha-ink/55">{levelSubtitleMap[level]}</p>
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

    case "hub":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
          <MayorMark />
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">
            {page.lead}
          </p>
          {/* 用途で分けた群を、群間は「にじみ」（.ha-bleed）の柔らかい境界で区切る（#263）。
              区切り線でなく和水彩のしみ出しで空間を分ける＝世界観に馴染む。見出しは群の道しるべ。 */}
          <div className="flex flex-col gap-3">
            {page.groups.map((group, gi) => (
              <section key={group.heading} className="flex flex-col gap-2">
                {gi > 0 && <div className="ha-bleed" aria-hidden="true" />}
                <h3 className="px-1 text-sm font-semibold tracking-wide text-ha-green-deep/75">
                  {group.heading}
                </h3>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <HubLinkItem key={link.label} link={link} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      );

    case "chronicle":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
          <MayorMark />
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
