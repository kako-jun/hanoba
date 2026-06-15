# Hanoba — DESIGN

> 植物写真の SNS。1投稿 ＝ 正方形写真1枚 ＋ ひとこと（必須）。**「育てて、見せる。」**
> **mypace（Nostr）のスキン**であり、自前のバックエンドを持たない。

Instagram より早く・かんたんに、文章を添えて植物を見せる場。世界観は**暗くシックな大人のコレクター部屋**（§5.0）。畑・ビカクシダ・種まき・パキポ・アガベの自慢と、実験の逐次メモを兼ねる。長期目標は **架空の植物好き都市ハノーバ(Hanoba)をみんなで作る**こと。

---

## 1. 原則（規律）

1. **正方形固定** — 投稿画像は正方形に矯正。クロップはドラッグで位置決め。
2. **一言必須** — 写真だけの投稿を許さない。`content` 空は弾く。これが心臓部。
3. **動画非対応** — 身バレ（背景の映り込み・環境音・反射・複数フレーム）回避。静止画のみ。
4. **植物だけ** — テーマは固いが、その枠内は何でも OK（自慢・実験メモ）。

## 2. アーキテクチャ

- **自前バックエンドなし。** 状態は全部 Nostr に乗る。投稿は **mypace 経由でなく共有 Nostr 空間へ直接**行う。「mypace のスキン」の実体は **同じ Nostr タグ規約を使うこと**。
  - 補足（#28・実装確認）: mypace 自体は Workers＋D1 の API を持つが、**Hanoba はそれを使わない**。投稿（kind:1）・削除（kind:5）・プロフィール（kind:0）・画像アップロード/削除（nostr.build NIP-96）は**全てクライアント側**で完結し、バックエンド不要を維持する。
- **アカウント（#28）**: nsec はブラウザ生成・localStorage 保存（`getOrCreateSecretKey`）。**ユーザー名（kind:0）を入れたら投稿できる**（見るだけ→参加）。**既存ユーザーは nsec を持ち込める**（`AccountName` の「すでにアカウントをお持ちですか？」→ `importNsec` → 既存 kind:0 全体（名前＋picture/about/websites）を `fetchMyProfileResilient` で引き継いで控えにシードし reload）。取得は bounded retry で行う（単発だと接続直後に websites を載せた版を取りこぼし、控えに `websites:[]` を焼いてしまう＝#93）。mypace 等のユーザーがアカウントを無駄に増やさない。鍵は端末（localStorage）にのみ保存。
- **削除＝写真と一蓮托生（#28）**: 投稿削除は ①NIP-09 `kind:5` を publish（mypace/Nostr 上で不可視化）＋②**nostr.build の画像を本人の鍵で NIP-96 削除**（`DELETE /api/v2/nip96/upload/<sha256>`・NIP-98 認証）。「自分の植物」`/me` から行う。D1 を持つ mypace と同じ"消せる一芸"を backendless で再現（画像 URL は投稿本文に内包されるので upload 履歴 DB も不要）。鍵を失うと過去投稿は消せない＝鍵の重要性に注意。
- **フロントエンドのみ**: Astro（静的生成）＋ React islands ＋ **PWA**（`@vite-pwa/astro`）。**Cloudflare Pages** にデプロイ（Workers も D1 も不要）。
- クライアントが自分で行う:
  - **鍵** — ブラウザ生成・localStorage 保存・署名（NIP-07 拡張も可）。
  - **画像アップロード** — nostr.build へ直接（NIP-98 認証）。**EXIF はサーバ側で自動削除**（身バレ＝自宅 GPS 漏れ対策が無料で効く）。維持費ほぼゼロ。
  - **投稿・購読** — Nostr リレーへ直接 publish / subscribe。
