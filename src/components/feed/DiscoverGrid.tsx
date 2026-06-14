import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { fetchDiscover } from "../../lib/nostr/client.ts";
import type { FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";

type Status = "idle" | "loading" | "error" | "loaded";

/**
 * 現在の URL の検索語を読む（クライアントのみ）。SSR では呼ばない。
 * `?q=`（#24・タグ/キーワード両対応）を優先し、旧 `?tag=` リンクも後方互換で拾う。
 */
function readQueryFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") ?? params.get("tag") ?? "";
  } catch {
    return "";
  }
}

/**
 * 検索語を現在の URL に `?q=` で反映する（履歴は積まない＝ replaceState）。クライアントのみ。
 * 旧 `?tag=` は残さない（重複を避けて削除する）。
 */
function writeQueryToUrl(query: string) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("tag");
    if (query === "") {
      url.searchParams.delete("q");
    } else {
      url.searchParams.set("q", query);
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
  // input は入力欄の現在値、query は検索を確定して取得に使った語（タグ/キーワード）。
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [query, setQuery] = useState("");

  // 直近の検索リクエストのトークン。連続検索で古い応答が新しい結果を上書きしないよう、
  // await 後にトークンが最新でなければ反映を捨てる（stale-response レース対策）。
  const latestRef = useRef(0);

  // raw はタグ（`#アガベ`）でもキーワード（`葉焼け`）でもよい。モード分岐は fetchDiscover 側（#24）。
  async function search(raw: string) {
    const q = raw.trim();
    const token = ++latestRef.current;
    setInput(q);
    setQuery(q);
    writeQueryToUrl(q);
    if (q === "") {
      setStatus("idle");
      setPosts([]);
      return;
    }
    setStatus("loading");
    try {
      const result = await fetchDiscover(q);
      if (token !== latestRef.current) return; // 新しい検索が走っていたら古い応答は捨てる
      setPosts(result);
      setStatus("loaded");
    } catch {
      if (token !== latestRef.current) return;
      // fetchDiscover は基本フォールバックするが、念のため error 状態も持つ。
      setStatus("error");
    }
  }

  // マウント時に URL の ?q=（旧 ?tag=）があれば初期検索する（クライアントのみ・1回だけ）。
  // search は安定参照ではないが、依存は意図的に空（初回マウントのみ実行）。
  useEffect(() => {
    const initial = readQueryFromUrl();
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
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ha-green-deep/70">
            <Icon name="search" className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="#アガベ や 葉焼け で探す"
            aria-label="植物のタグ または 本文キーワード"
            className="w-full rounded-full border border-ha-green/25 bg-ha-white/80 pl-10 pr-4 py-2.5 text-ha-ink shadow-sm placeholder:text-ha-ink/40 focus:outline-none focus:border-ha-green focus:ring-2 focus:ring-ha-green/20"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ha-green text-ha-white px-5 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:bg-ha-green-deep hover:shadow-md transition-all"
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
          <span className="font-semibold">#タグ</span> でも{" "}
          <span className="font-semibold">本文のことば</span>{" "}
          でも探せます（Nostr 全体の集約・hanoba 以外のクライアントの投稿も含みます）。
        </p>
      </aside>

      {status === "idle" && (
        <div className="relative overflow-hidden rounded-3xl ring-1 ring-ha-green/15 shadow-sm">
          <img
            src="/og/greenhouse-hero.webp"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ha-base/90 via-ha-base/55 to-transparent"></div>
          <p className="relative px-6 py-16 sm:py-20 text-center font-display text-lg font-semibold text-ha-green-deep">
            #タグ や ことば を入れて「探す」を押すと、みんなの植物が並びます。
          </p>
        </div>
      )}

      {status === "loading" && (
        <p className="py-12 text-center text-ha-ink/60">「{query}」を探しています…</p>
      )}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">読み込めませんでした。</p>
          <button
            type="button"
            onClick={() => void search(query)}
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:bg-ha-green-deep hover:shadow-md transition-all"
          >
            再試行
          </button>
        </div>
      )}

      {status === "loaded" &&
        (posts.length === 0 ? (
          <p className="py-12 text-center text-ha-ink/70">
            「{query}」の投稿は見つかりませんでした。別のことばで試してみましょう。
          </p>
        ) : (
          // 投稿詳細でタグをクリックしたら、そのタグで（# 付き＝タグモードで）再検索する。
          <PostGrid posts={posts} onSelectHashtag={(tag) => void search(`#${tag}`)} />
        ))}
    </section>
  );
}
