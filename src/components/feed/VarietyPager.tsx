import { type TouchEvent as ReactTouchEvent, type KeyboardEvent as ReactKeyboardEvent, useMemo, useState } from "react";
import type { RankedVariety } from "../../lib/feed/ranking.ts";
import { chunk, clampPage } from "../../lib/feed/varietyPager.ts";
import { discoverTagsHref } from "../../lib/feed/discoverFilter.ts";
import { swipeDirection, swipeProgress, swipeToBlur } from "../../lib/feed/carousel.ts";
import { prefersReducedMotion } from "../../lib/a11y/reduced-motion.ts";
import Icon from "../ui/Icon.tsx";
import SciName from "../ui/SciName.tsx";
import type { MessageKey, TParams } from "../../lib/i18n/index.ts";

type TFn = (key: MessageKey, params?: TParams) => string;

interface Props {
  /** 育てた品種（票数降順・#388。CitizenStats の stats.varieties をそのまま渡す）。 */
  varieties: RankedVariety[];
  /** CitizenStats が握る locale 束ね済みの翻訳関数（チップ title・ページャ a11y 文言用）。 */
  t: TFn;
}

/**
 * 「育てた品種」一覧の横ページャ（#388）。1000 種あっても縦に積まず、手帳のように横へめくる
 * ＝DOM・節の高さが常に有界（現在ページの 10 件だけ描画）になり、下の節（緑の総面積／撮影の草）に
 * 必ず辿り着ける。チップの見た目（glass・学名 SciName・×N・discover 絞り込みリンク）は CitizenStats の
 * 旧インライン `<li>` をそのまま移植する＝デザインは変えない。
 *
 * スワイプ／ぼかしページ遷移は市民手帳（CityHallBook・#275）と同じ作法で、carousel.ts の純関数
 *（swipeDirection / swipeProgress / swipeToBlur）を共有する。端はクランプ（非 wrap）＝先頭で←・
 * 末尾で→は no-op（ボタン disabled）。ページめくりは key={page} の中身だけ blur（枠は固定）し、
 * reduced-motion／1 ページなら blur を無効にする。
 *
 * 注意: 10 件以下なら呼び出し側（CityizenStats）が従来どおり 1 ページぶんを出すだけにしたいので、
 * この component は「ページャ UI（←→・インジケータ）を出すかどうか」を内部で判定する
 *（pageCount <= 1 なら UI 無し＝退行なし）。
 */
