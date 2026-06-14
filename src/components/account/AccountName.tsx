import { useEffect, useState } from "react";
import { fetchProfileName, saveDisplayName } from "../../lib/nostr/client.ts";
import { getDisplayName, getPublicKeyHex, importNsec, setDisplayName } from "../../lib/nostr/keys.ts";

interface Props {
  /** 名前が変わるたび（マウント時含む）に呼ぶ。投稿ゲート等が現在名を知るため。 */
  onChange?: (name: string | null) => void;
  /** 未設定時の促し文（compose は「はじめまして…」、/me は標準）。 */
  promptLabel?: string;
}

type Mode = "display" | "edit" | "import";

/**
 * 表示名（ユーザー名）の表示・設定・変更＋既存アカウント（nsec）の取り込み（#28/#22）。
 * compose（投稿ゲート）と /me（自分の植物）で**同一の仕組み**を使う。
 * - 未設定なら最初から入力（「ユーザー名を入れたら投稿できる」）。
 * - **すでにアカウントがある人**は nsec を持ち込める（mypace ユーザーがアカウントを増やさない）。
 */
export default function AccountName({ onChange, promptLabel = "お名前は？" }: Props) {
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
      setImportError("nsec が正しくありません。`nsec1…` を貼り付けてください。");
      return;
    }
    try {
      const pubkey = await getPublicKeyHex();
      const existing = await fetchProfileName(pubkey);
      if (existing !== null) setDisplayName(existing);
    } catch {
      // プロフィール取得失敗は無視（名前は後で設定できる）。
    }
    if (typeof window !== "undefined") window.location.reload();
  }

  if (mode === "import") {
    return (
      <form
        className="glass rounded-2xl px-4 py-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void doImport();
        }}
      >
        <label htmlFor="hanoba-nsec" className="text-sm font-medium text-ha-green-deep">
          お持ちのアカウントで続ける
        </label>
        <input
          id="hanoba-nsec"
          type="password"
          value={nsecDraft}
          onChange={(e) => setNsecDraft(e.target.value)}
          placeholder="nsec1… を貼り付け"
          aria-label="nsec 秘密鍵"
          autoComplete="off"
          className="rounded-full bg-white/10 border border-white/15 px-3.5 py-2 text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
        />
        {importError !== null && <p className="text-xs text-ha-pink">{importError}</p>}
        <p className="text-xs text-ha-ink/55">
          mypace 等で使っているアカウントで続けられます。情報はこの端末にだけ保存されます。
        </p>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={importing}
            className="rounded-full bg-ha-green text-ha-white px-4 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
          >
            {importing ? "確認中…" : "続ける"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(name === null ? "edit" : "display");
              setImportError(null);
            }}
            className="text-sm text-ha-ink/70 hover:text-ha-ink transition-colors"
          >
            やめる
          </button>
        </div>
      </form>
    );
  }

  if (mode === "edit") {
    return (
      <form
        className="glass rounded-2xl px-4 py-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor="hanoba-name" className="text-sm font-medium text-ha-green-deep">
          {promptLabel}
        </label>
        <div className="flex items-center gap-2">
          <input
            id="hanoba-name"
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="ユーザー名（あとで変えられます）"
            aria-label="ユーザー名"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className="flex-1 rounded-full bg-white/10 border border-white/15 px-3.5 py-2 text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-ha-green text-ha-white px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
          >
            保存
          </button>
        </div>
        <p className="text-xs text-ha-ink/55">名前を入れると、見るだけでなく投稿できます。</p>
        <button
          type="button"
          onClick={() => {
            setMode("import");
            setNsecDraft("");
            setImportError(null);
          }}
          className="self-start text-xs text-ha-green hover:text-ha-green-deep underline underline-offset-2"
        >
          すでにアカウントをお持ちですか？
        </button>
      </form>
    );
  }

  return (
    <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
      <span className="text-ha-ink/85">
        {name === null ? (
          <span className="text-ha-ink/55">ユーザー名 未設定</span>
        ) : (
          <span className="font-semibold">{name}</span>
        )}
      </span>
      <div className="shrink-0 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => {
            setDraft(name ?? "");
            setMode("edit");
          }}
          className="text-ha-green hover:text-ha-green-deep transition-colors"
        >
          {name === null ? "名前を設定" : "名前を変える"}
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
          アカウントを変更
        </button>
      </div>
    </div>
  );
}
