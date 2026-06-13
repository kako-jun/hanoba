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
 * #3（Composer）でレトロ加工の選択式 UI に使う。ここでは型のみ確定。
 */
export interface FilterPreset {
  name: string;
  filter: string;
}

/**
 * アップロード下書きの状態。投稿コンポーザーが編集中に保持する。
 * #3（Composer）で使う。ここでは型のみ確定。
 *
 * - imageFile: 選択された元画像
 * - cropState: 正方形クロップの位置（ドラッグで決めるオフセット・ズーム）
 * - selectedFilter: 選択中のレトロ加工フィルタ（未選択は null）
 * - caption: 一言（必須。空での投稿は events 側で弾く）
 */
export interface UploadDraft {
  imageFile: File | null;
  cropState: CropState;
  selectedFilter: FilterPreset | null;
  caption: string;
}

/**
 * 正方形クロップの位置情報。ドラッグで位置決め・スケールで拡縮。
 * #3 で詳細を詰める。ここでは最小の形だけ確定。
 */
export interface CropState {
  /** クロップ枠に対する画像の x オフセット（px または 0..1 の比率。#3 で確定） */
  offsetX: number;
  /** クロップ枠に対する画像の y オフセット */
  offsetY: number;
  /** ズーム倍率（1 = 等倍） */
  scale: number;
}
