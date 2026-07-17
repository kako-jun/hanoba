import { useEffect, useRef, useState } from "react";
import { fetchDiscoverFiltered } from "../../lib/nostr/client.ts";
import {
  EMPTY_FILTER,
  applyFilterToParams,
  filterSummary,
  isDefaultFilter,
  parseFilter,
  sameTagSet,
  type DiscoverFilter,
} from "../../lib/feed/discoverFilter.ts";
import { mergeAppendById, type FeedPost } from "../../lib/feed/parse.ts";
import { useT, LocaleProvider, resolveClientLocale, DEFAULT_LOCALE, type Locale } from "../../lib/i18n/index.ts";
import { waitForSwCheck } from "../../lib/pwa/registerUpdate.ts";
import PostGrid from "./PostGrid.tsx";
import VarietyFilter from "./VarietyFilter.tsx";
import LoadMoreButton from "./LoadMoreButton.tsx";

const DISCOVER_PAGE = 100;

type Status = "idle" | "loading" | "error" | "loaded";

/** 現在の URL から絞り込みタグを読む（クライアントのみ）。`?tags=` と旧 `?tag=` を parseFilter が吸収する（`?q=` は読まない・無視される）。 */
function readTagsFromUrl(): string[] {
  try {
    return parseFilter(new URLSearchParams(window.location.search)).tags;
  } catch {
    return [];
  }
}

/**
 * クロスクライアント discover の島（client:load）。**品種で絞るだけ**のシンプルな画面（#239・
 * kako-jun 指示で多軸＝投稿者/期間/並び/共有/保存/検索ボックスを全廃）。
 *
 * - 絞り込み手段は `VarietyFilter`（投稿画面と同じ TagPicker＝品種ドリルダウン＋検索＋自由タグ）だけ。
 * - 品種タグ（複数・AND）を選んだ／外した**その場で新着順に再取得**（検索ボタン無し＝ライブ）。
 *   未選択なら みんなの植物（#plantstr ∪ t:hanoba）を新着順で表示。
 * - URL は `?tags=` の deep-link（ブックマーク／戻る・進む）。意図的操作は pushState、復元は
 *   replaceState/無書き込み（popstate ループ防止）。`latestRef` で stale 応答を破棄。
 * - 正方形グリッド＋詳細モーダルは PostGrid（FeedGrid と共有）。relay/window 参照はクライアントのみ。
 */
