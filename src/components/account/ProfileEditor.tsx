import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import ResizableTextarea from "../ui/ResizableTextarea.tsx";
import Avatar from "../feed/Avatar.tsx";
import { fetchMyProfileResilient, saveProfile } from "../../lib/nostr/client.ts";
import {
  exportNsec,
  getDisplayName,
  getProfileExtra,
  getPublicKeyHex,
  mergeProfileExtra,
  setProfileExtra,
} from "../../lib/nostr/keys.ts";
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
interface Props {
  /** 外側のガラスカードを描かない（/me で名前と同じプロフィールカードに内包するとき・#104）。 */
  bare?: boolean;
}

export default function ProfileEditor({ bare = false }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [picture, setPicture] = useState<string | null>(null);
  const [about, setAbout] = useState("");
  // サイト行は安定 id で持つ（index key だと並べ替え/中間削除でフォーカス・IME が飛ぶ・レビュー S2）。
  const [sites, setSites] = useState<{ id: number; url: string }[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // 秘密鍵（nsec）バックアップ欄（#213）。表示＋コピーのみ（編集・publish は一切しない）。
  const [nsecRevealed, setNsecRevealed] = useState(false);
  const [nsecCopied, setNsecCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const aliveRef = useRef(true);
  const uidRef = useRef(0);
  const nextId = () => ++uidRef.current;

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
    setSites(extra.websites.map((url) => ({ id: nextId(), url })));

    void (async () => {
      try {
        const pubkey = await getPublicKeyHex();
        // 単発でなく bounded retry で取る。取りこぼすと websites が空のまま固定され、
        // その空控えが clobber を招く（#93）。
        const remote = await fetchMyProfileResilient(pubkey);
        if (!aliveRef.current || remote === null) return;
        setPicture((cur) => cur ?? remote.picture);
        setAbout((cur) => (cur === "" ? (remote.about ?? "") : cur));
        setSites((cur) => (cur.length === 0 ? remote.websites.map((url) => ({ id: nextId(), url })) : cur));
        if (localName === null && remote.name !== null) setName(remote.name);
        // relay から取れた値をローカル控えにも書き戻す（#93）。表示だけ回復して控えが空のまま
        // 残ると、名前変更時の saveDisplayName が websites:[] で relay の正本を潰す（clobber）。
        // mergeProfileExtra はローカル非空を優先するので、編集中の控えは壊さない。
        setProfileExtra(
          mergeProfileExtra(getProfileExtra(), {
            picture: remote.picture,
            about: remote.about,
            websites: remote.websites,
          }),
        );
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

  function updateSite(id: number, value: string) {
    setSites((ss) => ss.map((s) => (s.id === id ? { ...s, url: value } : s)));
    touch();
  }
  function addSite() {
    setSites((ss) => [...ss, { id: nextId(), url: "" }]);
    touch();
  }
  function removeSite(id: number) {
    setSites((ss) => ss.filter((s) => s.id !== id));
    touch();
  }
  function moveSite(i: number, dir: -1 | 1) {
    setSites((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const next = [...ss];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });
    touch();
  }

  async function save() {
    // 名前は AccountName 側で変わりうるので保存直前に読み直す（古い名前で上書きしない・レビュー S3）。
    const currentName = getDisplayName() ?? name;
    if (currentName === null || currentName.trim() === "") return;
    setStatus("saving");
    try {
      await saveProfile({ name: currentName, picture, about, websites: sites.map((s) => s.url) });
      if (aliveRef.current) {
        setName(currentName);
        setStatus("saved");
      }
    } catch {
      if (aliveRef.current) setStatus("error");
    }
  }

  // 秘密鍵（nsec）をクリップボードへコピーする（#213）。read + copy only・publish しない。
  async function copyNsec() {
    try {
      await navigator.clipboard.writeText(exportNsec());
      if (!aliveRef.current) return;
      setNsecCopied(true);
      setTimeout(() => {
        if (aliveRef.current) setNsecCopied(false);
      }, 2000);
    } catch {
      // コピー失敗は黙って何もしない（[表示]で目視・手動コピーできる）。
    }
  }

  // 表示中だけ exportNsec() を1回だけエンコードする（毎レンダーの bech32 を避ける・#213 レビュー nit）。
  const nsecDisplay = useMemo(() => (nsecRevealed ? exportNsec() : "•".repeat(24)), [nsecRevealed]);

  const nameMissing = name === null || name.trim() === "";

  return (
    <section className={`${bare ? "" : "glass rounded-2xl p-5 "}flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar src={picture} name={name ?? "?"} className="w-9 h-9" />
          <span className="flex min-w-0 flex-col">
            {/* bare（/me の統合カード）では名前は上の AccountName が主表示するので重複させない（#104）。 */}
            <span className="text-sm font-semibold text-ha-ink/85 truncate">
              {bare ? "プロフィール" : (name ?? "ハンドルネーム 未設定")}
            </span>
            <span className="text-xs text-ha-ink/50">アイコン・自己紹介・サイト</span>
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
        <div className="flex flex-col gap-5 pt-1">
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
                  className="inline-flex items-center gap-[5px] rounded-full bg-ha-green text-ha-white px-3.5 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
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
            <ClearableInput
              type="url"
              value={picture ?? ""}
              onValueChange={(v) => {
                setPicture(v === "" ? null : v);
                touch();
              }}
              placeholder="または画像 URL を貼る（https://…）"
              aria-label="アイコン画像 URL"
              className="rounded-full bg-white/10 border border-white/15 pl-3.5 py-2.5 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
            />
            {uploadError !== null && <p className="text-xs text-ha-pink">{uploadError}</p>}
          </div>

          {/* 自己紹介（ひとこと入力欄と同一デザイン・glass＋下辺ドラッグバーで高さ調整・#188）。 */}
          <ResizableTextarea
            id="hanoba-about"
            label="自己紹介"
            value={about}
            onValueChange={(v) => {
              setAbout(v);
              touch();
            }}
            rows={3}
            placeholder="育てている植物のこと、好きな品種など"
          />

          {/* 複数サイト */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ha-green-deep">サイト・SNS</span>
            <p className="text-xs text-ha-ink/55">
              拡大写真の著者欄にアイコンで並びます。各人が自分のサイトへ誘導できます。
            </p>
            <ul className="flex flex-col gap-2.5 pl-3 border-l border-white/10">
              {sites.map((site, i) => {
                const label = site.url.trim() === "" ? null : detectServiceLabel(site.url);
                return (
                  <li key={site.id} className="flex items-center gap-2.5">
                    <div className="flex-1 flex flex-col gap-0.5">
                      <ClearableInput
                        type="url"
                        value={site.url}
                        onValueChange={(v) => updateSite(site.id, v)}
                        placeholder="https://…"
                        aria-label={`サイト ${i + 1} の URL`}
                        clearLabel={`サイト ${i + 1} をクリア`}
                        className="rounded-full bg-white/10 border border-white/15 pl-3.5 py-2.5 text-sm text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:ring-2 focus:ring-ha-green/30"
                      />
                      {label !== null && (
                        <span className="pl-3.5 text-[11px] text-ha-ink/45">{label}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
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
                        disabled={i === sites.length - 1}
                        aria-label={`サイト ${i + 1} を下へ`}
                        className="grid place-items-center w-8 h-8 rounded-full text-ha-ink/55 hover:text-ha-ink hover:bg-white/10 disabled:opacity-30 transition"
                      >
                        <Icon name="chevron" className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSite(site.id)}
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
              className="self-start mt-0.5 text-sm text-ha-green hover:text-ha-green-deep underline underline-offset-2"
            >
              ＋ サイトを追加
            </button>
          </div>

          {/* 保存（アクション行＝主操作を右端に・補足は左／#98 統一ポリシー）。 */}
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
            {nameMissing && (
              <span className="text-xs text-ha-ink/55">先に上でハンドルネームを設定してください。</span>
            )}
            {!nameMissing && status === "saved" && (
              <span className="text-xs text-ha-green-deep">保存しました。</span>
            )}
            {!nameMissing && status === "error" && (
              <span className="text-xs text-ha-pink">保存できませんでした（端末には保存済み）。</span>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={status === "saving" || nameMissing}
              className="rounded-full bg-ha-green text-ha-white px-5 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition"
            >
              {status === "saving" ? "保存中…" : "保存"}
            </button>
          </div>

          {/* 秘密鍵（バックアップ）＝表示＋コピー専用（#213）。普段見せたくないので展開パネルの
              最下部・最も目立たない位置に置く。値は exportNsec() のローカル読み取りのみで、
              kind:0（save）の payload には絶対に載せない。 */}
          <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
            <span className="text-sm font-medium text-ha-green-deep">秘密鍵（バックアップ）</span>
            <p className="text-xs text-ha-ink/55">
              この鍵を控えておかないと、端末を変えたりブラウザのデータを消すと二度と戻せません。
            </p>
            <code
              aria-label="秘密鍵（nsec）"
              className="block break-all rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-xs text-ha-ink/85 font-mono"
            >
              {nsecDisplay}
            </code>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <button
                type="button"
                onClick={() => setNsecRevealed((v) => !v)}
                aria-label={nsecRevealed ? "秘密鍵を隠す" : "秘密鍵を表示する"}
                className="text-sm text-ha-green hover:text-ha-green-deep transition-colors"
              >
                {nsecRevealed ? "隠す" : "表示"}
              </button>
              <button
                type="button"
                onClick={() => void copyNsec()}
                aria-label="秘密鍵をコピーする"
                className="text-sm text-ha-green hover:text-ha-green-deep transition-colors"
              >
                コピー
              </button>
              {nsecCopied && <span className="text-xs text-ha-green-deep">コピーしました</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
