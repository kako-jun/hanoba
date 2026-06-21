// フィード投稿のパース・整形の純粋関数（定義先行・テスト対象）。
// Nostr イベント → 表示用の FeedPost への変換と、id マージ・タグ絞り込み・相対時刻。
// relay 呼び出しはしない（取得は client.ts の責務）。

import { nip19 } from "nostr-tools";
import { extractHashtags } from "../nostr/tags.ts";
import type { NostrEvent } from "../nostr/types.ts";

/**
 * フィード表示用の投稿。Nostr イベントから parsePost で生成する。
 *
 * - id / pubkey / createdAt: イベント由来。
 * - caption: content から画像 URL を除いた「一言」。
 * - imageUrls: content の画像 URL（最大数は投稿側のUIで制限。読む側は全て拾う）。
 * - imageUrl: content の最初の画像 URL（無ければ null）。既存表示コードとの互換用。
 * - hashtags: 本文の #ハッシュタグ（クリックでクライアント側絞り込みに使う）。
 */
export interface FeedPost {
  id: string;
  pubkey: string;
  createdAt: number;
  caption: string;
  imageUrls: string[];
  imageUrl: string | null;
  hashtags: string[];
  /**
   * 撮影日の distinct 集合（#324・`YYYY-MM-DD`）。**活動の草の集計に使う**（どの日をカバーするか）。
   * 新 `shot_dates` 位置配列の非 null ∪ 旧 `shot_date` タグ。写真対応は持たない（それは photoShotDates）。
   */
  shotDates: string[];
  /**
   * 写真ごとの撮影日（#324・imageUrls と同順・無い写真は null）。新 `["shot_dates", …]` 由来。
   * **写真↔日付の対応を保つ**＝PostDetail の各写真キャプション・カードの撮影期間レンジに使う。
   * 旧形式（`shot_date` のみ）の投稿や撮影日無しは空配列（写真対応は出せない＝グレースフル）。
   * 型上は任意（既存テスト fixture 互換）だが parsePost は常に設定する。消費側は `?? []`。
   */
  photoShotDates?: Array<string | null>;
}

// content 中のインライン画像 URL（クエリ文字列付きも許容）。
// 拡張子: jpg/jpeg/png/gif/webp/avif。大小無視・グローバル。
// 貪欲（\S+）にして、二重拡張子（x.jpg.png 等）では最後の拡張子までを 1 URL として採る
// （非貪欲だと最初の拡張子で切れて壊れた src と caption のゴミになる）。
const IMAGE_URL_RE = /(https?:\/\/\S+\.(?:jpe?g|png|gif|webp|avif))(?:\?\S*)?/gi;

/**
 * Nostr イベント（kind:1）を表示用 FeedPost に変換する純粋関数。
 *
 * - content から画像 URL を抽出。複数あれば imageUrls に全て、imageUrl に先頭を入れる。
 * - caption: content から画像 URL（マッチ部分）を除去 → trim。連続改行は 1 つに畳む。
 * - hashtags: extractHashtags(content)（本文 # を t タグ化せず読み取りで拾う）。
 */
export function parsePost(event: NostrEvent): FeedPost {
  const content = event.content;

  // 画像 URL の全マッチを取る（matchAll はステートフルな lastIndex を持たない安全な呼び方）。
  const matches = [...content.matchAll(IMAGE_URL_RE)];
  const imageUrls = matches.map((match) => match[0]);
  const imageUrl = imageUrls.length > 0 ? imageUrls[0]! : null;

  // content から画像 URL を取り除く（replace は別途新しい RegExp で。グローバルフラグの lastIndex 汚染を避ける）。
  const withoutImages = content.replace(new RegExp(IMAGE_URL_RE.source, "gi"), "");

  // 空行（段落区切り）は残す。過剰な連続改行（3つ以上）だけ空行1つ（\n\n）に抑え、前後を trim。
  const caption = withoutImages.replace(/\n{3,}/g, "\n\n").trim();

  // 撮影日（#324）。
  // 新形式: 1本の位置配列タグ `["shot_dates", d0, d1, …]`（imageUrls 順・無い位置は ""）＝写真↔日付を保つ。
  const perPhotoTag = event.tags.find((t) => t[0] === "shot_dates");
  const photoShotDates: Array<string | null> = imageUrls.map((_url, i) => {
    const v = perPhotoTag?.[i + 1];
    return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  });
  // 旧形式（後方互換）: `["shot_date", date]`（投稿単位・写真対応なし）。
  const legacyDates = event.tags
    .filter((t) => t[0] === "shot_date" && typeof t[1] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t[1]))
    .map((t) => t[1]!);
  // 活動の草用の distinct 集合 = per-photo の非 null ∪ 旧 shot_date。
  const shotDates = [
    ...new Set([...photoShotDates.filter((d): d is string => d !== null), ...legacyDates]),
  ];

  return {
    id: event.id,
    pubkey: event.pubkey,
    createdAt: event.created_at,
    caption,
    imageUrls,
    imageUrl,
    hashtags: extractHashtags(content),
    shotDates,
    photoShotDates,
  };
}

/**
 * 複数のリスト（リレーごと等）を id で重複除去し、createdAt 降順に並べる。
 * 同じ id は最初に出会ったものを採用する。
 */
