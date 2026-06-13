import { useEffect, useState } from "react";
import { fetchDiscoverByTag } from "../../lib/nostr/client.ts";
import { normalizeTag } from "../../lib/feed/discover.ts";
import type { FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";

type Status = "idle" | "loading" | "error" | "loaded";

/**
 * 現在の URL の ?tag= を読む（クライアントのみ）。SSR では呼ばない。
 */
function readTagFromUrl(): string {
  try {
    return new URLSearchParams(window.location.search).get("tag") ?? "";
  } catch {
    return "";
  }
}

/**
 * ?tag= を現在の URL に反映する（履歴は積まない＝ replaceState）。クライアントのみ。
 */
function writeTagToUrl(tag: string) {
  try {
    const url = new URL(window.location.href);
    if (tag === "") {
      url.searchParams.delete("tag");
    } else {
      url.searchParams.set("tag", tag);
    }
    window.history.replaceState(null, "", url.toString());
  } catch {
    // 履歴反映に失敗しても検索自体は通す（致命的でない）。
  }
}

/**
 * クロスクライアント discover の島（client:load・DESIGN §6 二段構え）。
 *
 * hanoba フィード（#4・FeedGrid・t:hanoba 限定）とは別物。本文 #タグで mypace 等
 * 他クライアントの植物投稿も集約する別ビュー。hanoba フィードには混ぜない。
 *
 * - タグ入力＋検索ボタン。初期タグは URL の ?tag= から（クライアントのみ）。
 * - 検索確定 → fetchDiscoverByTag(tag)（client.ts に集約・二段構え＋画像ありのみ）。
 *   URL も ?tag= に replaceState で反映する。
 * - 正方形グリッド ＋ 詳細モーダルは PostGrid に委譲（FeedGrid と共有）。
 *   PostDetail のタグクリックは discover では「そのタグで再検索」に繋ぐ。
 * - 状態: idle（未検索）/loading/error/loaded。各状態に文言。
 * - relay 取得・window/history 参照は useEffect/イベント内（クライアント）のみ。
 */
export default function DiscoverGrid() {
  // input は入力欄の現在値、query は検索を確定して取得に使ったタグ。
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [query, setQuery] = useState("");

  async function search(rawTag: string) {
    const tag = normalizeTag(rawTag);
    setInput(tag);
    setQuery(tag);
    writeTagToUrl(tag);
    if (tag === "") {
      setStatus("idle");
      setPosts([]);
      return;
    }
    setStatus("loading");
    try {
      const result = await fetchDiscoverByTag(tag);
      setPosts(result);
      setStatus("loaded");
    } catch {
      // fetchDiscoverByTag は基本フォールバックするが、念のため error 状態も持つ。
      setStatus("error");
    }
  }

  // マウント時に URL の ?tag= があれば初期検索する（クライアントのみ・1回だけ）。
  // search は安定参照ではないが、依存は意図的に空（初回マウントのみ実行）。
  useEffect(() => {
    const initial = readTagFromUrl();
    if (initial !== "") {
      void search(initial);
    }
  }, []);

  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    void search(input);
  }

  return (
    <section className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <span className="text-ha-green-deep font-semibold text-lg select-none">#</span>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="アガベ / パキポ / ビカクシダ …"
          aria-label="探したい植物のタグ"
          className="flex-1 rounded-2xl border border-ha-green/30 bg-ha-white px-4 py-2.5 text-ha-ink placeholder:text-ha-ink/40 focus:outline-none focus:border-ha-green"
        />
        <button
          type="submit"
          className="shrink-0 rounded-2xl bg-ha-green text-ha-white px-5 py-2.5 font-semibold hover:bg-ha-green-deep transition-colors"
        >
          探す
        </button>
      </form>

      {/* クロスクライアントの断り書き（常設・hanoba 断り書きとは別文面）。 */}
      <aside
        role="note"
        className="rounded-2xl bg-ha-green-soft text-ha-ink px-4 py-3 border border-ha-green/20"
      >
        <p className="text-sm leading-relaxed">
          これは Nostr 全体で <span className="font-semibold">#タグ</span>{" "}
          が付いた投稿の集約です。hanoba 以外のクライアントの投稿も含みます。
        </p>
      </aside>

      {status === "idle" && (
        <p className="py-12 text-center text-ha-ink/60">
          タグを入れて「探す」を押すと、みんなの植物が並びます。
        </p>
      )}

      {status === "loading" && (
        <p className="py-12 text-center text-ha-ink/60">「#{query}」を探しています…</p>
      )}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">読み込めませんでした。</p>
          <button
            type="button"
            onClick={() => void search(query)}
            className="rounded-2xl bg-ha-green text-ha-white px-5 py-2.5 font-semibold hover:bg-ha-green-deep transition-colors"
          >
            再試行
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <p className="py-12 text-center text-ha-ink/70">
            「#{query}」の投稿は見つかりませんでした。別のタグで試してみましょう。
          </p>
        ) : (
          <PostGrid posts={posts} onSelectHashtag={(tag) => void search(tag)} />
        ))}
    </section>
  );
}