- **mypace から見える鍵＝タグ**: 投稿に `['t','mypace']` を必ず付ける（mypace タイムライン出現の条件）。詳細は §6。
- **mypace の記録 API への ping は後回し（任意・優先度低）**: ping すれば mypace の通知・スコア（ステラ/通し番号）系にも乗るが、無くても `t:mypace` だけで mypace タイムラインには出る。必要になったら将来。
- **断り書きを常設**: 「Nostr フィードを表示しているだけ・二重投稿でもコピーでもない・mypace でも見られます」。
- → mypace の正式リリースを待たず独立公開可。むしろ hanoba が mypace を賑わす燃料になる。

## 3. 実装方針

- 既存実績のある **Astro ＋ React islands ＋ PWA（`@vite-pwa/astro`）＋ Cloudflare Pages ＋ Tailwind** 構成を骨格として踏襲する（独自バックエンド／DB 層は持たない）。
- **mypace の既存コンポーザー（アップロード／クロップ／レトロ加工）を流用**する。React 同士なので島として移植する。
  - クロップ → **正方形ロック＋ドラッグで位置決め**に変更。
  - レトロ加工 → 現状のランダム適用を**選択式**に変更（＝写真そのものへの擬似加工。テキスト→画像生成とは別物）。
- **一言の `#` ハッシュタグ補完**: 入力中の `#` を**過去に使われたタグから補完**し、同じ植物のタグへ投稿が自然に集積する（emergent taxonomy＝固定の分類表を持たずタグが育つ）。補完候補の源はリレー上の過去 `t` タグ。よく使う種は Wikipedia 由来で seed 可、細かい品種名（cultivar）は Wikipedia に無いので freeform `#`（過去使用のみで補完。エンティティ紐付け `@@` の UX を似せるだけ）。既存のメンション補完 UI を流用。
- 設計のトーンは mypace に揃える（スキンであるため）。

## 4. 主要画面

- **投稿**: 撮影/選択 → 正方形クロップ（ドラッグ）→ レトロ加工（選択式）→ 一言（必須）→ 投稿
  - **撮影とアルバムはボタンを分ける（#29）**。単一 input に `capture="environment"` を付けるとスマホでカメラ直起動が優先されアルバムから選べなくなるため、`capture` 付き input（撮影）と `capture` 無し input（アルバム）を別ボタンで持つ。
