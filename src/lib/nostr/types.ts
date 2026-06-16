// Nostr コアの型定義（定義先行）。
// nostr-tools の型を re-export または薄くラップする。実装側はこの型に従う。

import type { EventTemplate as NostrToolsEventTemplate, NostrEvent as NostrToolsEvent } from "nostr-tools";

/**
 * 署名前のイベントテンプレート。`{ kind, created_at, tags, content }`。
 * nostr-tools の EventTemplate と同一（再エクスポート）。
 */
export type EventTemplate = NostrToolsEventTemplate;

/**
 * 署名済みイベント。id / sig / pubkey を含む。
 * nostr-tools の NostrEvent と同一（再エクスポート）。
 */
export type NostrEvent = NostrToolsEvent;

/**
 * フィルタ効果の強度（#171）。1=弱 / 2=中 / 3=強 の3段。「なし」は選択集合に存在しない＝0段相当。
 */
export type FilterStrength = 1 | 2 | 3;

/**
 * フィルタ効果の 1 段ぶんの設定（#171）。弱/中/強の各段がこの形で値を明示する。
 * CSS 文字列をパースして強度を割り出すのではなく、段ごとに値を持たせる explicit per-level モデル。
 *
 * - filter: この段のプレビュー style={{filter}} と canvas 焼き込みで共用する CSS filter（無ければ "none" 相当）
 * - vignette: 周辺減光の強さ（0〜1）。中央を残し、周辺を暗く落とす。
 * - sharpen: シャープ処理の強さ（0〜1）。投稿画像の書き出し時に焼き込む。
 * - edgeBlur: 周辺ぼかしの強さ（0〜1）。中央はシャープのまま、外周だけ canvas で blur 合成する。
 * - toneCurve: 投稿画像に canvas で焼き込むトーンカーブ。"s"=S字（締まり）/"reverse-s"=逆S字（やわらげ）。
 * - toneAmount: トーンカーブの効き具合（buildToneLut の amount。既定 0.32 相当）。
 */
export interface FilterLevel {
  filter?: string;
  vignette?: number;
  sharpen?: number;
  edgeBlur?: number;
  toneCurve?: "s" | "reverse-s";
  toneAmount?: number;
}

/**
 * レトロ加工の選択式プリセット（#171 で単一固定強度から弱/中/強の3段モデルへ）。
 * #3（Composer）でレトロ加工の選択式 UI に使う。値の一覧は src/lib/image/presets.ts。
 *
 * - name: チップに表示する名前
 * - color: チップに添えるスウォッチ色（雰囲気の視覚ヒント）
 * - levels: [弱, 中, 強] の3段。中(levels[1])＝既定の効き。FilterStrength-1 で添字を引く。
 */
export interface FilterPreset {
  name: string;
  color: string;
  levels: [FilterLevel, FilterLevel, FilterLevel];
}

/**
 * 選択中のフィルタ（#171）。プリセット名＋強度の組。なし＝配列に存在しない。
 */
export interface SelectedFilter {
  name: string;
  strength: FilterStrength;
}

// クロップ位置は react-image-crop の PixelCrop をそのまま使う（独自の CropState は持たない）。
// アップロード下書きは Composer 島の個別 state（file / crop / filter / caption）で保持する。