// lang は discover.astro がページの locale を流す（#147）＝SSR の種（既定言語＝go-live で en）。
export default function DiscoverGrid({ lang = DEFAULT_LOCALE }: { lang?: Locale }) {
  // lang は SSR/初期描画の種（既定 en）。マウント後にクライアント解決値（ja を選んでいれば ja）へ loc を寄せる。
  // **表示文字列は必ず loc で組む**（lang は SSR の種でしかなく選択言語に追従しない・#399）。
  const [loc, setLoc] = useState<Locale>(lang);
  useEffect(() => {
    setLoc(resolveClientLocale());
  }, []);
  const t = useT(loc);
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  // #554: 「もっと見る」（現在の filter を保ったまま過去へ遡って追記）。hasMore は初期 true、新規増分0 で打ち止め。
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 直近の取得トークン。連続操作で古い応答が新しい結果を上書きしないよう、await 後に最新でなければ捨てる。
  const latestRef = useRef(0);

  // 直近に適用したタグ（#427）。popstate ハンドラは1回登録なので state の tags はクロージャで stale になる。
  // ref で最新の適用タグを保持し、popstate が「絞り込み変更」か「`?p=` モーダルの開閉だけ」かを判別する。
  const appliedTagsRef = useRef<string[]>([]);

  /**
   * 絞り込みタグを適用する（URL 反映＋取得）。意図的操作は navigate:"push"（戻るで前の絞り込みへ）、
   * 復元は "replace"、popstate は "none"（URL を書かない＝ループ防止）。
   */
  async function applyTags(next: string[], navigate: "push" | "replace" | "none") {
    const filter: DiscoverFilter = { ...EMPTY_FILTER, tags: next };
    if (navigate !== "none") {
      try {
        const url = new URL(window.location.href);
        applyFilterToParams(url.searchParams, filter);
        if (navigate === "push") window.history.pushState(null, "", url.toString());
        else window.history.replaceState(null, "", url.toString());
      } catch {
        // 履歴反映に失敗しても取得自体は通す（致命的でない）。
      }
    }
    setTags(next);
    appliedTagsRef.current = next; // popstate ガード（#427）の参照点を最新化する。

    const token = ++latestRef.current;
    setStatus("loading");
    setHasMore(true); // #554: filter 変更/復元/再試行で母集団をリセット＝もっと見るも初期化。
    try {
      // PWA 更新チェックが一段落するまで relay 取得を待つ（#551・agasteer 方式）。マウント直後の
      // 初回取得だけでなく絞り込み変更/popstate/再試行でも通るが、初回以降は解決済みで即時。
      await waitForSwCheck;
      const { posts: result } = await fetchDiscoverFiltered(filter);
      if (token !== latestRef.current) return; // 新しい操作が走っていたら古い応答は捨てる
      // 既定（みんなの植物）の空振りは空グリッドでなく idle 案内（温室）に戻す。
      if (isDefaultFilter(filter) && result.length === 0) {
        setStatus("idle");
        setPosts([]);
        return;
      }
      setPosts(result);
      setStatus("loaded");
    } catch {
      if (token !== latestRef.current) return;
      setStatus(isDefaultFilter(filter) ? "idle" : "error");
    }
  }

  // #554: 現在の filter を保ったまま、最古 createdAt を until にして次バッチを追記する。
  // client filter 後に件数が減るので、打ち止めは rawCount===0（until より厳密に古い生イベントが尽きた）
  // のときだけにする。品種フィルタで「今の窓は該当0だが古い所には該当あり」の barren window でも
  // 厳密に古い生>0ならボタンを残す（S2）。
  async function loadMore() {
    const oldest = posts[posts.length - 1]; // createdAt 降順＝末尾が最古。
    if (loadingMore || oldest === undefined) return;
    setLoadingMore(true);
    const until = oldest.createdAt;
    const filter: DiscoverFilter = { ...EMPTY_FILTER, tags };
    const token = latestRef.current; // 現在の取得世代。applyTags（filter 変更）が割り込んだら追記を捨てる。
    try {
      await waitForSwCheck;
      const { posts: batch, rawCount } = await fetchDiscoverFiltered(filter, DISCOVER_PAGE, until);
      if (token !== latestRef.current) return; // 新しい絞り込みが走っていたら古い応答は捨てる
      // #554（軽い保険版）: rawCount===0 のときだけ打ち止め。rawCount は until より厳密に古い
      // （created_at < until）生イベント数（境界＝再取得される最古イベント自身は数えない）。品種フィルタで
      // 増分0でも厳密に古い生>0なら barren window とみなしボタンを残す（S2）。厳密に古いのが尽きれば必ず 0 になる。
      if (rawCount === 0) setHasMore(false);
      setPosts((prev) => mergeAppendById(prev, batch));
    } catch {
      // 取得失敗はボタンを残して再試行可能にする。
    } finally {
      setLoadingMore(false);
    }
  }

  // マウント: URL の ?tags= を復元して自動取得（開いた瞬間に写真が並ぶ＝explore 流）。
  // "replace" で旧 ?q=/?tag= を正規化（URL を1回だけ書き換える）。popstate 復元は下の onPopState が
  // タグ差分を見て直接 applyTags(..., "none") する（#427）ので、ここはマウント専用にした。
  useEffect(() => {
    void applyTags(readTagsFromUrl(), "replace");
  }, []);

  // 戻る/進む（popstate）で URL から読み直して再取得（URL は書かない＝二重に積まない・ループしない）。
  // ただし**絞り込みタグが変わっていない popstate は再取得しない**（#427）。投稿モーダルの deep-link
  // `?p=`（#386）を閉じると `history.back()` が走り popstate が出るが、`?tags=` は不変なので再検索は
  // 不要。無条件に再取得すると `setStatus("loading")` でグリッドが一旦アンマウントされ、再取得後の
  // 再マウントでスクロールが先頭へ戻ってしまう。タグが実際に変わった popstate のときだけ取得する。
  useEffect(() => {
    const onPopState = () => {
      const urlTags = readTagsFromUrl();
      if (sameTagSet(urlTags, appliedTagsRef.current)) return; // `?p=` 開閉だけの popstate＝再検索しない
      void applyTags(urlTags, "none");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // #399: 表示用サマリは loc（クライアント解決の選択言語）で組む。lang（SSR の種＝既定 en）で組むと、
  // ja 表示でも既定スコープ名が「Everyone's Plants」と英語で漏れる（#147 go-live の DEFAULT→en で顕在化）。
  const summary = filterSummary({ ...EMPTY_FILTER, tags }, loc);

  return (
    <LocaleProvider value={loc}>
      <section className="flex flex-col gap-4">
        {/* 絞り込みは品種だけ（投稿画面と同じ TagPicker を流用）。選んだ瞬間に新着順で反映。 */}
        <VarietyFilter tags={tags} onChange={(next) => void applyTags(next, "push")} />

        {status === "loading" && (
          <p className="py-12 text-center text-ha-ink/60">{t("discover.loading", { summary })}</p>
        )}

        {status === "error" && (
          <div className="py-12 flex flex-col items-center gap-4 text-center">
            <p className="text-ha-ink/70">{t("feed.error.short")}</p>
            {/* 再試行は同条件の再取得＝URL を書かない（navigate:"none"・余分な履歴を積まない）。 */}
            <button
              type="button"
              onClick={() => void applyTags(tags, "none")}
              className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
            >
              {t("common.retry")}
            </button>
          </div>
        )}

        {status === "loaded" &&
          (posts.length === 0 ? (
            <p className="py-12 text-center text-ha-ink/70">{t("discover.empty", { summary })}</p>
          ) : (
            // 投稿のタグ/札をクリックしたら、**今のフィルタを置き換えてそのタグだけで絞り直す**
            // （AND で積み増すと結果がどんどん減るため・#272 kako-jun「毎回リセットでいい」）。意図的操作＝pushState。
            // 複数品種の AND は上の VarietyFilter で明示的に組む（そちらは add/remove の意図的操作）。
            <PostGrid posts={posts} onSelectHashtag={(tag) => void applyTags([tag], "push")} />
          ))}

        {/* #554: もっと見る（現在の絞り込みを保ったまま過去へ遡って追記）。取得済みがあるときだけ出す。 */}
        {status === "loaded" && posts.length > 0 && (
          <LoadMoreButton hasMore={hasMore} loading={loadingMore} onClick={() => void loadMore()} />
        )}
      </section>
    </LocaleProvider>
  );
}
