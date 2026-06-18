import { useEffect, useRef, useState } from "react";
import Avatar from "../feed/Avatar.tsx";
import Icon from "../ui/Icon.tsx";
import { fetchMyPosts } from "../../lib/nostr/client.ts";
import { getDisplayName, getPublicKeyHex } from "../../lib/nostr/keys.ts";
import {
  type CitizenLevel,
  citizenLevel,
  defaultPage,
  maxUnlockedPage,
} from "../../lib/lore/citizen.ts";
import {
  BOOK_PAGES,
  BOOK_TITLE,
  type BookPage,
  LEVEL_FLAVOR,
  LEVEL_SUBTITLE,
  LOCKED_TEASER,
  MAYOR_NAME,
} from "../../lib/lore/cityHall.ts";

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

const TOTAL_PAGES = BOOK_PAGES.length; // 4

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

export default function CityHallBook() {
  // 判定中は安全側＝L0（1p のみ）で始め、ロック状態を実市民に見せない。
  // 確定したら defaultPage（L1/L2 → 2p）へ寄せる。
  const [level, setLevel] = useState<CitizenLevel>(0);
  const [resolved, setResolved] = useState(false);
  const [page, setPage] = useState(1); // 1-indexed。安全既定は 1p。
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    void (async () => {
      const lv = await deriveLevel();
      if (!aliveRef.current) return;
      setLevel(lv);
      setResolved(true);
      // 既定ページへ寄せる（解放されたばかりの市民に最初に見せるページ）。
      setPage(defaultPage(lv));
    })();
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const maxUnlocked = maxUnlockedPage(level);
  const current = BOOK_PAGES.find((p) => p.page === page) ?? BOOK_PAGES[0]!;
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
      ? LEVEL_FLAVOR.citizen
      : resolved && level === 2 && page === 3
        ? LEVEL_FLAVOR.tenured
        : null;

  return (
    <section className="ha-rise flex flex-col gap-5" aria-label={BOOK_TITLE}>
      {/* 手帳の表題（在世タイトル）。肩書はレベルで変わる（menu 語の差し替えは defer・本側で適応）。 */}
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-ha-green-deep">
          {BOOK_TITLE}
        </h1>
        <p className="text-sm text-ha-ink/55">{LEVEL_SUBTITLE[level]}</p>
      </header>

      {/* 本体パネル（暗色グラス）。ページが切り替わるたび key で穏やかに描き直す。 */}
      <div className="glass rounded-2xl p-6 sm:p-8 flex flex-col gap-5">
        {/* aria-live でページ遷移を読み上げる。reduced-motion は CSS 側で ha-rise が無効。 */}
        <div key={page} className="ha-rise flex flex-col gap-4" aria-live="polite">
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
        <nav className="flex items-center justify-between gap-3 pt-1" aria-label="ページめくり">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="前のページ"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <Icon name="chevron" className="w-4 h-4 rotate-90" />
            前
          </button>

          <span className="text-sm text-ha-ink/60 tabular-nums" aria-hidden="true">
            {page} / {TOTAL_PAGES}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            aria-label="次のページ"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            次
            <Icon name="chevron" className="w-4 h-4 -rotate-90" />
          </button>
        </nav>
      </div>
    </section>
  );
}

/** ロックされたページのティザー（？？？・開けない枠）。 */
function LockedTeaser() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10 text-center select-none"
      aria-disabled="true"
    >
      <p className="font-display text-4xl font-extrabold tracking-widest text-ha-ink/25">
        {LOCKED_TEASER.title}
      </p>
      <p className="text-sm text-ha-ink/45 [word-break:auto-phrase]">{LOCKED_TEASER.note}</p>
    </div>
  );
}

/** 解放済みページの中身を種類ごとに描く。 */
function PageContent({ page }: { page: BookPage }) {
  switch (page.kind) {
    case "welcome":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
          {/* 移住案内の冒頭で市長ボタニクスが名乗る。顔は秘密＝ジョウロの肖像（#219①）。
              Avatar は装飾扱い（alt 空）なので隣に市長名テキストを置き a11y を満たす。 */}
          <div className="flex items-center gap-3">
            <Avatar src={MAYOR_AVATAR_SRC} name="ボタニクス" className="w-16 h-16 ring-1 ring-white/10" />
            <span className="text-sm text-ha-ink/60">市長{MAYOR_NAME}</span>
          </div>
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
          <p className="text-base text-ha-ink/85 leading-relaxed [word-break:auto-phrase]">
            {page.lead}
          </p>
          <ul className="flex flex-col gap-2">
            {page.links.map((link) =>
              link.route !== null ? (
                <li key={link.label}>
                  <a
                    href={link.route}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/5 hover:bg-ha-green/10 border border-white/10 px-4 py-3 text-ha-ink hover:text-ha-green-deep transition-colors"
                  >
                    <span className="font-medium">{link.label}</span>
                    <Icon name="chevron" className="w-4 h-4 -rotate-90 text-ha-green/70 shrink-0" />
                  </a>
                </li>
              ) : (
                <li
                  key={link.label}
                  aria-disabled="true"
                  className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-white/10 px-4 py-3 text-ha-ink/40"
                >
                  <span>{link.label}</span>
                  <span className="text-xs text-ha-ink/40 shrink-0">{link.comingSoon}</span>
                </li>
              ),
            )}
          </ul>
        </article>
      );

    case "chronicle":
      return (
        <article className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold text-ha-green-deep">{page.title}</h2>
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
