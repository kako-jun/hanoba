import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import Avatar from "../feed/Avatar.tsx";
import { fetchMyProfile, saveProfile } from "../../lib/nostr/client.ts";
import { getDisplayName, getProfileExtra, getPublicKeyHex } from "../../lib/nostr/keys.ts";
import { detectServiceLabel } from "../../lib/profile/services.ts";
import { uploadImage } from "../../lib/nostr/upload.ts";

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * プロフィール編集（#35 Piece3・/me）。アイコン・自己紹介・複数サイトを設定する。
 * 名前（ユーザー名）は AccountName 側で設定するのでここでは参照のみ（未設定なら保存を促す）。
 *
 * kind:0 は replaceable なので保存は name＋picture＋about＋websites の全体を publish する
 * （client.saveProfile）。初期値はローカル控え（getProfileExtra）＋ relay の自分の kind:0 で補完し、
 * 他デバイス/他クライアントで設定済みの値も引き継ぐ。鍵・ネットワークはクライアントのみ。
 */
export default function ProfileEditor() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [about, setAbout] = useState("");
  const [websites, setWebsites] = useState<string[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // 初期値: ローカル控え → relay の自分の kind:0 で「ローカルが空の項目だけ」補完する
  // （ローカルでの編集を上書きしない）。
  useEffect(() => {
    const localName = getDisplayName();
    const extra = getProfileExtra();
    setName(localName);
    setPicture(extra.picture);
    setAbout(extra.about ?? "");
    setWebsites(extra.websites);

    void (async () => {
      try {
        const pubkey = await getPublicKeyHex();
        const remote = await fetchMyProfile(pubkey);
        if (!aliveRef.current || remote === null) return;
        setPicture((cur) => cur ?? remote.picture);
        setAbout((cur) => (cur === "" ? (remote.about ?? "") : cur));
        setWebsites((cur) => (cur.length === 0 ? remote.websites : cur));
        if (localName === null && remote.name !== null) setName(remote.name);
      } catch {
        // relay 取得失敗は無視（ローカル値で編集できる）。
      }
    })();
  }, []);

  // 編集したら「保存しました/失敗」表示を消す。
  function touch() {
    if (status !== "idle") setStatus("idle");
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file === undefined) return;
    setUploadError(null);
    setUploading(true);
    touch();
    try {
      const { url } = await uploadImage(file);
      if (aliveRef.current) setPicture(url);
    } catch {
      if (aliveRef.current) setUploadError("画像をアップロードできませんでした。時間をおいて再試行してください。");
    } finally {
      if (aliveRef.current) setUploading(false);
      if (fileRef.current !== null) fileRef.current.value = "";
    }
  }

  function updateSite(i: number, value: string) {
    setWebsites((ws) => ws.map((w, j) => (j === i ? value : w)));
    touch();
  }
  function addSite() {
    setWebsites((ws) => [...ws, ""]);
    touch();
  }
  function removeSite(i: number) {
    setWebsites((ws) => ws.filter((_, j) => j !== i));
    touch();
  }
  function moveSite(i: number, dir: -1 | 1) {
    setWebsites((ws) => {
      const j = i + dir;
      if (j < 0 || j >= ws.length) return ws;
      const next = [...ws];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    touch();
  }

  async function save() {
    if (name === null || name.trim() === "") return;
    setStatus("saving");
    try {
      await saveProfile({ name, picture, about, websites });
      if (aliveRef.current) setStatus("saved");
    } catch {
      if (aliveRef.current) setStatus("error");
    }
  }

  const nameMissing = name === null || name.trim() === "";

  return (
    <section className="glass rounded-2xl px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar src={picture} name={name ?? "?"} className="w-9 h-9" />
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-ha-ink/85 truncate">
              {name ?? "ユーザー名 未設定"}
            </span>
            <span className="text-xs text-ha-ink/50">プロフィール（アイコン・自己紹介・サイト）</span>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="shrink-0 inline-flex items-center gap-1 text-sm text-ha-green hover:text-ha-green-deep transition-colors"
        >
          {open ? "閉じる" : "編集"}
          <Icon name="chevron" className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-4 pt-1">
          {/* アイコン */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ha-green-deep">アイコン</span>
            <div className="flex items-center gap-3">
              <Avatar src={picture} name={name ?? "?"} className="w-14 h-14" />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ha-green text-ha-white px-3.5 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
                >
                  <Icon name="image" className="w-4 h-4" />
                  {uploading ? "アップロード中…" : "画像を選ぶ"}
                </button>
                {picture !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setPicture(null);
                      touch();
                    }}
                    className="text-sm text-ha-ink/55 hover:text-ha-pink transition-colors"
                  >
                    削除
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void onPickFile(e)}
                  className="hidden"
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
            </div>
            {/* URL 直接指定も可（他所の画像を使いたい人向け）。 */}
            <input
              type="url"
              value={picture ?? ""}
              onChange={(e) => {
                setPicture(e.target.value === "" ? null : e.target.value);
                touch();
              }}
              placeholder="または画像 URL を貼る（https://…）"
              aria-label="アイコン画像 URL"
              className="rounded-full bg-white/10 border border-white/15 px-3.5 py-2 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
            />
            {uploadError !== null && <p className="text-xs text-ha-pink">{uploadError}</p>}
          </div>

          {/* 自己紹介 */}
          <div className="flex flex-col gap-2">
            <label htmlFor="hanoba-about" className="text-sm font-medium text-ha-green-deep">
              自己紹介
            </label>
            <textarea
              id="hanoba-about"
              value={about}
              onChange={(e) => {
                setAbout(e.target.value);
                touch();
              }}
              rows={3}
              placeholder="育てている植物のこと、好きな品種など"
              className="rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30 resize-y"
            />
          </div>

          {/* 複数サイト */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ha-green-deep">サイト・SNS</span>
            <p className="text-xs text-ha-ink/55">
              拡大写真の著者欄にアイコンで並びます。各人が自分のサイトへ誘導できます。
            </p>
            <ul className="flex flex-col gap-2">
              {websites.map((url, i) => {
                const label = url.trim() === "" ? null : detectServiceLabel(url);
                return (
                  <li key={i} className="flex items-center gap-1.5">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => updateSite(i, e.target.value)}
                        placeholder="https://…"
                        aria-label={`サイト ${i + 1} の URL`}
                        className="w-full rounded-full bg-white/10 border border-white/15 px-3.5 py-2 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
                      />
                      {label !== null && (
                        <span className="pl-3.5 text-[11px] text-ha-ink/45">{label}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => moveSite(i, -1)}
                        disabled={i === 0}
                        aria-label={`サイト ${i + 1} を上へ`}
                        className="grid place-items-center w-8 h-8 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 disabled:opacity-30 transition"
                      >
                        <Icon name="chevron" className="w-4 h-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSite(i, 1)}
                        disabled={i === websites.length - 1}
                        aria-label={`サイト ${i + 1} を下へ`}
                        className="grid place-items-center w-8 h-8 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 disabled:opacity-30 transition"
                      >
                        <Icon name="chevron" className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSite(i)}
                        aria-label={`サイト ${i + 1} を削除`}
                        className="grid place-items-center w-8 h-8 rounded-full text-ha-ink/55 hover:text-ha-pink hover:bg-white/10 transition"
                      >
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={addSite}
              className="self-start text-sm text-ha-green hover:text-ha-green-deep underline underline-offset-2"
            >
              ＋ サイトを追加
            </button>
          </div>

          {/* 保存 */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={status === "saving" || nameMissing}
              className="rounded-full bg-ha-green text-ha-white px-5 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
            >
              {status === "saving" ? "保存中…" : "保存"}
            </button>
            {nameMissing && (
              <span className="text-xs text-ha-ink/55">先に上でユーザー名を設定してください。</span>
            )}
            {!nameMissing && status === "saved" && (
              <span className="text-xs text-ha-green-deep">保存しました。</span>
            )}
            {!nameMissing && status === "error" && (
              <span className="text-xs text-ha-pink">保存できませんでした（端末には保存済み）。</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
