// 投稿 caption のオンデマンド翻訳フック（#385・PostDetail 専用）。
//
// 表示層のみ・エフェメラル: 翻訳結果はセッション内の state とメモリキャッシュだけに持つ。リロードで
// relay から取り直し＝原文に戻る（X と同じモデル）。Nostr イベント本体・タグ・札は一切触らない。
// ロジック/feature detection は translate.ts（純）に寄せ、ここは React state とトグルだけ（単一責務）。

import { useEffect, useState } from "react";
import type { Locale } from "../../lib/i18n/locale.ts";
import {
  detectLanguage,
  isTranslationSupported,
  shouldOfferTranslation,
  translateCaption,
} from "../../lib/i18n/translate.ts";

// `${target}::${caption}` → 訳文。同一 caption の再翻訳を即時化。module スコープ＝リロードで消える（エフェメラル）。
const cache = new Map<string, string>();

export interface CaptionTranslation {
  /** 翻訳ボタンを出すか（非空＋翻訳可能＋言語が違う/不明）。 */
  offer: boolean;
  /** いま原文か訳文か。 */
  mode: "original" | "translated";
  /** 翻訳中（言語パック DL 含む）。 */
  busy: boolean;
  /** 表示すべきテキスト（mode に応じて原文 or 訳文）。 */
  text: string;
  /** 翻訳⇄原文のトグル。 */
  toggle: () => void;
}

export function useCaptionTranslation(captionText: string, target: Locale): CaptionTranslation {
  const [supported] = useState(isTranslationSupported);
  const [detected, setDetected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false); // 言語検出が済んだか（済む前はボタンを出さない＝チラつき防止）
  const [mode, setMode] = useState<"original" | "translated">("original");
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // caption が変わったら状態リセット＋言語検出（別投稿を開いたとき）。
  useEffect(() => {
    let alive = true;
    setMode("original");
    setTranslated(null);
    setChecked(false);
    if (!supported || captionText.trim() === "") {
      setDetected(null);
      return;
    }
    detectLanguage(captionText).then((d) => {
      if (!alive) return;
      setDetected(d);
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, [captionText, supported]);

  const offer = checked && shouldOfferTranslation({ captionText, detected, target, supported });

  function toggle(): void {
    if (mode === "translated") {
      setMode("original");
      return;
    }
    const key = `${target}::${captionText}`;
    const cached = cache.get(key);
    if (cached != null) {
      setTranslated(cached);
      setMode("translated");
      return;
    }
    setBusy(true);
    translateCaption(captionText, target, detected)
      .then((out) => {
        cache.set(key, out);
        setTranslated(out);
        setMode("translated");
      })
      .catch(() => {
        /* 失敗（API 不可・モデル未DL 等）は原文のまま据える＝写真ファーストで破綻しない（#385） */
      })
      .finally(() => setBusy(false));
  }

  return {
    offer,
    mode,
    busy,
    text: mode === "translated" && translated != null ? translated : captionText,
    toggle,
  };
}