- **フィード（読めるフィード・#34/#50）**: hanoba の売り＝**本文を切らず読め、1クリックも要らない**（vs Instagram）。縦並びカード（PostCard）。sm 以上＝写真左／本文中／タグ右の縦列、モバイル＝写真上／本文／タグ下。**本文テキストからは #タグ を除き**（stripHashtags）タグは右列に出す。**デスクトップはカード高さを写真の正方形（sm:h-56）に固定**し、本文・タグをその中に収める（はみ出しは clip）＝写真の下に隙間を作らない。本文かタグが clip された時だけ**「続きを読む」**（フェードは使わない）でカード全体を展開し全文＋全タグを表示。タグが多くても**1列のまま下を見切る**（2列に折り返さない・#54）。**カードの非インタラクティブ領域はどこを押しても拡大**（PostDetail モーダル・写真/リンク/タグ/「続きを読む」は個別動作を維持＝stopPropagation・写真ボタンはキーボード/SR の主導線として残す・#101）。**読み込み中はカード形のガラス pulse スケルトン**（FeedSkeleton・素っ気ない「読み込み中…」を置き換え・#99）。カード（写真）の角丸は控えめ（rounded-xl・#100）。**大画面（lg）はカード幅を広げ（max-w-5xl）、余白は主に写真を大きく**（写真 224→288px・#56）。植物タグで絞る。
- **トップ と みんなの植物 の住み分け（#52）**: **トップ**＝`t:hanoba` のみ（葉の場＝ローカル）。**みんなの植物（discover）既定表示**＝`#plantstr`（Nostr 全体の植物界隈）∪ `t:hanoba` の**マージ**（id 重複除去・時系列）。hanoba は `#plantstr` を強制しないが、`t:hanoba` 経由で自分の投稿も「みんな」に出る（「投稿したのに見えない」混乱の解消）。個別検索（`?q=`）は §6 の横断検索のみ。各画面に1行の住み分け説明を置く。
- **著者ヘッダ（#35・#103）**: 各カードの時刻付近に**アイコン＋ユーザー名**（kind:0 の picture/name・未取得は npub 短縮にフォールバック）。プロフィールは `fetchProfiles`（一括・`useProfiles` でキャッシュ）。`useProfiles` は **bounded retry**（最大3回・700ms間隔・取りこぼした著者だけ引き直す）で取得し、予算を使い切るまで空 Profile を恒久キャッシュしない（単発取得だと接続直後の取りこぼしを EMPTY で焼いて名前/アイコンが永久に出ず npub 生表示で固定される＝#103 デグレ。#93 の `fetchMyProfileResilient` と同じ思想を著者ヘッダ経路にも適用）。拡大モーダルにも同じ著者表示を出し、**複数サイトリンク**（kind:0 拡張 `websites[]`）はモーダル側にアイコン列で載せる（Piece 2・各人が自分のサイトへ誘導する核）。フィードカードにはリンクを出さない。サービス判定は `src/lib/profile/services.ts`（`detectServiceLabel` で URL→サービス名、`serviceIconName` で統一アイコンに対応付け、`toSiteLinks` で表示用に整形）。ブランドロゴの寄せ集めにせず意味カテゴリの統一線アイコンに寄せる（#21・X だけは普及済みで識別性が高いので専用）。各リンクは新規タブ＋`rel="noopener noreferrer"`、`title`/`aria-label` に検出ラベルを入れ識別性を担保。
- **プロフィール編集（#35 Piece3・#104）**: `/me` では **アカウント（ハンドルネーム＋変更/アカウント変更）と `ProfileEditor` を1枚のプロフィールカードに統合**する（`AccountName bare` ＋ `ProfileEditor bare` を MyGrid が1つの glass カードに内包）。ハンドルネーム変更がプロフィール内に収まり、操作ボタンは名前の下段に縦並び（モバイルで窮屈・はみ出さない）。`ProfileEditor` で**アイコン（nostr.build アップロード／URL貼付／削除）・自己紹介・複数サイト（追加/削除/並べ替え）**を編集。これで hanoba ネイティブ利用者の投稿にも著者ヘッダ（アバター/リンク）が付く。**kind:0 は replaceable** なので保存は name＋picture＋about＋websites の**全体**を publish する（`client.saveProfile`・部分更新で他項目を消さない。名前だけ変える `saveDisplayName` も付加項目をマージして載せ直す）。初期値はローカル控え（`getProfileExtra`）＋ relay の自分の kind:0（`fetchMyProfileResilient`・bounded retry）で空欄補完し、他デバイス設定も引き継ぐ。relay から非空を掴めたら**ローカル控えにも書き戻す**（表示だけ回復して控えが空のまま残ると、名前変更時の `saveDisplayName` が `websites:[]` で relay の正本を潰す＝#93 の clobber を防ぐ。`mergeProfileExtra` はローカル非空を優先）。名前は AccountName 側で設定（未設定なら保存を促す）。
- **投稿詳細（拡大モーダル）**: 写真は**元の比率のまま**見せる（クロップしない・他者著作の改変回避 #61）。hanoba 自前投稿は 1:1 出力なので正方形に、他クライアントの非正方形はその比率で表示。flex 列の中で `flex-shrink` に潰されて横長化しないよう写真枠に **`shrink-0`** を付け、自然な高さを確保する（#108）＋著者（アイコン＋名前＋サイトリンク）＋一言＋認識植物＋反応。**本文は #タグ を除いて表示**（`stripHashtags`・タグはチップに出すのでフィードカードと挙動を揃える＝二重表示しない・#43）。植物認識（`detectPlants`）には生の caption＋hashtags を渡すので strip しても認識は不変。
- **学名表記（#70）**: 学名は属名・種小名をイタリックにするのが正式だが、ランク略号・接続語（`var.`/`subsp.`/`ssp.`/`f.`/`cv.`/`aff.`/`cf.`/交配の `×` 等）は**直立体**にするのが植物学の正しい表記。`src/components/ui/SciName.tsx` が sci 文字列をトークン分割し接続語だけ直立で描画する。PlantSuggest と PostDetail の植物チップで使う。
- **ヘッダ（全ページ共通・#30）**: 主要ナビ（みんなの植物／自分の植物／Hanōba とは／投稿する）を `SiteHeader.astro` に内蔵。sm 以上はインライン、sm 未満はハンバーガー→ドロップダウン。ページごとの `current` で現在地を強調。`hidden sm:inline` でモバイル時にリンクが消える旧構成は廃止。

