---
name: hanoba
description: 植物写真のSNS「育てて、見せる。」。夜の温室・大人のコレクター部屋──焦げ茶の木目棚・オレンジの照明・ガラスの水滴の、暗くシックで高級感のある空間。明るい量販SNSの対極。
colors:
  # 実装済みの値（src/styles/global.css @theme が実行時の正本）。本番稼働サイトなので TBD ではない。
  ha-green: "#6cba38"        # 葉＝緑。CTA・リンク・選択。暗地で映える明るめ
  ha-green-deep: "#aee07f"   # 暗地での見出し・強調＝明るい葉色
  ha-green-soft: "#20301c"   # 暗い葉色の面（写真プレースホルダ・チップ地）
  ha-pink: "#ff5d6a"         # 花＝ピンク。差し色のみ（通知・ハイライト）。地/ヘッダには使わない
  ha-pink-soft: "#3e2024"    # 暗いピンク面（エラー通知の地）
  ha-orange: "#e89a4c"       # 照明＝暖色オレンジ（グロウ・ハイライト）
  ha-yellow: "#f2c84b"       # 花＝黄。いいね（花）の差し色。暗地で映える山吹
  ha-base: "#14120d"         # ベース＝焦げ茶〜黒（背景写真の下地・グラスの奥）
  ha-white: "#f6f0e6"        # 抜き＝暖かい白（ボタン上の文字・最明部）
  ha-ink: "#ece6da"          # 本文＝暖かいオフホワイト（暗地に乗る）
typography:
  sans:
    fontFamily: '"Zen Maru Gothic", "Outfit", ui-sans-serif, system-ui, sans-serif'
    usage: 本文・UI（日本語＝丸ゴシックで角丸の世界観に合わせる）
  display:
    fontFamily: '"Outfit", "Zen Maru Gothic", ui-sans-serif, system-ui, sans-serif'
    usage: 見出し（geometric sans・欧/数字）
elevation:
  background: "ぼやけた高級写真（AI生成・public/og/bg-blur.webp）を background-attachment:fixed で全面。ベタ塗り禁止。3ストップの暗いオーバーレイ（時間帯）＋八節で背景写真差し替え（季節）"
  panel: "半透明グラス（.glass / .glass-strong＝backdrop-blur＋微光の白枠）。ガラス越し・水滴・反射の空気"
  button: "CTA だけは塗りでくっきり（bg-ha-green 葉／bg-ha-pink 花）。グラスに埋もれさせない"
---

## Overview

hanoba の見た目の正本（google-labs 形式）。トークンの実行時正本は `src/styles/global.css` の `@theme`＝本書の front matter はそれを機械可読に写したもの（本番稼働サイトなので実値・TBD ではない）。デザインシステムの設計意図・世界観・タイポ/モーション/ワードマーク/画像アセット/SEO-OGP/操作配置ポリシーは、以下 §5.0〜§5.6（元 DESIGN.md から逐語）に残す。

非ビジュアル（原則・アーキテクチャ・実装方針・主要画面・データ契約・Non-goals）は `docs/spec.md` と `docs/architecture.md` に分割した（session765）。

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

