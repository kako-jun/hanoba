import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import { fetchDiscoverFiltered } from "../../lib/nostr/client.ts";
import { classifyDiscoverQuery } from "../../lib/feed/discover.ts";
import {
  EMPTY_FILTER,
  addTag,
  applyFilterToParams,
  filterSummary,
  isDefaultFilter,
  parseFilter,
  parseFilterFromString,
  serializeFilter,
  type DiscoverFilter,
} from "../../lib/feed/discoverFilter.ts";
import { type FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";
import SavedViews from "./SavedViews.tsx";
import DiscoverFilterPanel from "./DiscoverFilterPanel.tsx";
import ShareFilter from "./ShareFilter.tsx";

type Status = "idle" | "loading" | "error" | "loaded";

/**
 * 現在の URL から多軸フィルタを読む（クライアントのみ）。SSR では呼ばない。
 * 構造化（tags/author/q/since/until/sort）＋旧 `?q=`/`?tag=` を parseFilter が吸収する（#131/#139）。
 */
function readFilterFromUrl(): DiscoverFilter {
  try {
    return parseFilter(new URLSearchParams(window.location.search));
  } catch {
    return { ...EMPTY_FILTER };
  }
}

/**
 * クロスクライアント discover の島（client:load・DESIGN §6 二段構え）。
 *
 * トップ（#4・FeedGrid・t:hanoba 限定＝葉の場）とは住み分ける（#52）。既定表示（みんなの植物）は
 * **#plantstr（Nostr 全体の植物界隈）∪ t:hanoba（葉の場）** のマージ（取得は fetchDiscoverFiltered）。
 *
 * - **多軸フィルタ（#131 / #139 段階2）**: 「誰の × どの品種(タグ) × いつ × 並び」を同時指定できる。
 *   状態は単一の `filter`（DiscoverFilter）。検索ボックスは keyword 軸（#タグ/@名前/npub は classify で
 *   tags/author 軸へ振り分け）、構造化指定は折りたたみパネル（DiscoverFilterPanel）から。
 * - **URL は filter の deep-link**: 意図的操作（検索・パネル変更・タグクリック・ビュー切替）は
 *   `pushState`、復元（マウント/popstate）は `replaceState`/無書き込み（ループ防止）。filter は
 *   serializeFilter で canonical 文字列にして SavedViews（#139 段階3）へ渡す＝views.ts 無改変で多軸保存。
 * - 正方形グリッド＋詳細モーダルは PostGrid に委譲（FeedGrid と共有）。
 * - 状態: idle（既定で0件）/loading/error/loaded。relay 取得・window/history 参照はクライアントのみ。
 */
export default function DiscoverGrid() {
  // 検索ボックスの現在値（keyword 軸の鏡＝復元時に filter.keyword を映す）。
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [filter, setFilter] = useState<DiscoverFilter>(EMPTY_FILTER);

  // 直近の取得リクエストのトークン。連続操作で古い応答が新しい結果を上書きしないよう、
  // await 後にトークンが最新でなければ反映を捨てる（stale-response レース対策）。
  const latestRef = useRef(0);

  /**
   * 多軸フィルタを適用する（URL 反映＋取得）。意図的操作は navigate:"push"（戻るで前の絞り込みへ）、
   * 復元は "replace"（履歴を増やさず正規化）、popstate は "none"（URL を書かない＝ループ防止）。
   * - URL は applyFilterToParams で filter キーだけ書き換える（旧 ?tag= は削除・他パラメータは温存）。
   * - 取得は fetchDiscoverFiltered（既定＝#plantstr ∪ t:hanoba／制約軸ありはその AND）。
   * - 既定（空）で0件なら idle（温室案内）、それ以外は loaded（0件は「見つからない」文言）。
   */
  async function applyFilter(next: DiscoverFilter, navigate: "push" | "replace" | "none") {
    if (navigate !== "none") {
      try {
        const url = new URL(window.location.href);
        applyFilterToParams(url.searchParams, next);
        if (navigate === "push") window.history.pushState(null, "", url.toString());
        else window.history.replaceState(null, "", url.toString());
      } catch {
        // 履歴反映に失敗しても取得自体は通す（致命的でない）。
      }
    }
    setFilter(next);

    const token = ++latestRef.current;
    setStatus("loading");
    try {
      const result = await fetchDiscoverFiltered(next);
      if (token !== latestRef.current) return; // 新しい操作が走っていたら古い応答は捨てる
      // 既定（みんなの植物）の空振りは空グリッドでなく idle 案内（温室）に戻す。
      if (isDefaultFilter(next) && result.length === 0) {
        setStatus("idle");
        setPosts([]);
        return;
      }
      setPosts(result);
      setStatus("loaded");
    } catch {
      if (token !== latestRef.current) return;
      // 既定の失敗は idle に倒す（エラー画面を出さない）。絞り込み中の失敗は error。
      setStatus(isDefaultFilter(next) ? "idle" : "error");
    }
  }

  // URL から filter を復元する（マウント・popstate 共用）。マウントは "replace"（旧 ?tag= 等の正規化）、
  // popstate は "none"（URL を書き換えない＝二重に履歴を積まない・ループしない）。
  function restoreFromUrl(navigate: "replace" | "none") {
    const next = readFilterFromUrl();
    setInput(next.keyword); // 検索ボックスは keyword 軸の鏡
    void applyFilter(next, navigate);
  }

  // マウント時: URL の filter を復元して自動で取得する（開いた瞬間に写真が並ぶ＝explore 流・#22）。
  // クライアントのみ・初回だけ。依存は意図的に空。
  useEffect(() => {
    restoreFromUrl("replace");
  }, []);

  // 戻る/進む（popstate）で URL から filter を読み直して再取得する（#139 deep-link 復元）。
  // URL は書き換えない（"none"）。latestRef で最新応答だけ反映（stale 破棄を維持）。
  useEffect(() => {
    const onPopState = () => restoreFromUrl("none");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 名前付きビューのチップ tap でビューを適用する（#139 段階3）。意図的操作＝pushState。
  // ビューの query は serializeFilter の canonical 文字列（旧・単一クエリも parseFilterFromString が吸収）。
  // 「すべて」（空）は EMPTY_FILTER＝既定表示へ戻す。
  function applyView(query: string) {
    void applyFilter(parseFilterFromString(query), "push");
  }

  // 検索ボックス送信は keyword 軸への意図的指定＝pushState。#タグ/@名前/npub は classify で
  // tags/author 軸へ振り分け（パワーユーザー向け）、その場合はボックスを空にする（チップ/欄へ移った）。
  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = input.trim();
    if (raw === "") {
      setInput("");
      // keyword を消す。他軸も無く既定へ畳まれるなら replace（戻る対象にしない・#139）、
      // 他軸が残るなら状態変更として push。
      const next = { ...filter, keyword: "" };
      void applyFilter(next, isDefaultFilter(next) ? "replace" : "push");
      return;
    }
    const { mode, term } = classifyDiscoverQuery(raw);
    if (mode === "tag") {
      setInput("");
      void applyFilter({ ...filter, tags: addTag(filter.tags, term) }, "push");
    } else if (mode === "author") {
      setInput("");
      void applyFilter({ ...filter, author: term }, "push");
    } else if (mode === "author-name") {
      setInput("");
      void applyFilter({ ...filter, author: `@${term}` }, "push");
    } else {
      setInput(term);
      void applyFilter({ ...filter, keyword: term }, "push");
    }
  }

  // SavedViews / DilutionControl と揃えた、現在 filter の canonical 文字列（active 判定・保存キー）。
  const currentQuery = serializeFilter(filter);
  const summary = filterSummary(filter);

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ha-green-deep/70">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <ClearableInput
            type="text"
            value={input}
            onValueChange={setInput}
            placeholder="#アガベ・葉焼け・@ユーザー名 で探す"
            aria-label="植物のタグ・本文キーワード・@ユーザー名 または npub"
            clearLabel="検索文字を消す"
            className="glass rounded-full pl-10 py-2.5 text-ha-ink placeholder:text-ha-ink/45 focus:outline-none focus:border-ha-green/60 focus:ring-2 focus:ring-ha-green/30"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ha-green text-ha-white px-5 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
        >
          探す
        </button>
      </form>

      {/* 絞り込み（#131/#139）。絞り込み関係は全部この展開エリアに入れる（kako-jun 指示）:
          保存した絞り込み（名前付き・最上部）→ 各軸（品種/投稿者/期間/並び）→ 共有（最下部）。 */}
      <DiscoverFilterPanel
        filter={filter}
        onChange={(next) => void applyFilter(next, "push")}
        savedFilters={
          <SavedViews
            currentQuery={currentQuery}
            onApply={applyView}
            normalizeQuery={(q) => serializeFilter(parseFilterFromString(q))}
          />
        }
        share={<ShareFilter active={!isDefaultFilter(filter)} summary={summary} />}
      />

      {status === "loading" && (
        <p className="py-12 text-center text-ha-ink/60">「{summary}」を探しています…</p>
      )}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">読み込めませんでした。</p>
          {/* 再試行は同条件の再取得＝新規ナビゲーションではない。URL は既に現在 filter なので
              書き換えず（"none"）、戻る対象に余分な履歴エントリを積まない（#139）。 */}
          <button
            type="button"
            onClick={() => void applyFilter(filter, "none")}
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            再試行
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <p className="py-12 text-center text-ha-ink/70">
            「{summary}」の投稿は見つかりませんでした。別の条件で試してみましょう。
          </p>
        ) : (
          // 投稿詳細でタグをクリックしたら、そのタグに絞り込む（他軸はリセット・並びは維持＝
          // 「このタグを見る」ナビ。多軸の組み立ては絞り込みパネルの役割）。意図的操作＝pushState・#139。
          <PostGrid
            posts={posts}
            onSelectHashtag={(tag) =>
              void applyFilter({ ...EMPTY_FILTER, tags: addTag([], tag), sort: filter.sort }, "push")
            }
          />
        ))}
    </section>
  );
}
