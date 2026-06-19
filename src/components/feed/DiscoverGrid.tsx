import { useEffect, useRef, useState } from "react";
import { fetchDiscoverFiltered } from "../../lib/nostr/client.ts";
import {
  EMPTY_FILTER,
  applyFilterToParams,
  filterSummary,
  isDefaultFilter,
  parseFilter,
  type DiscoverFilter,
} from "../../lib/feed/discoverFilter.ts";
import { type FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";
import VarietyFilter from "./VarietyFilter.tsx";

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
export default function DiscoverGrid() {
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [posts, setPosts] = useState<FeedPost[]>([]);

  // 直近の取得トークン。連続操作で古い応答が新しい結果を上書きしないよう、await 後に最新でなければ捨てる。
  const latestRef = useRef(0);

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

    const token = ++latestRef.current;
    setStatus("loading");
    try {
      const result = await fetchDiscoverFiltered(filter);
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

  // URL から復元（マウント・popstate 共用）。マウントは "replace"（旧 ?q=/?tag= の正規化）、popstate は "none"。
  function restoreFromUrl(navigate: "replace" | "none") {
    void applyTags(readTagsFromUrl(), navigate);
  }

  // マウント: URL の ?tags= を復元して自動取得（開いた瞬間に写真が並ぶ＝explore 流）。
  useEffect(() => {
    restoreFromUrl("replace");
  }, []);

  // 戻る/進む（popstate）で URL から読み直して再取得（URL は書かない＝二重に積まない・ループしない）。
  useEffect(() => {
    const onPopState = () => restoreFromUrl("none");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const summary = filterSummary({ ...EMPTY_FILTER, tags });

  return (
    <section className="flex flex-col gap-4">
      {/* 絞り込みは品種だけ（投稿画面と同じ TagPicker を流用）。選んだ瞬間に新着順で反映。 */}
      <VarietyFilter tags={tags} onChange={(next) => void applyTags(next, "push")} />

      {status === "loading" && (
        <p className="py-12 text-center text-ha-ink/60">「{summary}」を探しています…</p>
      )}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">読み込めませんでした。</p>
          {/* 再試行は同条件の再取得＝URL を書かない（navigate:"none"・余分な履歴を積まない）。 */}
          <button
            type="button"
            onClick={() => void applyTags(tags, "none")}
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
          >
            再試行
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <p className="py-12 text-center text-ha-ink/70">
            「{summary}」の投稿は見つかりませんでした。別の品種で試してみましょう。
          </p>
        ) : (
          // 投稿のタグ/札をクリックしたら、**今のフィルタを置き換えてそのタグだけで絞り直す**
          // （AND で積み増すと結果がどんどん減るため・#272 kako-jun「毎回リセットでいい」）。意図的操作＝pushState。
          // 複数品種の AND は上の VarietyFilter で明示的に組む（そちらは add/remove の意図的操作）。
          <PostGrid posts={posts} onSelectHashtag={(tag) => void applyTags([tag], "push")} />
        ))}
    </section>
  );
}