- **タイポ**: 見出し＝`Outfit`（geometric sans・欧/数字）×日本語 `Zen Maru Gothic`（丸ゴシック・角丸の世界観に合わせる #170）。本文＝Zen Maru Gothic。本文400↔見出し800/900でウェイト飛躍。汎用フォント（Inter/Roboto/system/Space Grotesk）禁止（Anthropic frontend aesthetics 準拠）。`--font-display` / `--font-sans`。
- **モーション**: ページロードの控えめな staggered reveal（`.ha-rise`＋`--i`・CSS-only・`prefers-reduced-motion` で無効）。**安っぽい装飾は禁止**（ホバーでロゴを傾ける等はダサいので不可）。
- **画像リビール（#145）**: 画像は blur-up リビール（`ProgressiveImage`＋`.ha-reveal`）で出す。デコード完了まで `opacity:0` で隠し、`onLoad`（＋キャッシュ済みは `img.complete`）で `data-loaded="true"` を立てて blur＋わずかな scale を解きながらフェードインする。非プログレッシブ画像が上から帯状に描かれる生 `<img>` を置き換えたもの。`prefers-reduced-motion` では遷移なしで即時表示。4 箇所（カード写真＝object-cover 固定箱／拡大カルーセル＝object-contain／アバター＝rounded-full／あなたの植物グリッドのサムネ＝object-cover 正方形）で共有。WASM/Canvas の「現像」リビール（stage 3）は別途の将来フォローアップ。
- **フローティング UI**: 右下に「一番上へ戻る」（`ScrollToTop`・全ページ共通・400px 超で出現・`prefers-reduced-motion` 時は smooth でなく即時・#110）。**投稿 FAB（#283）**: その左隣（`PostFAB`・`right-[4.75rem]`＝隅は ScrollToTop 用に空ける固定スロット）に常駐の塗り緑 FAB（`/compose` へ1クリック・**アイコンは「横から見た綿毛」＝写真を風に放つメタファ**〔`public/post-fab.webp`・gpt-image-2 生成の白透過ラスタ。真上ビューの放射状＝＊状に紛れる `sprout`/`dandelion` を避けるための、線アイコン集 `Icon.tsx`(currentColor SVG) の例外〕・ScrollToTop の表示状態に依らず位置不動）。投稿画面（`/compose`）では `MainLayout` の `isCompose` でサーバ側に出さない。
- **綿毛の送信エフェクト（#148 / #252）**: 投稿ボタンを押すと綿毛（タンポポの種）が舞い上がる。打ち上げの一斉バーストに加え、**投稿が終わるまで少量ずつ連続スポーン**して「風に乗って次々舞い上がる」流れを作り、アップロード＋publish の長い待ち（10秒級）でも画面が止まって見えないようにする（#252）。メタファは「自分の植物の写真を風に放つ」。粒は和・水彩タッチの**透過スプライト3変種**（`public/seed-watercolor-{1..3}.png`＝黒い綿毛を白地に生成し、輝度をアルファ＋白黒反転して白い綿毛＋半透明の冠毛に変換＝クロマキーのハロ無し・API キー不要）をランダムに割り当て、大きめサイズ（~104px）＋**粒ごとの非一様スケール/skew の変形**（見かけの拡大率を混ぜる）＋横揺れ・回転ドリフト・上端フェードで一粒ずつ違う舞いにする（反復＝単調を消す）。種の生成は純関数 `lib/composer/dandelion.ts`（`makeWind`/`makeSeed`/`makeSeeds`・連続側はバッチごとに風を取り直す）、描画は `DandelionBurst`（`active={posting}` で駆動・各粒は animationend で自分を消す）＋`.ha-seed-rise`。**ボタンに残す稼働サインは綿でなく普通のスピナーリング**＋段階テキスト「写真を送信中 N/M → 投稿中」（綿はボタンから飛び出した側なので・#252）。idle の送信ボタンのアイコンは**投稿 FAB と同じ綿毛ラスタ `public/post-fab.webp`** に統一（#293・線アイコン `dandelion` から差し替え＝右下 FAB と同じ絵）。`prefers-reduced-motion` では spawn せず無音（コンポーネントが null・CSS でも `animation:none`）。`pointer-events:none`・`aria-hidden` でクリック・レイアウト・支援技術に干渉しない。**綿毛が舞ってもスクロールバーの出没で画面幅がガタつかないよう、`html` に `scrollbar-gutter: stable` で gutter を常時確保する（#294・横方向は `body{overflow-x:clip}` で切る #271 の積み残し対応）。**
- **天気の環境演出（#231・#132 段階4）**: ハノーバ（＝金沢駅・鼓門の固定座標）の今の天気を Open-Meteo から取得し（ユーザー位置は使わない＝身バレ回避・backendless）、雨のとき**ガラスに付いた水滴**を前面環境レイヤ（`AmbientWeather`・`client:idle`）で重ねる。**「天気＝明るさ」でなく「天気＝ガラス面に起きる現象」**で表す＝明度は上げずに暗色シック（§5.0）を保つ（晴れでも眩しくしない＝「背景が明るくなると暗色前提が崩れる」矛盾の根本解決）。レイヤは**部屋写真と本文の間（`z-index:-1`）に固定**＝本文の可読性は無傷・`pointer-events:none`。雨の強度（WMO `weather_code`＋`precipitation`）で素材を出し分ける（**大雨＝密な水滴 `rain-glass-heavy.webp`／普通・霧雨＝疎な玉＋流れ落ちる雫 `rain-glass.webp`**）。`opacity` は「ほどほど」（0.65）で滲み出し＋ごく緩い呼吸（drift）。`prefers-reduced-motion` で静止。`?weather=rain|heavy|drizzle|clear…` で強制できる（dev/blink 用）。純ロジックは `src/lib/weather/`（URL 生成・WMO→状態・強度・キャッシュ・取得＝`now` を引数で受けテスト可能）、島は取得と描画だけ。**段階2 は雨のみ**＝背景写真の天気別差し替え・昼夜・lore テキスト連動は後段。
- **時刻の環境演出（#231 後段②）**: **背景写真は差し替えず**、同じ絵にかけるオーバーレイ（body の `background-image` の `linear-gradient`）の**暗さ・色温度だけ**を時間帯で変調する。軸は**鼓門の JST**＝天気と同じく「みんな同じハノーバの今」を共有（ユーザー TZ に依らない）。朝/昼/夕/夜の 4 段（`timeOfDay(jstHour)`・`src/lib/weather/timeOfDay.ts`・純関数）。**全段ダークレンジ内**＝暗色シック維持・「天気＝水滴／時刻＝明るさ／季節＝背景写真そのもの」の3軸分離。**夜＝暖色で最暗（既定・これまでの見た目）／夕＝鮮やかな夕焼けオレンジ（一番"ばえる"）／昼＝中立やや冷で最も明るい（室内の緑が見える程度・眩しくしない）／朝＝冷たい薄明**。実装＝`:root` の `--bg-overlay-{top,mid,bot}` を `html[data-time="…"]` で上書き。**flash 回避**に MainLayout の `<head>` inline script が**描画前に** `data-time` を設定（バケットは `timeOfDay.ts` と同じ境界を直書き＝市民手帳ラベル #262 と同じ手法）、`AmbientCalendar` 島がマウント後に同値で再設定＋5 分ごとに境界更新。`?time=morning|day|evening|night` で強制（dev/blink 用）。天気の水滴とは独立に合成される（夕焼け＋雨 等）。
- **季節の環境演出（#231 後段①）**: **背景写真そのもの**を八節（二十四節気の主要8つ＝四立＋二分二至）で差し替える＝「同じ夜の collector 部屋がゆっくり移ろう」。軸は**鼓門の JST 暦日**（`solarPhase(month,day)`・`src/lib/weather/solarPhase.ts`・純関数・節の開始は近似固定日／背景の気分なので天文精度不要）。**室内・夜・暗いは全節共通**＝黒格子の壁・板付ビカクシダ・アガベ・ユッカの部屋は据え置き（屋外絵は使わない）、**塊根の状態（落葉性＝冬は裸の幹／夏は繁茂・開花）＋季節の一鉢（立春=梅／春分=桜／立夏=紫陽花／夏至=朝顔／立秋=ススキ／秋分=紅葉／立冬=南天／冬至=松・正月）**で節を表す（常緑のアガベ等は不変＝世界観を壊さない）。アングルは節ごとに変えて単調を避ける。実装＝背景写真を `--bg-photo` 変数にし `html[data-sekki="…"]` で8枚（`public/weather/season-*.webp`）を差し替え（時刻のオーバーレイ・天気の水滴はその上に重なる＝3軸合成）。未知の節は既定 `bg-blur.webp` にフォールバック。**flash 回避**に inline script が描画前に `data-sekki` を設定（境界は `solarPhase.ts` と同じ値を直書き）、`AmbientCalendar` 島が再設定＋更新。`?sekki=risshun|shunbun|rikka|geshi|risshu|shubun|ritto|toji` で強制（dev/blink 用）。
- **グリッド**: 写真は Instagram explore 流に**隙間を詰め（gap 0.5）角丸は小さく（rounded-md）フラット**（浮かせない）。

