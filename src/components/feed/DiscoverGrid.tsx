import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { fetchDiscover } from "../../lib/nostr/client.ts";
import type { FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";

type Status = "idle" | "loading" | "error" | "loaded";

// 初回（?q= 無し）に自動で流す既定検索。開いた瞬間から写真が並ぶようにする（Instagram の explore 流・#22）。
// Nostr の植物界隈で最も広く使われるタグ。結果ゼロのときだけ案内（温室）を出す。
const DEFAULT_DISCOVER_QUERY = "#plantstr";

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
  // fromDefault=true は初回の自動既定検索（入力欄・URL を汚さない・0件は idle に戻す）。
  async function search(raw: string, fromDefault = false) {
    const q = raw.trim();
    const token = ++latestRef.current;
    if (!fromDefault) {
      setInput(q);
      setQuery(q);
      writeQueryToUrl(q);
    } else {
      setQuery(q);
    }
    if (q === "") {
      setStatus("idle");
      setPosts([]);
      return;
    }
    setStatus("loading");
    try {
      const result = await fetchDiscover(q);
      if (token !== latestRef.current) return; // 新しい検索が走っていたら古い応答は捨てる
      // 既定検索が空振りなら、空グリッドでなく idle 案内（温室）に戻す。
      if (fromDefault && result.length === 0) {
        setStatus("idle");
        setPosts([]);
        return;
      }
      setPosts(result);
      setStatus("loaded");
    } catch {
      if (token !== latestRef.current) return;
      // fetchDiscover は基本フォールバックするが、念のため error 状態も持つ。
      // 既定検索の失敗は idle に戻す（エラー画面を出さない）。
      setStatus(fromDefault ? "idle" : "error");
    }
  }

  // マウント時: URL の ?q=（旧 ?tag=）があればそれを、無ければ既定検索を自動で流す
  // （開いた瞬間に写真が並ぶ＝Instagram explore 流・#22）。クライアントのみ・初回だけ。
  // search は安定参照ではないが、依存は意図的に空（初回マウントのみ実行）。
  useEffect(() => {
    const initial = readQueryFromUrl();
    if (initial !== "") {
      void search(initial);
    } else {
      void search(DEFAULT_DISCOVER_QUERY, true);
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
            className="glass w-full rounded-full pl-10 pr-4 py-2.5 text-ha-ink placeholder:text-ha-ink/45 focus:outline-none focus:border-ha-green/60 focus:ring-2 focus:ring-ha-green/30"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ha-green text-ha-white px-5 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
        >
          探す
        </button>
      </form>

      {/* クロスクライアントの断り書き（枠なしの控えめな注記）。 */}
      <p role="note" className="text-sm leading-relaxed text-ha-ink/60 [word-break:auto-phrase]">
        <span className="font-medium text-ha-ink/80">#タグ</span> でも{" "}
        <span className="font-medium text-ha-ink/80">本文のことば</span>{" "}
        でも探せます（Nostr 全体の集約・hanoba 以外のクライアントの投稿も含みます）。
      </p>

      {status === "idle" && (
        <div className="relative overflow-hidden rounded-2xl border border-white/10">
          <img
            src="/og/room-dark.webp"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/30"></div>
          <p className="relative px-6 py-16 sm:py-20 text-center font-display text-lg font-semibold text-ha-white">
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
            className="rounded-full bg-ha-green text-ha-white px-6 py-2.5 font-semibold shadow-sm shadow-ha-green/30 hover:brightness-110 hover:shadow-md transition-all"
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