## 5. デザインシステム ── 「夜の温室／大人のコレクター部屋」

### 5.0 世界観（確定・kako-jun session640）

Hanoba は明るい量販 SNS ではない。**焦げ茶の木目棚に植物が並び、オレンジの照明がぼうっと灯り、ガラスには水滴が伝う、暗くシックで高級感のある夜の部屋**。プロの植物コレクターの空間。ここに「育てて、見せる。」がある。Instagram の白い量産グリッドの対極＝大人の落ち着きと所有の喜び。

実装3原則:
1. **背景はベタ塗りにしない** ── AI 生成のぼやけた高級写真（`public/og/bg-blur.webp`）を `background-attachment: fixed` で全面に敷き、暗いオーバーレイで可読性を確保する。
2. **面（パネル）は半透明のグラス** ── `.glass` / `.glass-strong`（`backdrop-blur`＋微光の白枠）。ガラス越し・水滴・反射の空気を出す。
3. **ボタンだけは塗りでくっきり** ── CTA は `bg-ha-green`（葉）／`bg-ha-pink`（花）の塗りで可読性最優先。グラスに埋もれさせない。

### 5.1 トークン（暗色・シック）

アクセントは ToHeart 由来（**緑＝葉／ピンク＝花**）を継承するが、**ベースは「明るいクリーム」から「焦げ茶〜黒」へ刷新**。ピンクは**差し色のみ**（通知・ハイライト）。**ヘッダや地にピンク/明色を使わない**（旧クリーム地はヘッダがピンクがかって見えたため廃止）。CSS 変数は `src/styles/global.css @theme`。

```
--color-ha-green:      #6cba38   /* 葉。CTA・リンク・選択（暗地で映える明るめ） */
--color-ha-green-deep: #aee07f   /* 暗地での見出し・強調＝明るい葉色 */
--color-ha-green-soft: #20301c   /* 暗い葉色の面（写真プレースホルダ・チップ地） */
--color-ha-pink:       #ff5d6a   /* 花。差し色のみ（通知・ハイライト） */
--color-ha-pink-soft:  #3e2024   /* 暗いピンク面 */
--color-ha-orange:     #e89a4c   /* 照明＝暖色オレンジ（グロウ・ハイライト） */
--color-ha-base:       #14120d   /* ベース＝焦げ茶〜黒（背景写真の下地・グラスの奥） */
--color-ha-white:      #f6f0e6   /* 抜き＝暖かい白（ボタン上の文字・最明部） */
--color-ha-ink:        #ece6da   /* 本文＝暖かいオフホワイト（暗地に乗る） */
```

### 5.2 タイポ・モーション

- **タイポ**: 見出し＝`Outfit`（geometric sans・欧/数字）×日本語 `Zen Kaku Gothic New`。本文＝Zen Kaku。本文400↔見出し800/900でウェイト飛躍。汎用フォント（Inter/Roboto/system/Space Grotesk）禁止（Anthropic frontend aesthetics 準拠）。`--font-display` / `--font-sans`。
- **モーション**: ページロードの控えめな staggered reveal（`.ha-rise`＋`--i`・CSS-only・`prefers-reduced-motion` で無効）。**安っぽい装飾は禁止**（ホバーでロゴを傾ける等はダサいので不可）。
- **フローティング UI**: 右下に「一番上へ戻る」（`ScrollToTop`・全ページ共通・400px 超で出現・`prefers-reduced-motion` 時は smooth でなく即時・#110）。
- **グリッド**: 写真は Instagram explore 流に**隙間を詰め（gap 0.5）角丸は小さく（rounded-md）フラット**（浮かせない）。

