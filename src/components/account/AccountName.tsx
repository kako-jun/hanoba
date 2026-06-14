import { useEffect, useState } from "react";
import { saveDisplayName } from "../../lib/nostr/client.ts";
import { getDisplayName } from "../../lib/nostr/keys.ts";

interface Props {
  /** 名前が変わるたび（マウント時含む）に呼ぶ。投稿ゲート等が現在名を知るため。 */
  onChange?: (name: string | null) => void;
  /** 未設定時の促し文（compose は「はじめまして…」、/me は標準）。 */
  promptLabel?: string;
}

/**
 * 表示名（ユーザー名）の表示・設定・変更を行う共通コンポーネント（#28/#22）。
 * compose（投稿ゲート）と /me（自分の植物）で**同一の仕組み**を使う＝挙動を揃える。
 * - 未設定なら最初から入力状態（「ユーザー名を入れたら投稿できる」）。
 * - 保存は client.saveDisplayName（ローカル保存＋best-effort kind:0 publish）。
 */
export default function AccountName({ onChange, promptLabel = "お名前は？" }: Props) {
  const [name, setName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const current = getDisplayName();
    setName(current);
    onChange?.(current);
    if (current === null) {
      setEditing(true); // 未設定は最初から入力
    }
    // onChange は親が安定参照で渡す前提。初回マウントのみ。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === "") return;
    setName(trimmed);
    setEditing(false);
    onChange?.(trimmed);
    await saveDisplayName(trimmed); // ローカル保存＋best-effort publish（共通）
  }

  if (editing) {
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
      <button
        type="button"
        onClick={() => {
          setDraft(name ?? "");
          setEditing(true);
        }}
        className="shrink-0 text-sm text-ha-green hover:text-ha-green-deep transition-colors"
      >
        {name === null ? "名前を設定" : "名前を変える"}
      </button>
    </div>
  );
}
