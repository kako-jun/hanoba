import { useEffect, useRef, useState } from "react";
import { nip19 } from "nostr-tools";
import { fetchMyPosts, fetchMyProfileResilient } from "../../lib/nostr/client.ts";
import { discoverTagHref, discoverTagsHref } from "../../lib/feed/discoverFilter.ts";
import { shortNpub, type FeedPost, type Profile } from "../../lib/feed/parse.ts";
import { toSiteLinks } from "../../lib/profile/services.ts";
import { getDisplayName } from "../../lib/nostr/keys.ts";
import Icon from "../ui/Icon.tsx";
import Avatar from "./Avatar.tsx";
import CitizenStats from "./CitizenStats.tsx";
import PostGrid from "./PostGrid.tsx";
import { useT, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";

type Status = "invalid" | "loading" | "error" | "loaded";

/**
 * 他人の公開プロフィール島（#272 段階3・client:only）。
 *
 * 静的サイト（output:static）ゆえ動的ルート `/u/[npub]` を持てないので、`/u?npub=<npub>` の
 * クエリで対象を受け取る（discover の `?tags=` と同型・#291 で SW のクエリ付き deep-link 罠は解消済み）。
 * URL の npub を pubkey hex に直し、`fetchMyPosts(pubkey)`（他人にも流用可）＋ `fetchMyProfileResilient(pubkey)`
 * で公開投稿とプロフィールを取得して見せる。**公開投稿を数えるだけ＝backendless・新たな身バレ無し**。
 *
 * 編集/削除は出さない（/me の MyGrid と違い読み取り専用）。投稿一覧はフィードと同じ読み取り専用 `PostGrid`。
 * 活動スタッツは `/me` と同じ `CitizenStats` を流用（hasName＝相手のプロフィール名の有無）。
 */
// lang は u.astro がページの locale を流す（#147）。今は既定（ja）固定＝挙動不変。
export default function UserProfile({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  // lang は SSR/初期描画の種（ja）。マウント後にクライアント解決値（en を選んでいれば en）へ寄せる。
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
  // URL の ?npub= を pubkey hex に直す（マウント時に一度・クライアントのみ）。
  // 欠落 / npub でない / decode 失敗は null＝"invalid"（取得に行かない）。
  const [pubkey, setPubkey] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  // アンマウント後 / 再取得中の古い応答での setState を防ぐ（stale-async ガード）。
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // マウント時に URL から対象 pubkey を解決する。
  useEffect(() => {
    let hex: string | null = null;
    try {
      const npub = new URLSearchParams(window.location.search).get("npub");
      if (npub !== null && npub !== "") {
        const decoded = nip19.decode(npub);
        if (decoded.type === "npub") hex = decoded.data;
      }
    } catch {
      hex = null; // npub でない・壊れている → invalid
    }
    setPubkey(hex);
    if (hex === null) setStatus("invalid");
  }, []);

  async function load(target: string) {
    setStatus("loading");
    try {
      // 投稿とプロフィールは独立に取れる＝並行。投稿取得が本体（失敗時は error）。
      // プロフィールは best-effort（取れなくても npub フォールバックで表示できる）。
      const [result, prof] = await Promise.all([
        fetchMyPosts(target),
        fetchMyProfileResilient(target).catch(() => null),
      ]);
      if (!aliveRef.current) return;
      setPosts(result);
      setProfile(prof);
      setStatus("loaded");
    } catch {
      if (aliveRef.current) setStatus("error");
    }
  }

  useEffect(() => {
    if (typeof pubkey === "string") void load(pubkey);
    // pubkey 確定（string）後に一度だけ取得する。invalid（null）は load しない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pubkey]);

  // 表示名（取れればプロフィール名・無ければ npub 短縮）。見出し・タイトルに使う。
  const subjectName = profile?.name ?? (typeof pubkey === "string" ? shortNpub(pubkey) : t("profile.subject.default"));
  // 自分のページかどうか（ローカルに名乗り済みの名と一致するか）。鍵生成の副作用（getPublicKeyHex は
  // 鍵が無いと生成してしまう）を避け、getDisplayName（localStorage のみ）と表示名の一致で緩く判定する。
  // 表示名の衝突で別人を「あなた」と誤認しうるが、用途は /me への戻り導線だけ＝実害が無い範囲。
  const isLikelyMe = status === "loaded" && profile?.name != null && getDisplayName() === profile.name;

  // ロード後にタブのタイトルを相手の名前で補完する（静的タイトルは汎用なので）。
  useEffect(() => {
    if (status === "loaded" && typeof document !== "undefined") {
      document.title = `${subjectName} — Hanōba`;
    }
  }, [status, subjectName]);

  const siteLinks = toSiteLinks(profile?.websites ?? []);

  if (status === "invalid") {
    return (
      <LocaleProvider value={loc}>
        <div className="py-16 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">{t("profile.notFound")}</p>
          <a
            href="/discover"
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            {t("profile.toDiscover")}
          </a>
        </div>
      </LocaleProvider>
    );
  }

  return (
    <LocaleProvider value={loc}>
    <section className="flex flex-col gap-5">
      {/* プロフィールヘッダ（アバター・名前・自己紹介・サイトリンク）。取得前/失敗時も npub で骨格を出す。 */}
      <div className="glass rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar src={profile?.picture ?? null} name={subjectName} className="w-16 h-16" />
          <div className="min-w-0 flex flex-col gap-1">
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ha-green-deep break-words">
              {subjectName}
            </h1>
            {isLikelyMe && (
              <a href="/me" className="text-sm font-medium text-ha-green hover:text-ha-green-deep transition-colors">
                {t("profile.isMe")}
              </a>
            )}
          </div>
        </div>

        {profile?.about !== null && profile?.about !== undefined && (
          <p className="text-base leading-relaxed text-ha-ink/80 whitespace-pre-wrap [word-break:auto-phrase]">
            {profile.about}
          </p>
        )}

        {siteLinks.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2">
            {siteLinks.map((link) => (
              <li key={link.url}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${link.label}: ${link.url}`}
                  aria-label={link.label}
                  className="glass grid place-items-center w-9 h-9 rounded-full text-ha-ink/70 hover:text-ha-green-deep hover:border-ha-green/50 transition-colors"
                >
                  <Icon name={link.icon} className="w-4 h-4" />
                </a>
              </li>
            ))}
          </ul>
        )}

        {/* 好きな品種（#141）。同好の士の手がかり。チップをタップで discover をその品種で絞る。 */}
        {profile !== null && profile.favoriteVarieties.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-ha-ink/55">{t("profile.favorites")}</span>
            <ul className="flex flex-wrap gap-1.5">
              {profile.favoriteVarieties.map((v) => (
                <li key={v}>
                  <a
                    href={discoverTagsHref([v])}
                    className="glass inline-flex items-center gap-1.5 rounded-[2px] bg-ha-base/60 px-2.5 py-1 text-sm text-ha-ink shadow-sm shadow-black/25 hover:text-ha-green-deep hover:border-ha-green/50 transition-colors before:-ml-0.5 before:mr-0.5 before:h-3 before:w-1.5 before:shrink-0 before:rounded-full before:bg-ha-green/80"
                  >
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 活動スタッツ（#272）。/me と同じ CitizenStats。hasName は相手のプロフィール名の有無。 */}
      {status === "loaded" && (
        <CitizenStats posts={posts} hasName={profile?.name !== null && profile?.name !== undefined} subjectName={subjectName} />
      )}

      {status === "loading" && (
        <>
          <p role="status" className="sr-only">
            {t("profile.loading.sr")}
          </p>
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-0.5" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="aspect-square rounded-md bg-ha-green-soft animate-pulse" />
            ))}
          </ul>
        </>
      )}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">{t("feed.error.short")}</p>
          <button
            type="button"
            onClick={() => typeof pubkey === "string" && void load(pubkey)}
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <p className="text-ha-ink/70">{t("profile.empty")}</p>
          </div>
        ) : (
          // 読み取り専用の投稿一覧（フィードと同じ PostGrid）。タグクリックは discover の再検索へ。
          // discover は `?tags=` だけを読む（`?q=` は無視され既定ビューに落ちる）ので discoverTagHref を使う。
          <PostGrid
            posts={posts}
            onSelectHashtag={(tag) => {
              if (typeof window !== "undefined") {
                window.location.href = discoverTagHref(tag);
              }
            }}
          />
        ))}
    </section>
    </LocaleProvider>
  );
}
