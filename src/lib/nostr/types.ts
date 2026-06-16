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
 * CSS フィルタのプリセット。`filter` は CSS の filter 文字列。
 * #3（Composer）でレトロ加工の選択式 UI に使う。値の一覧は src/lib/image/presets.ts。
 *
 * - name: チップに表示する名前
 * - filter: プレビューの style={{filter}} と canvas 焼き込みで共用する CSS filter
 * - color: チップに添えるスウォッチ色（雰囲気の視覚ヒント）
 * - vignette: 周辺減光の強さ（0〜1）。中央を残し、周辺を暗く落とす。
 * - sharpen: シャープ処理の強さ（0〜1）。投稿画像の書き出し時に焼き込む。
 * - edgeBlur: 周辺ぼかしの強さ（0〜1）。中央はシャープのまま、外周だけ canvas で blur 合成する。
 * - toneCurve: 投稿画像に canvas で焼き込むトーンカーブ。"s"=S字（締まり）/"reverse-s"=逆S字（やわらげ）。
 */
export interface FilterPreset {
  name: string;
  filter: string;
  color: string;
  vignette?: number;
  sharpen?: number;
  edgeBlur?: number;
  toneCurve?: "s" | "reverse-s";
}

// クロップ位置は react-image-crop の PixelCrop をそのまま使う（独自の CropState は持たない）。
// アップロード下書きは Composer 島の個別 state（file / crop / filter / caption）で保持する。
