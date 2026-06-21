import { useEffect, useState } from "react";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import { fetchMyProfileResilient, saveDisplayName } from "../../lib/nostr/client.ts";
import {
  getDisplayName,
  getPublicKeyHex,
  importNsec,
  setDisplayName,
  setProfileExtra,
} from "../../lib/nostr/keys.ts";
import { useT, useLocale } from "../../lib/i18n/index.ts";

interface Props {
  /** 名前が変わるたび（マウント時含む）に呼ぶ。投稿ゲート等が現在名を知るため。 */
  onChange?: (name: string | null) => void;
  /** 未設定時の促し文（「はじめまして。」で迎える・#92 の「ハンドルネーム」表記に統一）。 */
  promptLabel?: string;
  /** 外側のガラスカードを描かない（/me でプロフィールカードに内包するとき・#104）。 */
  bare?: boolean;
}

type Mode = "display" | "edit" | "import";

/**
 * 表示名（ユーザー名）の表示・設定・変更＋既存アカウント（nsec）の取り込み（#28/#22）。
 * compose（投稿ゲート）と /me（自分の植物）で**同一の仕組み**を使う。
 * - 未設定なら最初から入力（「ユーザー名を入れたら投稿できる」）。
 * - **すでにアカウントがある人**は nsec を持ち込める（mypace ユーザーがアカウントを増やさない）。
 */
export default function AccountName({ onChange, promptLabel, bare = false }: Props) {
  const t = useT(useLocale());
  // promptLabel 未指定なら既定の促し（Composer は自前の文言を渡す）。
  const label = promptLabel ?? t("compose.account.prompt");
  // bare のときはガラスカードを描かず、親（/me のプロフィールカード）に内包される（#104）。
  const wrap = bare ? "" : "glass rounded-2xl p-5 ";
  const [name, setName] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("display");
  const [draft, setDraft] = useState("");
  const [nsecDraft, setNsecDraft] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const current = getDisplayName();
    setName(current);
    onChange?.(current);
    if (current === null) setMode("edit"); // 未設定は最初から入力
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === "") return;
    setName(trimmed);
    setMode("display");
    onChange?.(trimmed);
    await saveDisplayName(trimmed);
  }

  // 既存アカウント（nsec）の取り込み。鍵が変わるので、既存プロフィール名を引き継いで
  // ページを読み直す（自分の植物・投稿主体が新しい鍵に切り替わる）。
  async function doImport() {
    const value = nsecDraft.trim();
    if (value === "") return;
    setImportError(null);
    setImporting(true);
    try {
      importNsec(value); // nsec でなければ throw
    } catch {
      setImporting(false);
      setImportError(t("account.name.import.error.invalid"));
      return;
    }
    try {
      const pubkey = await getPublicKeyHex();
      // 新アカウントの kind:0 全体を引き継ぐ（名前だけでなく picture/about/websites も）。
      // importNsec で旧鍵の控えは消えているので、ここで新鍵の値を再シードする（#78 レビュー M1）。
      // 単発取得だと接続直後に websites を載せた版を掴み損ね、控えに websites:[] を焼いてしまう
      // （#93 の発端）。bounded retry で最新版を掴んでから控えに焼く。
      const existing = await fetchMyProfileResilient(pubkey);
      if (existing !== null) {
        if (existing.name !== null) setDisplayName(existing.name);
        setProfileExtra({
          picture: existing.picture,
          about: existing.about,
          websites: existing.websites,
          favoriteVarieties: existing.favoriteVarieties,
        });
      }
    } catch {
      // プロフィール取得失敗は無視（名前・プロフィールは後で設定できる）。
    }
    if (typeof window !== "undefined") window.location.reload();
  }

  if (mode === "import") {
    return (
      <form
        className={`${wrap}flex flex-col gap-2.5`}
        onSubmit={(e) => {
          e.preventDefault();
          void doImport();
        }}
      >
        <label htmlFor="hanoba-nsec" className="text-sm font-medium text-ha-green-deep">
          {t("account.name.import.label")}
        </label>
        <ClearableInput
          id="hanoba-nsec"
          type="password"
          value={nsecDraft}
          onValueChange={setNsecDraft}
          placeholder={t("account.name.import.placeholder")}
          aria-label={t("account.name.import.aria")}
          autoComplete="off"
          clearLabel={t("account.name.clear")}
          className="rounded-full bg-white/10 border border-white/15 pl-3.5 py-2.5 text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
        />
        {importError !== null && <p className="text-xs text-ha-pink">{importError}</p>}
        <p className="text-xs text-ha-ink/55">
          {t("account.name.import.help")}
        </p>
        {/* アクション行＝主操作（続ける）を右端に・副次（やめる）はその左（#98 統一ポリシー）。 */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setMode(name === null ? "edit" : "display");
              setImportError(null);
            }}
            className="text-sm text-ha-ink/70 hover:text-ha-ink transition-colors"
          >
            {t("account.name.import.cancel")}
          </button>
          <button
            type="submit"
            disabled={importing}
            className="rounded-full bg-ha-green text-ha-white px-4 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
          >
            {importing ? t("account.name.import.submitting") : t("account.name.import.submit")}
          </button>
        </div>
      </form>
    );
  }

  if (mode === "edit") {
    return (
      <form
        className={`${wrap}flex flex-col gap-2.5`}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="hanoba-name" className="text-sm font-medium text-ha-green-deep">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ClearableInput
              id="hanoba-name"
              type="text"
              value={draft}
              onValueChange={setDraft}
              placeholder={t("account.name.edit.placeholder")}
              aria-label={t("account.name.edit.aria")}
              clearLabel={t("account.name.clear")}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="rounded-full bg-white/10 border border-white/15 pl-3.5 py-2.5 text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-full bg-ha-green text-ha-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
          >
            {t("account.name.edit.save")}
          </button>
        </div>
        <p className="text-xs text-ha-ink/55">{t("account.name.edit.hint")}</p>
        <button
          type="button"
          onClick={() => {
            setMode("import");
            setNsecDraft("");
            setImportError(null);
          }}
          className="self-start text-xs text-ha-green hover:text-ha-green-deep underline underline-offset-2"
        >
          {t("account.name.edit.haveAccount")}
        </button>
      </form>
    );
  }

  return (
    // 名前を主に、操作（変更/アカウント変更）は名前の下段へ改行する（モバイルで窮屈・はみ出さない・#104）。
    <div className={`${wrap}flex flex-col gap-2`}>
      <span className="text-ha-ink/85">
        {name === null ? (
          <span className="text-ha-ink/55">{t("account.handle.unset")}</span>
        ) : (
          <span className="font-semibold">{name}</span>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={() => {
            setDraft(name ?? "");
            setMode("edit");
          }}
          className="text-ha-green hover:text-ha-green-deep transition-colors"
        >
          {name === null ? t("account.name.set") : t("account.name.change")}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("import");
            setNsecDraft("");
            setImportError(null);
          }}
          className="text-ha-ink/55 hover:text-ha-ink transition-colors"
        >
          {t("account.name.changeAccount")}
        </button>
      </div>
    </div>
  );
}
