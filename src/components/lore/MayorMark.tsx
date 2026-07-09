import Avatar from "../feed/Avatar.tsx";
import { useLocale, useT } from "../../lib/i18n/index.ts";
import { mayorShortName } from "../../lib/lore/cityHall.ts";
import { MAYOR_AVATAR_SRC } from "../../lib/lore/cityHallAssets.ts";

/**
 * 語り手マーク（#455）。市長ボタニクス・フォン・ハノーバのアイコン＋肩書きを、
 * 市長の声で語る本のページ冒頭に出す共通部品。顔は秘密＝ジョウロの肖像（#219①）。
 * Avatar は装飾（alt 空）扱いで隣に市長名テキストを置き a11y を満たす。
 * 短い呼び名「ボタニクス市長」（フルネームは本文側・#262）。
 *
 * 元は市民手帳（CityHallBook.tsx）専用だったが、市政だより（#164）でも同じ市長の声で
 * 語るため共有部品として切り出した（`LocaleProvider` の内側で使う前提）。
 */
export default function MayorMark() {
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
