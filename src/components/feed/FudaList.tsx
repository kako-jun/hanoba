import type { Fuda } from "../../lib/plants/fuda.ts";
import { discoverTagsHref } from "../../lib/feed/discoverFilter.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";
import SciName from "../ui/SciName.tsx";

interface Props {
  /** 投稿の札（学名＋和名・buildFuda の結果）。空なら呼び出し側で出し分ける。 */
  fuda: Fuda[];
}

/**
 * 投稿の植物札（#182/#23）をチップで並べる共有 UI。PostDetail（拡大モーダル）と PostCard
 * （タイムラインのカード右端）で同じ見た目・同じ挙動を使う（#239・kako-jun blink）。
 *
 * 各札はその植物の **discover 絞り込みリンク**。品種札は **属＋品種の AND**（例
 * `/discover?tags=パキポディウム,ブレビカウレ`）、属単独札は属のみ（`?tags=パキポディウム`）で絞る
 * （#272 follow-up・kako-jun「ブレビカウレ札は パキポディウム ブレビカウレ で絞るはず」＝札は属＋品種の
 * 対。本文 #タグ ボタン〔単一タグ〕クリックとは区別）。本文と同じ正規化（`discoverTagsHref`＝内部空白→`_`）。
 * 表示は **学名のみ**（#459＝札は学名そのもの）。`buildFuda`/`fudaForName` が学名を解決できた札だけが
 * ここに来る（学名が引けない植物は札にならない＝和名へ fallback しない・ルールは1つ）。和名を札に出さないのは
 * ①投稿では和名が隣の #タグ（`#白鯨` 等）に出ていて二重 ②「聞いたことない学名→クリックで正体（写真）が
 * 判明」という学名を覚える/発見の導線を設計の核に置くため（kako-jun）。
 */
export default function FudaList({ fuda }: Props) {
  const t = useT(useLocale());
  if (fuda.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {fuda.map((f) => (
        <li key={f.key} className="max-w-full">
          <a
            // 札を生んだタグ集合（filterTags）で AND 絞り込み（品種札=[属,品種] / 属札=[属]・#272 逆算）。
            href={discoverTagsHref(f.filterTags)}
            title={t("fuda.search.title", { label: f.sci })}
            onClick={(e) => e.stopPropagation()}
            // #362: 学名を truncate しない。狭い札では `truncate` が末尾を削り、園芸品種名の閉じ引用符
            // （例 `Vitis 'Delaware'` の末尾 `'`）が最初に消えていた。kako-jun「長くなったら改行すればいい」＝
            // flex-wrap で和名を次行へ送り、学名は欠けさせない（学名＝札の identity なので削らない）。
            // #429: 緑楕円（`::before`）は **1行目** に上下中央で固定する。flex-wrap は各 flex item の
            // max-content 基準で折り返すため、学名（長い二名法）は自分だけ次の flex 行へ落ち、`::before` の点が
            // 単独で1行目（上）に残って学名1行目より上にズレていた（`self-start`/`mt-1` では解けない＝flex 行構造の問題）。
            // 解決: 点を flex フローから外して**絶対配置**にする。点を外すと学名が content 先頭（1行目＝上端）に来るので、
            // 点を1行目の行ボックス内中央（`top-2`=0.5rem）に固定すれば常に一致する。`text-sm` 行高 1.25rem(20px)・
            // py-1(4px)・点 h-3(12px) → 点中央 = 8+6 = 14px、1行目中央 = 4+10 = 14px で一致。`pl-[1.375rem]`(22px)
            // で点の溝を空ける（点は left-2=8px〜14px → 文字まで約8px 空く＝旧 inline 時と同じ間隔・#429 kako-jun
            // 「近すぎる」）。折返し行も同じ左端（22px）に揃う（hanging-bullet）。
            className="glass relative inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0 rounded-[2px] bg-ha-base/60 py-1 pl-[1.375rem] pr-2.5 text-sm text-ha-ink shadow-sm shadow-black/25 transition-colors before:absolute before:left-2 before:top-2 before:h-3 before:w-1.5 before:rounded-full before:bg-ha-green/80 hover:border-ha-green/70 hover:bg-ha-green-soft/80 hover:text-ha-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
          >
            {/* 学名のみ（#459＝札は学名そのもの。学名が引けない植物は札にならない＝ここに来る札は必ず sci を持つ）。 */}
            <SciName sci={f.sci} className="font-display text-ha-green-deep" />
          </a>
        </li>
      ))}
    </ul>
  );
}
