import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon.tsx";
import { ClearableInput } from "../ui/ClearableInput.tsx";
import { fetchDiscover, fetchHanobaFeed } from "../../lib/nostr/client.ts";
import { mergePostsById, type FeedPost } from "../../lib/feed/parse.ts";
import PostGrid from "./PostGrid.tsx";
import SavedViews from "./SavedViews.tsx";

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
 * 検索語を現在の URL に `?q=` で反映する（クライアントのみ）。
 * 旧 `?tag=` は残さない（重複を避けて削除する）。
 *
 * - `mode==="push"`: 意図的な検索（フォーム送信・タグ再検索・再試行）。新しい履歴エントリを積み、
 *   ブラウザの戻るで「前の検索語」へ戻れるようにする（#139 deep-link）。
 * - `mode==="replace"`: 復元・正規化（初回マウントの `?tag=`→`?q=` 正規化、クリアでの `?q=` 削除）。
 *   履歴を増やさない。
 *
 * 注意: pushState/replaceState はどちらも popstate を発火しないので、popstate 経路から
 * これを呼ばない限りループしない（popstate 復元は navigate:"none" で URL を書かない）。
 */
function writeQueryToUrl(query: string, mode: "push" | "replace") {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("tag");
    if (query === "") {
      url.searchParams.delete("q");
    } else {
      url.searchParams.set("q", query);
    }
    if (mode === "push") {
      window.history.pushState(null, "", url.toString());
    } else {
      window.history.replaceState(null, "", url.toString());
    }
  } catch {
    // 履歴反映に失敗しても検索自体は通す（致命的でない）。
  }
}

