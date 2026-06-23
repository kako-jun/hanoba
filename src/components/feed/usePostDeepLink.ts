import { useEffect, useRef, useState } from "react";
import { fetchPostById } from "../../lib/nostr/client.ts";
import { applyPostParamTo, encodePostNevent, readPostParam } from "../../lib/share/deep-link.ts";
import { type FeedPost } from "../../lib/feed/parse.ts";

interface Args {
  /** 表示中の投稿（取得済み・id 引きの母集団）。 */
  posts: FeedPost[];
  /** 選択中の投稿 id（PostGrid が持つ state）。null で未選択。 */
  selectedId: string | null;
  /** 選択 id の更新（PostGrid の setState）。 */
  setSelectedId: (id: string | null) => void;
}

interface Result {
  /** 表示すべき投稿。posts 内なら id 引き、フィード外（`?p=` 着地）なら externalPost。 */
  selectedPost: FeedPost | null;
  /** カードタップで開く（選択＋`?p=` を pushState）。 */
  openPost: (post: FeedPost) => void;
  /** モーダルを閉じる（履歴を pop か `?p=` 剥がし）。 */
  closePost: () => void;
}

/**
 * 投稿詳細モーダルの deep-link（#386）— URL（`?p=<nevent>`）↔ 選択状態の同期を集約するフック。
 *
 * hanoba は output:"static"（SSR 無し）なので別ルートを持てず、同じ静的 index のまま
 * クエリ `?p=` をクライアント JS が読んでモーダルを開く（「URL は同じ・モーダル島」思想）。
 *
 * **既存の `?tags=` deep-link（DiscoverGrid + discover.ts）と同じ作法に揃える**:
 *   - 意図的操作（openPost）= pushState（戻るで閉じられる）。
 *   - 復元（マウント着地・popstate）= URL を書かない/replaceState（ループ防止）。
 *   - 非同期 fetch は latestRef で最新の id を照合し、古い応答は破棄（stale 防止）。
 *
 * selectedPost は posts 内なら id 引き、無ければ `?p=` で取得した externalPost（フィード外投稿）。
 * SSR 安全: window は effect 内でのみ触る（typeof window === "undefined" を踏まない）。
 */
export function usePostDeepLink({ posts, selectedId, setSelectedId }: Args): Result {
  // `?p=` で取得したフィード外の投稿（posts に居ない）。posts 内の選択なら使わない。
  const [externalPost, setExternalPost] = useState<FeedPost | null>(null);

  // このセッションで `?p=` を pushState で積んだか（closePost で history.back するか replaceState 剥がしか判定）。
  const pushedRef = useRef(false);
  // 直近の取得トークン。連続操作で古い fetch 応答が新しい結果を上書きしないよう、await 後に照合して捨てる。
  const latestRef = useRef<string | null>(null);
  // 1回だけ登録する popstate/マウントのハンドラから**最新の posts** を読むための ref
  // （リスナを posts 依存で貼り直すと history イベントを取り逃すため・登録は1回に保つ）。
  const postsRef = useRef(posts);
  postsRef.current = posts;

  // 表示すべき投稿: posts に居れば id 引き、居なければ externalPost（フィード外着地）。
  const selectedPost: FeedPost | null =
    selectedId === null
      ? null
      : (posts.find((p) => p.id === selectedId) ??
        (externalPost !== null && externalPost.id === selectedId ? externalPost : null));

  /** 指定 id を開く（posts 内なら即選択、外なら fetch して externalPost に積む・stale 破棄）。URL は書かない。 */
  function openId(id: string, relays: string[]) {
    const inFeed = postsRef.current.find((p) => p.id === id);
    if (inFeed !== undefined) {
      setExternalPost(null);
      setSelectedId(id);
      return;
    }
    const token = id;
    latestRef.current = token;
    void fetchPostById(id, relays).then((post) => {
      if (latestRef.current !== token) return; // 新しい操作が走っていたら古い応答は捨てる。
      if (post === null) return; // 取れなければ何もしない（モーダル開かず通常フィード・graceful）。
      setExternalPost(post);
      setSelectedId(post.id);
    });
  }

  /** 選択・externalPost をクリアする（URL は書かない＝呼び出し側で剥がす/back する）。 */
  function clearSelection() {
    latestRef.current = null;
    setExternalPost(null);
    setSelectedId(null);
  }

  /** カードタップで開く（意図的操作）。選択し、`?p=<nevent>` を pushState で積む。 */
  function openPost(post: FeedPost) {
    setExternalPost(null);
    setSelectedId(post.id);
    const nevent = encodePostNevent(post);
    if (nevent === null) return; // encode 不能なら URL は変えない（モーダルは開く）。
    try {
      const url = new URL(window.location.href);
      applyPostParamTo(url.searchParams, nevent);
      window.history.pushState(null, "", url.toString());
      pushedRef.current = true;
    } catch {
      // 履歴反映に失敗してもモーダル表示自体は通す（致命的でない）。
    }
  }

  /** モーダルを閉じる。積んだ `?p=` があれば history.back（popstate で閉が確定）、無ければ replaceState で剥がす。 */
  function closePost() {
    if (pushedRef.current) {
      // openPost で積んだ履歴を pop する → popstate が発火し、そこで閉が確定する。
      pushedRef.current = false;
      clearSelection();
      try {
        window.history.back();
      } catch {
        /* back 不能でも selection はクリア済み。 */
      }
      return;
    }
    // deep-link 初回着地（積んでいない）: `?p=` だけ replaceState で剥がす（他クエリは保持）。
    clearSelection();
    try {
      const url = new URL(window.location.href);
      applyPostParamTo(url.searchParams, null);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* URL 剥がしに失敗しても selection はクリア済み。 */
    }
  }

  // マウント着地: URL の `?p=` を読んで開く（既に `?p=` が乗っているので URL は書かない・pushedRef は false のまま）。
  useEffect(() => {
    const param = readPostParam(new URLSearchParams(window.location.search));
    if (param === null) return;
    openId(param.id, param.relays);
    // posts は意図的に依存に入れない（着地は1回。posts 後続更新での再着地は selectedPost の id 引きが拾う）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 戻る/進む（popstate）: URL を読み直して開く/閉じる。**URL は書かない**（二重に積まない・ループ防止）。
  useEffect(() => {
    const onPopState = () => {
      const param = readPostParam(new URLSearchParams(window.location.search));
      if (param === null) {
        clearSelection();
        return;
      }
      openId(param.id, param.relays);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // posts は意図的に依存に入れない（onPopState はクロージャで最新 posts を読む必要があるが、
    // selectedPost の id 引きが posts 更新を拾うため、リスナ自体は1回登録で足りる）。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { selectedPost, openPost, closePost };
}
