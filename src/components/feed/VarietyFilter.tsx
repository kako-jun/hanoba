import Icon from "../ui/Icon.tsx";
import TagPicker from "../composer/TagPicker.tsx";
import { normalizeTagForBody } from "../../lib/image/hashtag-complete.ts";
import { localizeHashtag } from "../../lib/plants/plant-i18n.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";
import { useFudaIndex } from "./useFudaIndex.ts";

interface Props {
  /** 現在の絞り込みタグ（品種＋自由タグ・AND）。 */
  tags: string[];
  /** タグが変わったら呼ぶ（追加・削除）。 */
  onChange: (tags: string[]) => void;
}

/**
 * discover の品種絞り込み（#239）。投稿画面と同じ `TagPicker`（filter モード）をそのまま使い、
 * カテゴリ→属→品種のドリルダウン＋検索で品種を選ぶ。カタログに無い語は検索欄の
 * 「そのまま #◯◯ を使う」で**自由タグ**として足せる（長い品種名は打てない＝選ぶ／短いタグは打つ）。
 * 選んだタグは AND で、選んだ瞬間に DiscoverGrid が新着順で再取得する（検索ボタン無し・ライブ）。
 *
 * 選択タグは上部にチップで常時見せる（× で外す）。TagPicker の選択色判定は caption ベースなので、
 * 選択タグを `#a #b` の合成 caption にして渡す（中身は文字列で素通し）。
 *
 * タグは投稿本文と**同じ正規化**（`normalizeTagForBody`＝内部空白→`_`）で保存する。複数語の品種名
 * （例「フィカス ペティオラリス」）は本文では `#フィカス_ペティオラリス` で保存されるため、絞り込みタグも
 * 同形にしないと relay/AND/選択色のどれも一致しない（#239 レビュー指摘）。
 */
export default function VarietyFilter({ tags, onChange }: Props) {
  const locale = useLocale();
  const t = useT(locale);
  // チップの #タグ表示を閲覧言語に訳す（カテゴリ/属＝#460）ための索引（PostGrid と同じ #257 索引・#464）。
  const index = useFudaIndex();
  const caption = tags.map((tg) => `#${tg}`).join(" ");

  function add(raw: string) {
    const tag = normalizeTagForBody(raw);
    if (tag !== "" && !tags.includes(tag)) onChange([...tags, tag]);
  }
  function remove(tag: string) {
    onChange(tags.filter((tg) => tg !== tag));
  }

  return (
    <div className="flex flex-col gap-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => {
            // 表示だけ閲覧言語に訳す（カテゴリ/属＝#460）。実タグ（key・remove）は ja 正準で不変。
            const shown = index ? localizeHashtag(tag, locale, index.hashtagLoc) : tag;
            return (
              <span
                key={tag}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-ha-green px-3 text-sm font-medium text-ha-white"
              >
                #{shown}
                <button
                  type="button"
                  aria-label={t("filter.remove.aria", { tag: shown })}
                  onClick={() => remove(tag)}
                  className="-mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-ha-white/80 hover:text-ha-white"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <TagPicker mode="filter" popular={[]} caption={caption} onPick={add} onRemove={remove} />
    </div>
  );
}
