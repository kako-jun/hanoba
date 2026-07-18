import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { exportNsec } from "../../lib/nostr/keys.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

/**
 * 初投稿直後の nsec バックアップ念押し（#558 Layer2）。
 *
 * 秘密鍵はこの端末のローカルにしか無い。ストレージ eviction（Layer1 の persist で減らせるが 0 には
 * ならない）でブラウザデータが消えると、控えていない人はアカウントを永久に失う。アイデンティティが
 * 価値を持つ瞬間＝初投稿の直後に、鍵の控えを一度だけ前面化して促す（既存の ProfileEditor 最下部の
 * バックアップ欄はわざと目立たない位置なので、初回だけこちらで積極的に見せる）。
 *
 * **表示＋クリップボードコピーのみ**。exportNsec() のローカル読み取りだけで、publish/送信は一切しない
 * （keys.ts の sk 保存ロジックには触れない）。閉じる操作（保存した／あとで／Esc／背景）はすべて
 * onClose を呼び、親（Composer）が一度きりフラグを立てて /me へ遷移する。
 */
export default function NsecBackupPrompt({ onClose }: { onClose: () => void }) {
  const t = useT(useLocale());
  // 表示中だけ exportNsec() を1回だけエンコードする（毎レンダーの bech32 を避ける・ProfileEditor と同流儀）。
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const nsecDisplay = useMemo(() => (revealed ? exportNsec() : "•".repeat(24)), [revealed]);

  // Esc で閉じる（PostDetail と同じ a11y）。
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function copyNsec() {
    try {
      await navigator.clipboard.writeText(exportNsec());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // コピー失敗は黙って何もしない（[表示]で目視・手動コピーできる）。
    }
  }

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("compose.nsecPrompt.title")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong relative w-full max-w-md max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col gap-4 p-5 ha-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ha-green-deep">{t("compose.nsecPrompt.title")}</h2>
        <p className="text-sm text-ha-ink/80">{t("compose.nsecPrompt.body")}</p>
        <p className="text-xs text-ha-ink/55">{t("account.profile.nsec.warning")}</p>

        <code
          aria-label={t("account.profile.nsec.codeAria")}
          className="block break-all rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-xs text-ha-ink/85 font-mono"
        >
          {nsecDisplay}
        </code>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? t("account.profile.nsec.hideAria") : t("account.profile.nsec.showAria")}
            className="text-sm text-ha-green hover:text-ha-green-deep transition-colors"
          >
            {revealed ? t("account.profile.nsec.hide") : t("account.profile.nsec.show")}
          </button>
          <button
            type="button"
            onClick={() => void copyNsec()}
            aria-label={t("account.profile.nsec.copyAria")}
            className="text-sm text-ha-green hover:text-ha-green-deep transition-colors"
          >
            {t("account.profile.nsec.copy")}
          </button>
          {copied && <span className="text-xs text-ha-green-deep">{t("account.profile.nsec.copied")}</span>}
        </div>

        {/* 別端末での復元は既存の nsec 取り込み（AccountName）に委ねる＝一言添えるだけ（新 UI は作らない）。 */}
        <p className="text-xs text-ha-ink/55">{t("compose.nsecPrompt.restoreHint")}</p>

        {/* 主アクション（保存した）を右端に・副（あとで）は左（#98 統一ポリシー）。どちらも一度きりで閉じる。 */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ha-ink/55 hover:text-ha-ink transition-colors"
          >
            {t("compose.nsecPrompt.later")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-ha-green text-ha-white px-5 py-2 text-sm font-semibold hover:brightness-110 transition"
          >
            {t("compose.nsecPrompt.saved")}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