export default function VarietyPager({ varieties, t }: Props) {
  // 票数降順を崩さず 10 件ずつに分ける純関数（lib・テスト済み）。
  const pages = useMemo(() => chunk(varieties), [varieties]);
  const total = pages.length; // = pageCount(varieties.length)
  const [page, setPage] = useState(0); // 0 始まり。
  // スワイプ中のページ内容ぼかし（px・CityHallBook と同じ）。0＝ぼかし無し。
  const [swipeBlur, setSwipeBlur] = useState(0);
  // 本のスワイプ始点（←→ボタン・キーボード矢印と同じ goPrev/goNext を駆動する）。
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // varieties が減った等で page が範囲外になっても、表示は安全側にクランプして使う
  //（setState を描画中に呼ばず、参照だけクランプ＝余分な再レンダを避ける）。
  const safePage = clampPage(page, varieties.length);
  const current = pages[safePage] ?? [];

  // ページャ UI（←→・インジケータ）は 2 ページ以上のときだけ出す。
  // 1 ページ以下（=10 件以下）は従来どおり一覧を並べるだけ＝退行なし（#388 要件4）。
  const showPager = total > 1;
  // ぼかしページ遷移は 2 ページ以上 かつ reduced-motion でないときだけ（CityHallBook と同じ思想）。
  const canBlur = showPager && !prefersReducedMotion();

  const canPrev = safePage > 0;
  const canNext = safePage < total - 1;

  function goPrev() {
    setPage((p) => clampPage(p - 1, varieties.length));
  }
  function goNext() {
    setPage((p) => clampPage(p + 1, varieties.length));
  }

  // スワイプでページめくり＋スワイプ量で中身をぼかす（CityHallBook と同じ作法・carousel 共有）。
  function onTouchStart(e: ReactTouchEvent) {
    const tch = e.touches[0];
    if (tch === undefined) return;
    setTouchStart({ x: tch.clientX, y: tch.clientY });
  }
  // ドラッグ中はスワイプ量で中身をぼかす（水平優位のときだけ＝縦スクロールを邪魔しない）。
  // 始点なし・縦優位・reduced-motion／1 ページではぼかさない（0 のまま／0 に戻す）。
  function onTouchMove(e: ReactTouchEvent) {
    if (touchStart === null) return;
    if (!canBlur) return;
    const tch = e.touches[0];
    if (tch === undefined) return;
    const dx = tch.clientX - touchStart.x;
    const dy = tch.clientY - touchStart.y;
    if (Math.abs(dx) <= Math.abs(dy)) {
      setSwipeBlur(0);
      return;
    }
    // 整数 px に丸め、同値ならバイルアウト（毎フレームの無駄な再レンダを省く）。
    const next = Math.round(swipeToBlur(swipeProgress(dx)));
    setSwipeBlur((prev) => (prev === next ? prev : next));
  }
  function onTouchEnd(e: ReactTouchEvent) {
    const start = touchStart;
    setTouchStart(null);
    // 指を離したらぼかしを解く（遷移できても／できなくても）。
    setSwipeBlur(0);
    if (start === null) return;
    const tch = e.changedTouches[0];
    if (tch === undefined) return;
    // 左スワイプ＝次（next）／右スワイプ＝前（prev）。端は goPrev/goNext が clampPage で no-op。
    // しきい値 40px・水平優位判定（carousel.ts）でタップとは競合しない（CityHallBook と同じ）。
    const dir = swipeDirection(tch.clientX - start.x, tch.clientY - start.y);
    if (dir === "next") goNext();
    else if (dir === "prev") goPrev();
  }

  // ←/→ でめくる。ページャ領域（や中のチップ）にフォーカスがあるときだけ反応する
  //（このウィジェットは本文中の小部品なので、ページ全体の矢印を横取りしない＝CityHallBook が
  //  ページ全体である事情と違う点。要件の「キーボード矢印」は領域フォーカス時に満たす）。
  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "ArrowLeft" && canPrev) {
      goPrev();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && canNext) {
      goNext();
      e.preventDefault();
    }
  }

  // 一覧（現在ページの 10 件だけ）。チップは CitizenStats の旧インライン <li> をそのまま移植。
  const list = (
    <ul className="flex flex-wrap gap-1.5">
      {current.map((v) => (
        <li key={v.key} className="min-w-0 max-w-full">
          <a
            href={discoverTagsHref(v.filterTags)}
            className="glass inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-[2px] bg-ha-base/60 px-2.5 py-1 text-sm text-ha-ink shadow-sm shadow-black/25 transition-colors hover:text-ha-green-deep hover:border-ha-green/50 before:-ml-0.5 before:mr-0.5 before:h-3 before:w-1.5 before:shrink-0 before:rounded-full before:bg-ha-green/80"
            title={t("stats.variety.filterTitle", { label: v.sci })}
          >
            {/* 学名のみ（#459＝所有札一覧も学名そのもの。学名のある品種だけが乗る）。 */}
            <span className="min-w-0 truncate">
              <SciName sci={v.sci} className="font-display text-ha-green-deep" />
            </span>
            {v.count > 1 && <span className="shrink-0 text-xs tabular-nums text-ha-ink/55">×{v.count.toLocaleString("en-US")}</span>}
          </a>
        </li>
      ))}
    </ul>
  );

  // 1 ページ以下は従来どおり一覧をそのまま出すだけ（ページャ UI 無し・スワイプ装置なし＝退行なし）。
  if (!showPager) return list;

  return (
    <div className="flex flex-col gap-2">
      {/* ページ領域。スワイプでめくり（左=次・右=前）、中身（key={page}）だけぼかす。枠（このコンテナ）は
          固定する＝枠ごとぼかす違和感を避ける（CityHallBook と同じ）。min-h で 10 件想定の高さを安定させ、
          言語切替・ページ送りで行高/レイアウトをガタつかせない（#388 要件6）。tabIndex で領域に
          フォーカスを当てられ、その状態で ←→ がめくる。 */}
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className="min-h-[5rem] outline-none rounded-md focus-visible:ring-1 focus-visible:ring-ha-green/40"
        aria-label={t("stats.varieties.pager.aria")}
      >
        <div
          key={safePage}
          style={{
            filter: swipeBlur > 0 ? `blur(${swipeBlur}px)` : undefined,
            transition: swipeBlur > 0 ? "none" : "filter 0.25s ease",
          }}
        >
          {list}
        </div>
      </div>

      {/* ページ位置を SR に告知する固定の live region（#388 review）。上の本文は key={page} で remount される
          ため aria-live を載せても読まれない＝告知はここに分離する。視覚インジケータは下で aria-hidden で出す。 */}
      <p role="status" className="sr-only">{t("stats.varieties.pager.indicator", { page: safePage + 1, total })}</p>

      {/* めくり操作＋ページ表示。前=戻る／次=進む。端はクランプ（disabled・no-op）。
          単純なページャ操作行なので nav ランドマークにはしない（ボタンは各々 aria-label 付き・スワイプ領域側に
          説明ラベルを持つ＝同名ラベルの二重ランドマークを避ける・#388 review）。 */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          aria-label={t("stats.varieties.pager.prev")}
          className="inline-flex items-center rounded-full p-1.5 text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Icon name="chevron" className="w-4 h-4 rotate-90" />
        </button>

        <span className="text-xs text-ha-ink/55 tabular-nums" aria-hidden="true">
          {t("stats.varieties.pager.indicator", { page: safePage + 1, total })}
        </span>

        <button
          type="button"
          onClick={goNext}
          disabled={!canNext}
          aria-label={t("stats.varieties.pager.next")}
          className="inline-flex items-center rounded-full p-1.5 text-ha-green-deep hover:bg-ha-green/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Icon name="chevron" className="w-4 h-4 -rotate-90" />
        </button>
      </div>
    </div>
  );
}
