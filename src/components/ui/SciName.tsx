// 学名（二名法）の表示ヘルパー（#70）。
// 属名・種小名はイタリックが植物学の正式表記だが、ランク略号・接続語
// （var. / subsp. / f. / cv. / aff. / cf. / 交配の ×）は直立体にするのが正しい。
// sci 文字列を空白で分割し、接続語トークンだけ直立、それ以外をイタリックで描画する。

interface Props {
  /** 学名文字列（例「Pachypodium rosulatum var. gracilius」）。 */
  sci: string;
  /** 外側 span の className（色・フォント等。italic はトークン単位で制御するので付けない）。 */
  className?: string;
}

// 直立体にする接続語/ランク略号（小文字で比較）。交配の × も含む。
// 判定はトークンの「値」だけで行い「位置」（属の直後か接頭辞位置か）は見ない。
// 学名は辞書で人が正しい形で管理する前提なのでこの単純さで足りる。
// ASCII の "x" は単独トークンの小種名・一般語と衝突して誤って直立化しうるので含めない
// （交配は正式記号 × を使う）。
const UPRIGHT = new Set([
  "var.",
  "subsp.",
  "ssp.",
  "f.",
  "subf.",
  "cv.",
  "aff.",
  "cf.",
  "nothovar.",
  "nothosubsp.",
  "×",
]);

/** トークンが直立体にすべき接続語か。 */
function isUpright(token: string): boolean {
  return UPRIGHT.has(token.toLowerCase());
}

export default function SciName({ sci, className }: Props) {
  // 空白（全角含む）で分割しつつ区切りを保持する（表示の見た目を壊さない）。
  const parts = sci.split(/(\s+)/);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        // 空白（区切り）は素の文字列で出して原文の見た目を保つ。
        if (/^\s*$/.test(part)) return part;
        return (
          <span key={`${i}-${part}`} className={isUpright(part) ? "not-italic" : "italic"}>
            {part}
          </span>
        );
      })}
    </span>
  );
}
