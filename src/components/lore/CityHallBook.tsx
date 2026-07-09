import { useEffect, useLayoutEffect, useState } from "react";
import BookPager from "./BookPager.tsx";
import MayorMark from "./MayorMark.tsx";
import {
  type BookPage,
  buildCityHallBook,
  civicHub,
  type HubLink,
} from "../../lib/lore/cityHall.ts";
import {
  useT,
  useLocale,
  LocaleProvider,
  resolveClientLocale,
  DEFAULT_LOCALE,
  type Locale,
} from "../../lib/i18n/index.ts";
import Icon from "../ui/Icon.tsx";

// ハノーバ市民手帳（#163）。市長ボタニクス・フォン・ハノーバの声で語られる「本」。
// = 図鑑（集めて埋める読み物・#469）。機能導線（discover/ranking/me/compose）は
//   ヘッダ/フッタ（SiteHeader/SiteFooter）が持つので手帳からは外し、ここはロアに割り切る。
//
// #137/#510: レベル解禁ゲートを撤去し、全10ページを最初から閲覧可能にした。
// 初期ページは URL指定→保存位置→1p。「市政の窓口」（civicHub）は全ページ下部に共通表示する。
// #164: 本ページャー（枠/紙面・ページャーUI・キーボード矢印・スワイプ・URL同期/永続化）は
//   共通コンポーネント `BookPager` に抽出し、市政だより（GazetteBook）と共有する。
//   この島はページ内容（PageContent）と「市政の窓口」だけを持つ。

// SSR では useLayoutEffect が警告を出す（サーバに layout フェーズが無い）。
// クライアントでのみ layout（ペイント前）に走らせ、サーバでは no-op の effect に落とす。
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const BOOK_PAGE_STORAGE_KEY = "hanoba:citizen-handbook-page";

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

  useIsoLayoutEffect(() => {
    // 表示言語はクライアント解決（localStorage）。ペイント前（layout）に確定して
    // 「一瞬 en → ja」の言語フラッシュを消す（useEffect だと描画後に走り en が一瞬見える）。
    setLoc(resolveClientLocale());
  }, []);

  const t = useT(loc);
  // 本文（構造化データ）と味付け文言は locale で組み直す。
  const bookPages = buildCityHallBook(loc);
  const bookTitleText = t("cityHall.book.title");

  return (
    <LocaleProvider value={loc}>
      <BookPager
        title={bookTitleText}
        pages={bookPages}
        storageKey={BOOK_PAGE_STORAGE_KEY}
        renderPage={(page) => <PageContent page={page} />}
        footer={<CivicWindows />}
      />
    </LocaleProvider>
  );
}

/**
 * 市政の窓口（civic strip）。全ページ下部に置く導線。
 * 住民投票（/vote・#160 開庁）・市勢調査（/ranking・#162 開庁）は#525でフッタとも命名・導線を統一し、
 * 手帳だけの孤立導線にしない。市政だより（/gazette・#164 開庁）も同様。品評会（#161）は近日開庁のまま。
 * 地図本体との間は「にじみ」（.ha-bleed）の柔らかい境界で区切る（#263 踏襲）。開庁＝リンク／
 * 近日開庁＝非リンク（HubLinkItem が出し分ける）。
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