### 5.3 ワードマーク／アイコン

- **ロゴ＝架空都市ハノーバの市旗（H 字）**。葉モチーフ（マンネリ）も丸も使わない。**4色に塗り分けて H に見せる**: 生成り地＋緑の左柱＋深緑の右柱＋ピンクの横棒。favicon / icon / maskable / apple-touch / ヘッダーで同型に統一（`scripts/generate-icons.mjs` で PNG 再生成）。
- **ワードマークは `Hanoba` のみ**（国際的な印象・`font-display`）。**漢字「葉の場」はロゴ下に併記しない**。カッコ表記（`Hanoba（葉の場）` 等）も使わない。
- **アイコン**: 寄せ集めの Unicode 記号（♡/×）を廃し、単一出自・統一線幅の SVG（`src/components/ui/Icon.tsx`）。**いいねは黄色い花（`flower`＝`text-ha-yellow`・#116。ハート/絵文字でなく SVG）**。投稿ボタンは発芽したての双葉（`sprout`＝育てる世界観・#48）。撮影/アルバムは `camera`/`image`（#29）。情報ページ（About）導線は `info`(円＋i・#106)。サービスリンク（#35 Piece 2）も同じ線スタイルで `link`(地球)/`code`/`x`/`youtube`/`instagram`/`writing`/`art`/`music`/`shopping`/`game`/`at`/`chat` をカテゴリ単位で持つ（ブランドロゴは作らない）。**塗りの例外は `flower`(いいね)・`heart`(Ko-fi)・`x`（X 公式ロゴ・#115）・`github`（公式 Octocat・#118）**＝ブランド識別性が高いものは線縛り（#21）の明示的例外として公式グリフを塗りで使う。**ヘッダとフッタのナビは同じ並び（About→みんなの植物→あなたの植物→投稿する）に揃え、About には `info` を付ける（#106）。フッタ外部リンクは mypace=公式マーク画像 `public/mypace-icon.webp`（汎用★記号でなく mypace 独自の丸み星・#105）/GitHub=`github`（#105）。インラインのアイコン付きリンクは `leading-none` で行高を詰め、`items-center` でアイコンがテキストと光学的に揃う（#105 follow-up）。**

### 5.4 画像アセット（AI 生成・`/image`）

- `public/og/room-dark.webp` … 夜のコレクター部屋（空フィード/discover の背景パネル）。
- `public/og/bg-blur.webp` … それをぼかし暗くした全面背景。
- `public/og/og-image.jpg`（1200×630）… OGP/Twitter カード。
- ソース PNG はリポに残さず、`/image`（codex/gpt-image-2）のプロンプトで再生成する。

### 5.5 SEO / OGP（#107）

- `MainLayout` で head を一元管理。`astro.config` の `site=https://hanoba.llll-ll.com` を基準に **canonical / og:url** をページごとの絶対 URL で出す（`Astro.url.pathname`）。`og:image`/`twitter:image` も同 site の絶対 URL。
- **JSON-LD** は `<script type="application/ld+json" is:inline>` で描画する（`<meta>` 化しない＝meta だと無効）。`WebSite` ＋ サイトリンク検索ボックス（`SearchAction` で discover の `?q=` を提示）。
- **sitemap** は `@astrojs/sitemap` が全ページから `sitemap-index.xml`＋`sitemap-0.xml` を自動生成。**`public/robots.txt`** が `Sitemap:` で参照する。
- title/description は各ページが `MainLayout` の props で渡す（未指定はデフォルト）。

### 5.6 操作（ボタン/リンク）の配置 — 統一ポリシー（#98）

バラバラな左寄せをやめ、全画面で一貫させる。