export function mergePostsById(...lists: FeedPost[][]): FeedPost[] {
  const byId = new Map<string, FeedPost>();
  for (const list of lists) {
    for (const post of list) {
      if (!byId.has(post.id)) {
        byId.set(post.id, post);
      }
    }
  }
  return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * hashtags に指定タグを含む投稿だけを返す（大小無視）。
 * クライアント側のタグ絞り込みに使う（取得済みの hanoba 投稿に対してのみ適用）。
 */
export function filterByHashtag(posts: FeedPost[], tag: string): FeedPost[] {
  const needle = tag.toLowerCase();
  return posts.filter((post) => post.hashtags.some((h) => h.toLowerCase() === needle));
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * createdAt（秒）と now（秒）から「3分前」等の相対時刻を整形する純粋関数。
 *
 * - 1 分未満: 「たった今」
 * - 1 時間未満: 「N分前」
 * - 1 日未満: 「N時間前」
 * - それ以上: 「N日前」
 * 未来（now < createdAt）は「たった今」に丸める。
 */
export function relativeTime(createdAt: number, now: number): string {
  const diff = Math.floor(now - createdAt);
  if (diff < MINUTE) return "たった今";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
  return `${Math.floor(diff / DAY)}日前`;
}

/**
 * 著者プロフィール（kind:0 の content JSON）。#35。
 * - name: 表示名（name → display_name の順で拾う）。
 * - picture: アバター画像 URL。
 * - about: 自己紹介。
 * - websites: 複数サイト URL（mypace 拡張 `websites:[{url}]` ＋ 標準 `website`）。
 *   モーダルのサイトリンク（#35 Piece 2）に使う。
 */
export interface Profile {
  name: string | null;
  picture: string | null;
  about: string | null;
  websites: string[];
  /** 好きな品種（#141・kind:0 カスタム `favorite_varieties`）。同好の士の手がかり。 */
  favoriteVarieties: string[];
}

/** kind:0 content（JSON）を Profile に変換する純粋関数。JSON 不正は空 Profile。 */
export function parseProfile(content: string): Profile {
  const empty: Profile = { name: null, picture: null, about: null, websites: [], favoriteVarieties: [] };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return empty;
  }
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : null;

  const name = str(data.name) ?? str(data.display_name);
  const websites: string[] = [];
  // kind:0 は他人が自由に書ける入力なので、サイトリンクは http(s) の絶対 URL だけ通す。
  // javascript:/data:/相対 URL 等を弾く（モーダルで href に出すため・#77 セキュリティ）。
  const push = (u: string | null) => {
    if (u === null || websites.includes(u)) return;
    let ok = false;
    try {
      const proto = new URL(u).protocol;
      ok = proto === "http:" || proto === "https:";
    } catch {
      ok = false;
    }
    if (ok) websites.push(u);
  };
  // mypace 拡張: websites は {url,label?} の配列（label は表示時に再判定するので無視）。
  if (Array.isArray(data.websites)) {
    for (const w of data.websites) {
      if (typeof w === "string") push(str(w));
      else if (w !== null && typeof w === "object") push(str((w as { url?: unknown }).url));
    }
  }
  // 標準フィールド website（単一 URL）も拾う（他クライアント互換）。
  push(str(data.website));

  // 好きな品種（#141・hanoba 独自 `favorite_varieties`＝文字列配列）。空/非文字列を除き dedupe。
  const favoriteVarieties: string[] = [];
  if (Array.isArray(data.favorite_varieties)) {
    for (const v of data.favorite_varieties) {
      const s = str(v);
      if (s !== null && !favoriteVarieties.includes(s)) favoriteVarieties.push(s);
    }
  }

  return { name, picture: str(data.picture), about: str(data.about), websites, favoriteVarieties };
}

/**
 * プロフィール（kind:0）の content から表示名だけを取り出す（#28・nsec インポート時）。
 * name → display_name の順。無ければ null。
 */
export function parseProfileName(content: string): string | null {
  return parseProfile(content).name;
}

/**
 * pubkey（hex）を短い npub 表示にする（npub1abc…wxyz）。#35。
 * プロフィール名が取れないときのフォールバック表示に使う。nip19 は純粋。
 */
export function shortNpub(pubkey: string): string {
  let npub: string;
  try {
    npub = nip19.npubEncode(pubkey);
  } catch {
    npub = pubkey; // 万一失敗しても表示を壊さない
  }
  if (npub.length <= 16) return npub;
  return `${npub.slice(0, 10)}…${npub.slice(-4)}`;
}

/**
 * 著者の公開プロフィールページ（`/u?npub=…`）への相対パス（#272 段階3）。
 * hanoba は静的サイト（output:static）で動的ルート `/u/[npub]` を持てないので、
 * discover の `?tags=` と同型のクエリ方式で npub を渡す（#291 で SW がクエリ付き
 * deep-link をホームにすり替える罠は workbox の ignoreURLParametersMatching で解消済み）。
 * pubkey が空 / npub にエンコードできない時は null＝リンクを出さない（フォールバックで素の名前）。
 * nip19 は純粋（relay に触れない）。
 */
export function authorHref(pubkey: string): string | null {
  if (pubkey === "") return null;
  try {
    return `/u?npub=${nip19.npubEncode(pubkey)}`;
  } catch {
    return null;
  }
}