### 5.3 ワードマーク／アイコン

- **ロゴ＝架空都市ハノーバの市旗（H 字）**。葉モチーフ（マンネリ）も丸も使わない。**4色に塗り分けて H に見せる**: 生成り地＋緑の左柱＋深緑の右柱＋ピンクの横棒。favicon / icon / apple-touch / ヘッダーで同型に統一（`scripts/generate-icons.mjs` で PNG 再生成）。
- **ワードマークは `Hanoba` のみ**（国際的な印象・`font-display`）。**漢字「葉の場」はロゴ下に併記しない**。カッコ表記（`Hanoba（葉の場）` 等）も使わない。
- **アイコン**: 寄せ集めの Unicode 記号（♡/×）を廃し、単一出自・統一線幅の SVG（`src/components/ui/Icon.tsx`）。**いいねは黄色い花（`flower`＝`text-ha-yellow`・#116。ハート/絵文字でなく SVG）**。投稿詳細のいいねボタンはトグル（#537）＝いいね済みは塗りの `flower`（`text-ha-yellow`）のまま、未いいねは同じ花の輪郭を線画にした `flowerOutline`（`text-ha-orange`＝照明色を流用）に出し分ける。投稿コンポーザの送信ボタンは綿毛ラスタ（`public/post-fab.webp`＝投稿 FAB と同じ絵・写真を風に放つ・#148/#293。投稿中はボタンを綿でなくスピナーリングに替える・#252。ナビ等の発芽双葉 `sprout`＝育てる世界観・#48 とは別アイコン）。撮影/アルバムは `camera`/`image`（#29）。情報ページ（About）導線は `info`(円＋i・#106)。サービスリンク（#35 Piece 2）も同じ線スタイルで `link`(地球)/`code`/`x`/`youtube`/`instagram`/`writing`/`art`/`music`/`shopping`/`game`/`at`/`chat` をカテゴリ単位で持つ（ブランドロゴは作らない）。**塗りの例外は `flower`(いいね)・`heart`(Ko-fi)・`x`（X 公式ロゴ・#115）・`github`（公式 Octocat・#118）**＝ブランド識別性が高いものは線縛り（#21）の明示的例外として公式グリフを塗りで使う。**フッタの内部リンクは市民手帳→市政だより→市勢調査→住民投票→みんなの植物→あなたの植物→投稿する（#532）**。実在する市政窓口3件を手帳内と同順にし、対になる植物一覧を隣接させる。DOM順を `flex-wrap` し、デスクトップは左→右、モバイルは上→下に読む。市民手帳には `info`、投稿には `sprout` を付ける。フッタ外部リンクは mypace=公式マーク画像 `public/mypace-icon.webp`（汎用★記号でなく mypace 独自の丸み星・#105）/GitHub=`github`（#105）。インラインのアイコン付きリンクは `leading-none` で行高を詰め、`items-center` でアイコンがテキストと光学的に揃う（#105 follow-up）。**

