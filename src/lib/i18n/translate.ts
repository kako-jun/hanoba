// 投稿 caption のオンデマンド翻訳（#385・PostDetail のみ）。
//
// ブラウザ内蔵の **Translator API / LanguageDetector API**（Chrome/Edge/Android Chrome）を使う＝
// 完全無料・APIキー不要・サーバ不要・on-device（プライバシー◎）＝hanoba の backendless 思想と整合。
// 非対応ブラウザ（iOS Safari / Firefox）は graceful degradation＝ボタンを出さず原文のまま（写真ファースト
// なので破綻しない）。表示層のみ＝Nostr イベント本体・タグ・札は一切触らない（#385）。
//
// ここはデータ/ロジックの単一責務。UI と state は useCaptionTranslation フックが持つ。
// 純関数（guessLanguageHeuristic / shouldOfferTranslation）はテスト可・API ラッパは feature detection で SSR/jsdom 安全。

import type { Locale } from "./locale.ts";

/**
 * 文字種による素朴な言語判定（純関数・LanguageDetector が無い環境の前段）。
 * かな（ひらがな/カタカナ）があれば ja、漢字のみ（かな無し）なら zh、それ以外（ラテン等）は判別不能＝null。
 * ラテン文字の en/es は字種では区別できないので null（＝「とりあえずボタンを出す」へ倒す）。
 */
export function guessLanguageHeuristic(text: string): Locale | null {
  if (/[぀-ゟ゠-ヿ]/.test(text)) return "ja"; // ひらがな/カタカナ
  if (/[一-鿿]/.test(text)) return "zh"; // 漢字（かな無し＝中国語寄り）
  return null;
}

/** Translator API が実際に使えるか（feature detection・SSR/jsdom では false）。 */
export function isTranslationSupported(): boolean {
  return typeof globalThis !== "undefined" && "Translator" in globalThis;
}

/**
 * 翻訳ボタンを出すかの判定（純関数）。caption が非空＋翻訳可能＋（検出言語が閲覧言語と違う or 判別不能）。
 * 判別不能（detected===null）は「誤って隠さない」ために出す（#385）。en-US 等のサブタグは先頭で比較する。
 */
export function shouldOfferTranslation(args: {
  captionText: string;
  detected: string | null;
  target: Locale;
  supported: boolean;
}): boolean {
  const { captionText, detected, target, supported } = args;
  if (!supported) return false;
  if (captionText.trim() === "") return false;
  if (detected === null) return true;
  return detected.split("-")[0] !== target;
}

/** 投稿言語の検出。LanguageDetector API（あれば）→ 無ければ字種ヒューリスティック。判別不能は null。 */
export async function detectLanguage(text: string): Promise<string | null> {
  try {
    const LD = (globalThis as Record<string, unknown>).LanguageDetector as
      | { create: () => Promise<{ detect: (t: string) => Promise<Array<{ detectedLanguage?: string }>> }> }
      | undefined;
    if (LD) {
      const detector = await LD.create();
      const results = await detector.detect(text);
      const top = results?.[0];
      if (top?.detectedLanguage) return top.detectedLanguage;
    }
  } catch {
    /* API 不可・モデル未DL 等は素朴判定へ */
  }
  return guessLanguageHeuristic(text);
}

/**
 * caption を閲覧言語へ翻訳（Translator API）。source 未指定なら検出を試みる。
 * source===target は原文をそのまま返す。API 不可・失敗は throw（呼び出し側で原文のまま据える）。
 */
export async function translateCaption(text: string, target: Locale, source?: string | null): Promise<string> {
  const T = (globalThis as Record<string, unknown>).Translator as
    | { create: (o: { sourceLanguage: string; targetLanguage: string }) => Promise<{ translate: (t: string) => Promise<string> }> }
    | undefined;
  if (!T) throw new Error("Translator API unavailable");
  const src = (source ?? (await detectLanguage(text)) ?? "en").split("-")[0] ?? "en";
  if (src === target) return text;
  const translator = await T.create({ sourceLanguage: src, targetLanguage: target });
  return translator.translate(text);
}