- **アクション行（フォームの送信/取消）は右寄せ（`flex justify-end`）**。**主操作＝塗りの緑ボタン（角丸 full）を右端**、副次操作（やめる/キャンセル）と補足（不足理由・保存ステータス）はその左に置く。Composer の「基本動線（主アクションを右端）」に全フォームを揃える（AccountName 取り込み・ProfileEditor 保存も右寄せに統一）。モバイルは `flex-wrap` で副次が上段に折り返してよい。
- **単一フィールドの確定**（ハンドルネーム保存など）は入力欄の右に主操作ボタンを置く（実質右寄せ）。
- **補助リンク**（モード切替「すでにアカウントを…」、追加「＋サイトを追加」）はアクション行と分け、別行・**左端**（読み始めの位置・`self-start`）で控えめに。
- **破壊的操作の確認**は中央オーバーレイ（`grid place-items-center`）に確認文＋ボタンを出す（フォームのアクション行とは別パターン。例: 投稿削除の「写真ごと削除しますか？」）。
- **入力欄の × クリア**は共通コンポーネント `src/components/ui/ClearableInput.tsx`（`ClearableInput`＝単一行は右中央、`ClearableTextarea`＝複数行は右上）に集約。値があるとき右端に × を出し、押すと空にして再フォーカス。各テキスト入力（ハンドルネーム/nsec/検索/アイコンURL/サイト/自己紹介）に適用。キャレット＋ハッシュタグ補完を持つ Composer の一言だけは同じ見た目の × をその場で足す（補完ポップアップも閉じる）。新しいテキスト入力は原則この共通部品を使う。

## 6. データ（Nostr）— 検証済み契約

mypace と同じ Nostr 空間・同じタグ規約に準拠する（独自化しない＝mypace から見える要件）。

- **イベント**: `kind: 1`（テキストノート）。
- **タグ**:
  - `['t','mypace']` … **必須・自動付与**。これで投稿は通常の mypace 投稿と同一に mypace タイムラインへ出現。
  - `['t','hanoba']` … **必須・自動付与**。hanoba のフィードはこのタグで絞る（mypace の一般投稿を hanoba に流さないため）。
  - `['client','hanoba']` … 自動付与。可視性には影響しない。
  - **植物トピック・種別は、一言（本文）にユーザーが書く `#ハッシュタグ`** で表現（例: `#アガベ #パキポ`）。本文に見えるテキストとして残す。**hanoba 側に固定の植物 taxonomy は持たない**。**本文 `#` は `t` タグ化しない**（mypace と完全一致＝独自化禁止。確定）。集約は書き込み側のタグでなく、読み取り側の二段構え検索で行う（下記）。