### 5.4 画像アセット（AI 生成・`/image`）

- `public/og/bg-blur.webp` … ぼかして暗くした全面背景（`body` の `background-image`）。
- ~~`public/og/room-dark.webp` / `public/about/{flower,field,fruit}.webp`~~ … 旧 About（三人称 SaaS 説明の 4 カード）の彩り画像。About を市民手帳（#163・#469 で図鑑化）へ作り替えた際にカードごと撤去し、画像も削除済み（孤児アセット整理）。
- `public/og/og-image.jpg`（1200×630）… OGP/Twitter カード。
- `public/weather/season-{risshun,shunbun,rikka,geshi,risshu,shubun,ritto,toji}.webp` … 季節の背景（#231 後段①・§5.2）の八節8枚。codex/gpt-image-2 に**暗い夜のビザール植物部屋（黒格子・板付ビカク・アガベ・ユッカ据え置き＋塊根の状態＋季節の一鉢、節ごとに別アングル）**を生成させ、`scripts/season-bg-blur.py` で**ガウスぼかし＋わずかに暗く＋downscale（1200px・q82・各約16KB）**にした地。どうせ暗くぼかすので軽量で十分。precache 除外（`public/weather/**`）＝現在の節だけ on-demand。
- `public/weather/rain-glass.webp` / `public/weather/rain-glass-heavy.webp` … 天気の前面環境演出（#231・§5.2）の雨の水滴（普通／大雨）。codex/gpt-image-2 に**純黒地に水滴のフチ＋glint だけ**を描かせ、`scripts/weather-droplet-alpha.py` で **alpha＝輝度（黒→透明・中央は透けて奥の部屋が見える＝透明感）＋`--gamma 0.5` で楕円フチを持ち上げ＋`--dilate 1` でフチが小スケールで消えないように**変換した透過素材（gpt-image-1.5 不要）。
- `public/book-frame-washi-v1.webp` / `public/book-page-washi-v1.webp` / `public/mayor-botanics-watering-can.webp` … 市民手帳（#163・#219）の和綴じ枠（`border-image` 9 スライス）・和紙ページ地・市長ボタニクスの語り手アイコン（顔は秘密＝ジョウロ）。**本全体が市長の語りなので、語り手マーク（`MayorMark`＝アイコン＋「ボタニクス市長」）は移住案内1pだけでなく全ページの冒頭に出す（#455・kako-jun。welcome 専用の重複行は撤去）**。**手帳は全 4 ページを最初から開放する（#510 方針B）**＝レベル解禁ゲートはなく、ロック頁（？？？）・読めない頁の veil や、それを描いていた CSS/コンポーネントも撤去済み。市民レベルはページの閲覧可否を司らず、タイトルの進捗バッジ（Ln）と既定表示ページ `defaultPage(level)` の味付けにだけ残る。**「市政の窓口」は解禁と結びつけず、全ページ共通で手帳ページの下に常設する（`civicHub`＝共有リンク定義／`CivicWindows`＝描画・#510 方針B）**。**ページめくりはキーボード矢印に加えタッチスワイプでもできる（#275・左で次・右で前）＝写真カルーセルと同じ純関数 `carousel.ts`（`swipeDirection`/`swipeProgress`/`swipeToBlur`）を共有**し、**スワイプ量に応じてページ中身がぼける**（和綴じ枠は固定したまま `key={page}` の中身だけに `filter: blur()` を当て、枠ごとぼかす違和感を避ける）。ページ送りは両端のみ no-op（`canPrev = page > 1` / `canNext = page < TOTAL_PAGES`＝レベル連動の前送り制限は撤去し末尾まで前送りできる）、指を離すと 0.25s でぼかしが戻る。`prefers-reduced-motion` 時はぼかさない（スワイプによるページ遷移自体は有効）。
- `public/hanoba-welcome-vista.webp` / `public/hanoba-map.webp` … 市民手帳本文中の挿絵（P1 移住案内の街の俯瞰ビスタ・P2 街の地図・#504／#137）。**表示は最大幅 170px・中央寄せ・角丸（`rounded-xl`）・枠線/リングなし**＝手帳パネル全幅までは拡大せず本文に寄り添う小挿絵として置く（P1/P2 共通・#507）。
- `public/hanoba-gazette-more-view.webp` … 市政だより最新記事（id: `load-more-feed`・「もっと見る」#554 の発表・#560）の挿絵（温室クラスターの俯瞰イラスト）。市民手帳 guide ページ種と同じマークアップ・スタイル（最大幅 280px・中央寄せ・角丸・`scale-[1.02] object-cover`）で見出し直下・`MayorMark` の下に置く。
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
- **単一行入力の × クリア**は共通コンポーネント `src/components/ui/ClearableInput.tsx`（`ClearableInput`＝右中央に ×）に集約。値があるとき右端に × を出し、押すと空にして再フォーカス。各単一行入力（ハンドルネーム/nsec/検索/アイコンURL/サイト）に適用。新しい単一行入力は原則この共通部品を使う。
- **複数行入力（自己紹介・ひとこと）**は共通コンポーネント `src/components/ui/ResizableTextarea.tsx` に統一（#188）。glass・右上の ×クリア・**下辺の大きなドラッグバーで高さ調整**（ポインタドラッグ＋矢印キー・既定 124/最小 104/最大 360px、`role="separator" aria-label="入力欄の高さを調整"`）を備える。高さクランプは純関数 `clampHeight` に切り出し。これで `ProfileEditor` の自己紹介と Composer のひとことが同一デザイン・同一操作感になる。キャレット制御＋ハッシュタグ補完を持つ Composer の一言（`CaptionInput`）は、この共通部品に `ref`／`onKeyDown`／補完ポップアップ（`children`）を渡して補完ロジックだけを上載せする（補完は一言専用なので共通部品には含めない）。