/**
 * クロスクライアント discover の島（client:load・DESIGN §6 二段構え）。
 *
 * トップ（#4・FeedGrid・t:hanoba 限定＝葉の場）とは住み分ける（#52）。
 * 既定表示（みんなの植物）は **#plantstr（Nostr 全体の植物界隈）∪ t:hanoba（葉の場）**
 * のマージ。hanoba 投稿は #plantstr を強制せずとも t:hanoba 経由で「みんな」に出る。
 * 個別検索は本文 #タグ/キーワードで他クライアント横断（混ぜ込みは既定表示のみ）。
 *
 * - 検索入力＋ボタン。初期語は URL の `?q=`（旧 `?tag=` は後方互換で読む）から（クライアントのみ）。
 * - 検索確定 → fetchDiscover（client.ts に集約・二段構え＋画像ありのみ）。
 * - **URL は `?q=` の deep-link（#139 段階1）**: 意図的な検索（フォーム送信・タグ再検索）は
 *   `pushState` で履歴に積み、戻る/進む（`popstate`）で `?q=` を読み直して復元する（popstate 経路は
 *   URL を書かない＝ループ防止）。初回マウントの `?tag=`→`?q=` 正規化・空クリア・error 再試行は
 *   `replaceState`/無書き込みで履歴を汚さない。
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

  // 現在 URL の `?q=` が持つ値の鏡（名前付きビューの active 判定用・#139 段階3）。
  // 既定検索（fromDefault・?q= 無し）は空文字＝「すべて」がアクティブ。ユーザー検索はその語。
  // query と別に持つのは、既定検索では query に DEFAULT_DISCOVER_QUERY(#plantstr) が入り
  // ?q= の実値（空）と食い違うため。SavedViews へはこの鏡を渡す（?q= と一致＝二重情報源を作らない）。
  const [reflectedQuery, setReflectedQuery] = useState("");

  // 直近の検索リクエストのトークン。連続検索で古い応答が新しい結果を上書きしないよう、
  // await 後にトークンが最新でなければ反映を捨てる（stale-response レース対策）。
  const latestRef = useRef(0);

  // raw はタグ（`#アガベ`）でもキーワード（`葉焼け`）でもよい。モード分岐は fetchDiscover 側（#24）。
  //
  // オプション:
  // - fromDefault=true: 初回の自動既定検索（#22）。入力欄・URL を汚さない・0件は idle に戻す。
  // - navigate: URL 反映の仕方。"push"=履歴を積む（意図的検索・戻るで前の語へ）、
  //   "replace"=履歴を増やさず正規化/クリア、"none"=URL を一切書かない（復元系＝マウント/popstate）。
  //   既定は "push"（フォーム送信など意図的検索のため）。fromDefault は navigate を無視して URL を書かない。
  async function search(
    raw: string,
    opts: { fromDefault?: boolean; navigate?: "push" | "replace" | "none" } = {},
  ) {
    const { fromDefault = false, navigate = "push" } = opts;
    const q = raw.trim();
    const token = ++latestRef.current;
    if (!fromDefault) {
      setInput(q);
      setQuery(q);
      setReflectedQuery(q); // ?q= に乗る実値（空クリアも空＝「すべて」へ）
      // 空クリア（idle 化）は履歴を積まず replace で ?q= を消す（戻る対象にしない・#139）。
      if (navigate !== "none") writeQueryToUrl(q, q === "" ? "replace" : navigate);
    } else {
      setQuery(q);
      setReflectedQuery(""); // 既定検索は ?q= 無し＝「すべて」がアクティブ
    }
    if (q === "") {
      setStatus("idle");
      setPosts([]);
      return;
    }
    setStatus("loading");
    try {
      // 既定表示（みんなの植物）＝ #plantstr（Nostr 全体の植物界隈）∪ t:hanoba（葉の場）の
      // マージ（#52）。hanoba は #plantstr を強制しないが、t:hanoba 経由で自分の投稿も
      // 「みんな」に必ず出るようにする。個別検索（fromDefault=false）は横断検索のみ。
      const result = fromDefault
        ? mergePostsById(
            ...(await Promise.all([fetchDiscover(q).catch(() => []), fetchHanobaFeed().catch(() => [])])),
          )
        : await fetchDiscover(q);
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

  // URL の `?q=`（旧 `?tag=`）から検索状態を復元する（マウント・popstate 共用の単一ロジック）。
  // URL は書き換えない方針だが、引数 navigate で「マウント時の正規化（?tag=→?q= の replace）」と
  // 「popstate での無書き込み（none）」を切り替える。
  // - q あり: その語で検索（入力欄も同期される＝search の非 fromDefault 経路）。
  // - q 無し: 既定検索（#plantstr ∪ t:hanoba）に戻す。これは初回マウントの「q 無し」分岐と同一。
  function restoreFromUrl(navigate: "replace" | "none") {
    const initial = readQueryFromUrl();
    if (initial !== "") {
      void search(initial, { navigate });
    } else {
      // q 無しの URL（既定検索）に戻ったら入力欄もクリアして URL と一致させる。
      // 初回マウントは元から空だが、popstate で「検索済み → 既定」へ戻る場合は
      // 直前の検索語が input に残ってしまうため、ここで明示的に空へ戻す（#139）。
      setInput("");
      void search(DEFAULT_DISCOVER_QUERY, { fromDefault: true });
    }
  }

  // マウント時: URL の ?q=（旧 ?tag=）があればそれを、無ければ既定検索を自動で流す
  // （開いた瞬間に写真が並ぶ＝Instagram explore 流・#22）。クライアントのみ・初回だけ。
  // ?tag= で来たら ?q= に正規化（replace＝履歴は増やさない）。q 無し（既定検索）は URL を書かない。
  // search/restoreFromUrl は安定参照ではないが、依存は意図的に空（初回マウントのみ実行）。
  useEffect(() => {
    restoreFromUrl("replace");
  }, []);

  // 戻る/進む（popstate）で URL の ?q= を読み直して再検索する（#139 deep-link 復元）。
  // URL は一切書き換えない（navigate:"none"）＝履歴を二重に積まない・ループしない。
  // 連続した戻る/進むでも latestRef により最新応答だけが反映される（stale-response 破棄を維持）。
  useEffect(() => {
    const onPopState = () => restoreFromUrl("none");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 名前付きビューのチップ tap でビューを適用する（#139 段階3）。意図的操作＝履歴を積む
  // （pushState・戻るで前のビュー/検索へ戻れる）＝既存の `?q=` 反映経路にそのまま乗せる。
  // - 「すべて」（query 空）: 既定検索（#plantstr ∪ t:hanoba）に戻す。?q= を push で消し（戻る対象）、
  //   入力欄も空に同期してから既定検索を流す（q 無しの URL ＝既定表示 と URL/状態を一致させる）。
  //   ※ 既存の空クリアは replace（戻る対象にしない）だが、ビュー切替は意図的ナビなので push にする。
  // - 保存ビュー（query 非空）: その query で search（input/?q= も同期＝search の非 fromDefault 経路）。
  function applyView(query: string) {
    const q = query.trim();
    if (q === "") {
      writeQueryToUrl("", "push");
      setInput("");
      void search(DEFAULT_DISCOVER_QUERY, { fromDefault: true });
    } else {
      void search(q, { navigate: "push" });
    }
  }

  // フォーム送信は意図的な検索＝履歴を積む（戻るで前の検索語に戻れる）。
  function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    void search(input, { navigate: "push" });
  }

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

      {/* 名前付きビュー（#139 段階3）。「すべて」＋ 保存した自分専用チャンネルをチップで切替する。
          active 判定は現在 ?q= の鏡（reflectedQuery）と一致するビュー。切替は既存 ?q= 反映経路（applyView）に乗る。 */}
      <SavedViews currentQuery={reflectedQuery} onApply={applyView} />

      {/* idle（初期/クリア後/既定検索が空）は何も出さない。マウント時に既定検索を自動で流すので
          「探すを押すと…」の案内は不要・矛盾するため撤去（#102）。検索の説明は placeholder に一本化。 */}

      {status === "loading" && (
        <p className="py-12 text-center text-ha-ink/60">「{query}」を探しています…</p>
      )}

      {status === "error" && (
        <div className="py-12 flex flex-col items-center gap-4 text-center">
          <p className="text-ha-ink/70">読み込めませんでした。</p>
          {/* 再試行は同じ語の再取得＝新規ナビゲーションではない。URL は既に ?q=query なので
              書き換えず（navigate:"none"）、戻る対象に同語の余分な履歴エントリを積まない（#139）。 */}
          <button
            type="button"
            onClick={() => void search(query, { navigate: "none" })}
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
          // 意図的な検索＝履歴を積む（戻るで元の検索語へ・#139）。
          <PostGrid posts={posts} onSelectHashtag={(tag) => void search(`#${tag}`, { navigate: "push" })} />
        ))}
    </section>
  );
}
