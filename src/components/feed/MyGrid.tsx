import { type CSSProperties, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import AccountName from "../account/AccountName.tsx";
import ProfileEditor from "../account/ProfileEditor.tsx";
import PostDetail from "./PostDetail.tsx";
import EditPost from "./EditPost.tsx";
import CitizenStats from "./CitizenStats.tsx";
import ProgressiveImage from "../ui/ProgressiveImage.tsx";
import LoadMoreButton from "./LoadMoreButton.tsx";
import { useBackToClose } from "./useBackToClose.ts";
import { deletePost, fetchMyPosts, fetchMyProfileResilient } from "../../lib/nostr/client.ts";
import { discoverTagHref } from "../../lib/feed/discoverFilter.ts";
import { getDisplayName, getPublicKeyHex } from "../../lib/nostr/keys.ts";
import { mergeAppendById, type FeedPost, type Profile } from "../../lib/feed/parse.ts";

const MY_PAGE = 100;
import { useT, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";
import { waitForSwCheck } from "../../lib/pwa/registerUpdate.ts";

type Status = "loading" | "error" | "loaded";

/**
 * 「自分の植物」島（#28・client:only）。
 * - 自分の pubkey ＋ t:hanoba の投稿だけを取得して表示。
 * - 各投稿を削除できる（NIP-09 kind:5 ＋ nostr.build 画像削除＝写真と一蓮托生）。
 * - 表示名（ユーザー名）は共通 AccountName で表示・変更（compose と同一の仕組み）。
 * 鍵・ネットワークはクライアントのみ（getPublicKeyHex / fetchMyPosts / deletePost）。
 */
// lang は me.astro がページの locale を流す（#147）。今は既定（ja）固定＝挙動不変。
export default function MyGrid({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  // lang は SSR/初期描画の種（ja）。マウント後にクライアント解決値（en を選んでいれば en）へ寄せる。
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
  const [status, setStatus] = useState<Status>("loading");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // 編集中の投稿 id（#300）。EditPost モーダルを開く。
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // サムネをクリックで拡大モーダル（#101・フィードと同じ PostDetail）。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // スマホ/ブラウザの「戻る」で（ページを離れず）モーダルだけ閉じる（#454）。/me は deep-link（?p=）を
  // 持たないので URL を変えない履歴マーカーで実現する（feed/discover の usePostDeepLink とは別経路）。
  useBackToClose(selectedId !== null, () => setSelectedId(null));
  // 自分の投稿なので著者は全部自分。モーダルの著者ヘッダ用に自分の kind:0 を1回引く。
  const [myProfile, setMyProfile] = useState<Profile | null>(null);
  // 表示名（AccountName からの onChange で反応的に追従・#525 追補）。ProfileEditor は自分の
  // マウント時 state しか見ないため、AccountName 側での新規登録/変更をここで受け取って両方へ配る。
  // 種撒き（lazy initializer）は必須: null 初期化だと、既存の名前を持つユーザーの初回マウントで
  // ProfileEditor の nameHint 同期エフェクトが render-1 時点の null を一瞬だけ見てしまい、
  // 自分自身の正しい値を無駄に巻き戻す再レンダーが挟まる（#525 セルフレビュー S1）。
  const [accountName, setAccountName] = useState<string | null>(() => getDisplayName());
  // #554: 「もっと見る」（過去へ遡って追記）。hasMore は初期 true、新規増分0 で打ち止め。
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // アンマウント後 / 再取得中の古い応答での setState を防ぐ（stale-async ガード）。
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  async function load() {
    setStatus("loading");
    setHasMore(true);
    try {
      // PWA 更新チェックが一段落するまで relay 取得を待つ（#551・agasteer 方式）。直後に
      // 更新 reload が起きた場合に無駄になる取得を減らす。初回以降はすでに解決済みで即時。
      await waitForSwCheck;
      const pubkey = await getPublicKeyHex();
      const result = await fetchMyPosts(pubkey, MY_PAGE);
      if (!aliveRef.current) return;
      setPosts(result);
      setStatus("loaded");
      // モーダルの著者表示用に自分のプロフィールも引く（失敗時の可視名は author.unnamed、
      // npub はプロフィールリンクと aria の識別補助にだけ残す）。
      void fetchMyProfileResilient(pubkey).then((p) => {
        if (aliveRef.current) setMyProfile(p);
      });
    } catch {
      if (aliveRef.current) setStatus("error");
    }
  }

  // #554: 最古 createdAt を until にして自分の投稿を過去へ遡り追記する。編集/削除（id ベース）と両立し、
  // CitizenStats は増えた posts 全体を見るので自然に更新される。
  async function loadMore() {
    const oldest = posts[posts.length - 1]; // createdAt 降順＝末尾が最古。
    if (loadingMore || oldest === undefined) return;
    setLoadingMore(true);
    const until = oldest.createdAt;
    try {
      const pubkey = await getPublicKeyHex();
      const batch = await fetchMyPosts(pubkey, MY_PAGE, until);
      if (!aliveRef.current) return;
      setPosts((prev) => {
        const merged = mergeAppendById(prev, batch);
        if (merged.length === prev.length) setHasMore(false); // 新規増分0 で打ち止め。
        return merged;
      });
    } catch {
      // 取得失敗はボタンを残して再試行可能にする。
    } finally {
      if (aliveRef.current) setLoadingMore(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onDelete(post: FeedPost) {
    setConfirmId(null);
    setNotice(null);
    setDeletingId(post.id);
    try {
      const { imageDeleted } = await deletePost(post);
      if (!aliveRef.current) return;
      setPosts((cur) => cur.filter((p) => p.id !== post.id));
      // 写真と一蓮托生のはずが、画像削除が確認できなかった場合は正直に伝える。
      if (post.imageUrls.length > 0 && !imageDeleted) {
        setNotice(t("my.delete.photoUnconfirmed"));
      }
    } catch {
      if (aliveRef.current) {
        setNotice(t("my.delete.failed"));
      }
    } finally {
      if (aliveRef.current) setDeletingId(null);
    }
  }

  return (
    <LocaleProvider value={loc}>
    <section className="flex flex-col gap-5">
      {/* アカウント＋プロフィールを1枚のカードに統合（#104）。名前（変更/アカウント変更）が
          プロフィール内に収まり、操作ボタンは名前の下段に並ぶ。両者を bare で内包する。
          AccountName は compose（投稿ゲート）と同一の共通コンポーネント。 */}
      <div className="glass rounded-2xl p-5 flex flex-col gap-4">
        <AccountName bare onChange={setAccountName} />
        <div className="border-t border-white/10" />
        {/* プロフィール編集（アイコン・自己紹介・複数サイト・#35 Piece3）。著者ヘッダに反映される。
            nameHint で AccountName の最新値を渡し、名前を新規登録した直後も編集トグルが
            即座に有効化されるようにする（#525 追補・再読み込み不要）。 */}
        <ProfileEditor bare nameHint={accountName} />
      </div>

      {notice !== null && (
        <p
          role="status"
          // 案内はアプリ標準の素の glass パネルに揃える（Composer の「投稿しました」等と同じ。
          // 左ピンク線の旧スタイルは世界観に馴染まず撤去・#300 kako-jun 実機指摘）。
          className="glass rounded-2xl text-ha-ink px-4 py-3 text-sm"
        >
          {notice}
        </p>
      )}

      {/* 活動スタッツ（#272・段階1）。自分の t:hanoba 投稿からクライアント集計（投稿数/写真数/品種/在籍）。
          名乗り有無で市民レベル（旅人/市民の二値・#525）を出す。取得済み（loaded）のときだけ。 */}
      {status === "loaded" && (
        <CitizenStats posts={posts} hasName={accountName !== null} subjectName={t("my.subject")} />
      )}

      {status === "loading" && (
        <>
          <p role="status" className="sr-only">
            {t("my.loading.sr")}
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
            onClick={() => void load()}
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <p className="text-ha-ink/70">{t("my.empty")}</p>
            <a
              href="/compose"
              className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
            >
              {t("my.firstPost")}
            </a>
          </div>
        ) : (
          <ul className="grid grid-cols-3 sm:grid-cols-4 gap-0.5">
            {posts.map((post, i) => (
              <li
                key={post.id}
                className="ha-rise relative aspect-square overflow-hidden rounded-md bg-ha-green-soft"
                style={{ "--i": Math.min(i, 11) } as CSSProperties}
              >
                {post.imageUrl !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedId(post.id)}
                    aria-label={post.caption === "" ? t("card.photo.zoom") : post.caption}
                    className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ha-green"
                  >
                    <ProgressiveImage
                      src={post.imageUrl}
                      alt={post.caption}
                      className="w-full h-full object-cover"
                    />
                    {post.imageUrls.length > 1 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-ha-white backdrop-blur-sm">
                        {t("card.photos.count", { n: post.imageUrls.length })}
                      </span>
                    )}
                  </button>
                )}

                {/* 編集・削除ボタン（常時うっすら・hover で明瞭）。編集＝再投稿（#300）。 */}
                {deletingId !== post.id && confirmId !== post.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditingId(post.id)}
                      aria-label={t("my.edit.aria")}
                      className="absolute top-1.5 right-11 grid place-items-center w-8 h-8 rounded-full bg-black/45 backdrop-blur-md text-ha-white opacity-70 hover:opacity-100 hover:bg-ha-green transition"
                    >
                      <Icon name="writing" className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(post.id)}
                      aria-label={t("my.delete.aria")}
                      className="absolute top-1.5 right-1.5 grid place-items-center w-8 h-8 rounded-full bg-black/45 backdrop-blur-md text-ha-white opacity-70 hover:opacity-100 hover:bg-ha-pink transition"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </>
                )}

                {/* 確認オーバーレイ */}
                {confirmId === post.id && (
                  <div className="absolute inset-0 grid place-items-center gap-2 bg-black/70 backdrop-blur-sm p-2 text-center">
                    <p className="text-xs text-ha-white leading-snug">
                      {t("my.delete.confirm.q")}
                      <br />
                      {t("my.delete.confirm.note")}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onDelete(post)}
                        className="rounded-full bg-ha-pink text-ha-white px-3 py-1 text-xs font-semibold hover:brightness-110 transition"
                      >
                        {t("my.delete.confirm.yes")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-full bg-white/15 text-ha-white px-3 py-1 text-xs hover:bg-white/25 transition"
                      >
                        {t("my.delete.confirm.no")}
                      </button>
                    </div>
                  </div>
                )}

                {/* 削除中 */}
                {deletingId === post.id && (
                  <div className="absolute inset-0 grid place-items-center bg-black/70 text-xs text-ha-white">
                    {t("my.delete.deleting")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ))}

      {/* #554: もっと見る（自分の投稿を過去へ遡って追記）。投稿があるときだけ出す。 */}
      {status === "loaded" && posts.length > 0 && (
        <LoadMoreButton hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
      )}

      {/* 編集モーダル（#300）。編集＝削除→確認つき再投稿（写真 URL は再利用）。 */}
      {editingId !== null &&
        (() => {
          const editing = posts.find((p) => p.id === editingId);
          if (editing === undefined) return null;
          return (
            <EditPost
              post={editing}
              onClose={() => setEditingId(null)}
              onEdited={(newPost) => {
                // 旧投稿を新投稿に差し替える（旧は kind:5 で削除済み・順序は据え置き＝跳ねさせない）。
                setPosts((cur) => cur.map((p) => (p.id === editingId ? newPost : p)));
                setEditingId(null);
                setNotice(t("my.edit.done"));
              }}
            />
          );
        })()}

      {/* 拡大モーダル（#101）。フィードと同じ PostDetail。タグは discover 再検索へ繋ぐ。 */}
      {selectedId !== null &&
        (() => {
          const selected = posts.find((p) => p.id === selectedId);
          if (selected === undefined) return null;
          return (
            <PostDetail
              post={selected}
              profile={myProfile}
              onClose={() => setSelectedId(null)}
              onSelectHashtag={(tag) => {
                if (typeof window !== "undefined") {
                  // discover は `?tags=` だけを読む（`?q=` は無視され既定ビューに落ちる）ので discoverTagHref を使う。
                  window.location.href = discoverTagHref(tag);
                }
              }}
            />
          );
        })()}
    </section>
    </LocaleProvider>
  );
}