- **content**: 必須の一言 ＋ 画像 URL を**インラインのプレーン URL**で（`https://image.nostr.build/<hash>.<ext>`。imeta タグは使わない）。**一言が空（URL のみ）は弾く**。
- **画像アップロード**: `POST https://nostr.build/api/v2/upload/files`（NIP-98 認証）。EXIF はサーバ側で自動削除。
- **リレー**: `wss://relay.damus.io`, `wss://nos.lol`（必要時に検索 `wss://search.nos.today`）。
- **鍵**: ブラウザ生成・localStorage 保存、NIP-07 任意。
- 既存コンポーザーの流用方針は §3（クロップ→1:1 ロック、レトロ加工→選択式）。
- **タグの集約（読み取り）＝二段構え**（mypace 準拠・#3/#4 で実装）: ① `{"#t":[tag]}` フィルタで `t` タグ持ちを取得、② NIP-50 `search:"#tag"` で**本文ハッシュタグ**を全文検索（他クライアントの `t` タグ無し投稿も拾う）、③ event id でマージ・重複除去。これが emergent taxonomy の本体で、書き込み側で本文 `#` を `t` 化しなくても集約できる根拠（書き込みタグは `t:mypace` / `t:hanoba` / `client:hanoba` のみ）。検索 relay = `wss://search.nos.today`。
- **discover の検索モード（#24/#68・実装済）**: 入力を `classifyDiscoverQuery` で分岐する。**`#アガベ`＝タグモード**＝上の二段構え。**`葉焼け` 等 `#` 無し＝キーワードモード**＝ NIP-50 `search:"葉焼け"`（本文中の素の語・`#` 無しも拾う）＋同語の `{"#t":[葉焼け]}` も一応取得しマージ。**`npub1…`（`nostr:` 接頭辞可）＝著者モード**＝ nip19 で pubkey 化し `{kinds:[1], authors:[pubkey]}` を取得。**`@ユーザー名`＝ユーザー名モード**＝ NIP-50 `{kinds:[0], search:名前}` で kind:0 を引き、`selectAuthorsByName`（name 部分一致・pubkey ごと最新・上限20）で著者を絞ってからその `authors` の kind:1 を取得（特定の人の植物を能動チェック＝昔のユーザーの新着待ちをしない）。著者モードは `t:hanoba` に絞らず他クライアントの投稿も含める。読み取り側のみの強化で §6 の契約（本文 `#` は `t` 化しない）は不変。URL は `?q=`（旧 `?tag=` は後方互換で読む）。
- **植物タグの多段ドリルダウン（#63・実装済）**: 辞書（`dictionary.ts`）は `parent` で属→種→品種の木を持つ。投稿時の `PlantSuggest` は本文から認識した植物の正規タグに加え、子があれば「**もっと具体的に**」として子（種/品種）を提示し、辿って具体化できる（属タグと具体タグは併存可＝両方で検索に乗る）。`childrenOf(id)` が直接の子を返す。辞書の品種拡充は随時。
- **植物の別名 OR 検索（#23 Phase 2・実装済）**: 検索語が辞書の植物に解決できる場合（`findPlantByTerm`）、その植物の**全表記を横断**する。`{"#t":[名前, 別名, 単語学名…]}` は配列で OR できるので 1 クエリで別名タグをまとめて取得し、本文は著名表記で NIP-50 全文検索。例: 「パキポ」でも Pachypodium / パキポディウム タグの投稿を拾う。PostDetail の植物チップは `#<著名名>` で discover へ飛ばし、この経路に乗る。
- **正規形ピッカー（#23 Phase 2・実装済）**: 投稿の作文中、本文に書いた俗称/カナ/英/略を `detectPlants` で認識し、その植物の**正規形タグ（最も有名な表記＋学名併記）をワンタップで足せる**（`PlantSuggest`）。表記ゆれの新規発生を入口で抑える（投稿は不変なので「書く時に揃える」）。既に正規タグがあれば候補に出さない。**残（Phase 2）**: cultivar 修飾の丸め・Spor/PUP 等のラフ表記正規化・辞書拡充。

## 7. Non-goals

- 自前バックエンド／DB を持たない。
- 動画。
- 植物同定・図鑑（GreenSnap／Planta とは戦わない。こちらは SNS）。

## 8. Open

- クロスクライアント二段構え検索（§6 の `#t` フィルタ＋NIP-50 `search`）は**将来の discover 機能で実装**する（#4 の hanoba 限定フィードでは使わない）。#4 は `t:hanoba` で絞った hanoba 投稿だけを表示し、タグ絞り込みも取得済み hanoba 投稿のクライアント側フィルタに留める（他クライアント投稿を混ぜない）。
- （済）本文 `#` の扱い＝**`t` タグ化しない**・集約は二段構えの読み取り検索（§6・mypace 準拠・確認済）。hanoba も content `#` をテキストとして踏襲し、ナビ可能タグとして扱う。
- ハッシュタグ補完の seed 範囲（Wikipedia 由来の種名をどこまで持つか、species に `@@` エンティティ紐付けを使うか。cultivar は freeform `#`）。
- レトロ加工に加え「即時の軽い補正（彩度等）」を別途持つかの線引き。
- サブドメイン `hanoba.llll-ll.com`。
- mypace 記録 API への ping（**後回し・任意**。通知/スコア参加が要れば将来）。
- （済）パレット §5・Nostr 契約 §6・タグ方針（自動＝`t:mypace`＋`t:hanoba`、トピックは本文 `#`）。
