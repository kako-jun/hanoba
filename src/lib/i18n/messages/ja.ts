// 日本語カタログ（#147 段階1）＝**文言の型の単一ソース**。
//
// フラットな dot-key（`nav.discover` 等）で名前空間を表す。`as const` で値リテラルを保ち、
// `keyof typeof ja` を MessageKey（全文言キーの union）として t.ts/en.ts が共有する
// ＝キーの取りこぼし・タイポをコンパイル時に検出できる。
//
// 補間は `{name}` プレースホルダ（t.ts が params で置換）。
// ここに無いキーを使うと型エラーになる＝文言の所在をこのファイルに一本化する。
//
// 段階1ではスライス（ヘッダ／ホームのヒーロー／投稿FAB）分だけを移管する。
// 全文言の展開は段階2（#147）で pages/islands へ fan-out する。

export const ja = {
  // 共通ナビ（SiteHeader / SiteFooter）。
  "nav.discover": "みんなの植物",
  "nav.me": "あなたの植物",
  "nav.compose": "投稿する",
  "nav.ranking": "人気ランキング",
  "nav.menu.open": "メニューを開く",
  "nav.menu.close": "メニューを閉じる",
  "nav.home.aria": "葉の場 Hanoba トップへ",

  // 共通フッタ（SiteFooter）。
  "footer.tagline": "架空の植物好き都市ハノーバ（葉の場）を、みんなで育てています。",

  // 一番上へ戻る（ScrollToTop）。
  "scrollToTop.aria": "一番上へ戻る",

  // PWA「ホーム画面に追加」促し（InstallPrompt）。
  "install.title": "ホーム画面に追加",
  "install.ios": "共有メニュー {arrow} から「ホーム画面に追加」を選ぶと、アプリのように開けます。",
  "install.tagline": "アプリのように開けます。",
  "install.add": "追加",
  "install.later": "あとで",

  // 汎用（複数箇所で共有）。
  "common.close": "閉じる",
  "common.retry": "再試行",

  // 相対時刻（relativeTime・PostCard/PostDetail 等で共有）。
  "time.justNow": "たった今",
  "time.minutesAgo": "{n}分前",
  "time.hoursAgo": "{n}時間前",
  "time.daysAgo": "{n}日前",

  // フィード表示（PostCard・FudaList・VarietyFilter・いいね/コメント数）。
  "card.photo.zoom": "写真を拡大",
  "card.photos.count": "{n}枚",
  "card.author.profile": "{name} のプロフィール",
  "card.readMore": "続きを読む",
  "reaction.likes.aria": "いいね {n}",
  "reaction.comments.aria": "コメント {n}",
  "fuda.search.title": "{label}で探す",
  "filter.remove.aria": "「{tag}」を外す",

  // フィードのグリッド（FeedGrid / DiscoverGrid / MyGrid の読み込み・空・エラー）。
  "feed.error": "フィードを読み込めませんでした。",
  "feed.empty": "まだ投稿がありません。",
  "feed.error.short": "読み込めませんでした。",
  "feed.filter.clear": "絞り込みを解除",
  "feed.tag.empty": "「#{tag}」の投稿はまだありません。",
  "discover.loading": "「{summary}」を探しています…",
  "discover.empty": "「{summary}」の投稿は見つかりませんでした。別の品種で試してみましょう。",

  // あなたの植物（MyGrid・自分の投稿の編集/削除）。
  "my.subject": "あなた",
  "my.empty": "まだ、あなたの植物はありません。",
  "my.edit.aria": "この投稿を編集",
  "my.delete.aria": "この投稿を削除",
  "my.edit.done": "投稿を編集しました（新しい投稿として再投稿しました）。",
  "my.delete.photoUnconfirmed": "投稿は削除しましたが、写真の削除を確認できませんでした（数分後に消える場合があります）。",
  "my.delete.failed": "削除できませんでした。時間をおいて再試行してください。",
  "my.firstPost": "最初の1枚を置く",
  "my.loading.sr": "あなたの植物を読み込み中…",
  "my.delete.confirm.q": "写真ごと削除しますか？",
  "my.delete.confirm.note": "（元に戻せません）",
  "my.delete.confirm.yes": "削除",
  "my.delete.confirm.no": "やめる",
  "my.delete.deleting": "削除中…",

  // ホーム（index）ヒーロー。世界観文言＝直訳でなく意訳前提（en.ts 参照）。
  "home.hero.title": "育てて、見せる。",
  "home.hero.lead": "植物写真のSNS。Instagram より、はやくかんたんに、ひとこと添えて。畑もビカクも実生も、この一画に。",
  "home.hero.sub": "ここは Hanōba に置かれた植物のタイムライン。Nostr 全体の植物は{link}へ。",
  "home.hero.sub.link": "みんなの植物",

  // 投稿フローティングボタン（PostFAB）。
  "fab.compose.aria": "投稿する",

  // サイト既定メタ（MainLayout）。
  "site.description": "植物写真のSNS。Instagram より、はやくかんたんに、ひとこと添えて。",

  // 各ページのメタ（<title> / <meta description>・SEO・OGP）。
  "meta.about.title": "Hanōba とは — 架空の植物都市",
  "meta.about.description": "Hanōba は植物写真の SNS。架空の植物好き都市ハノーバを、みんなで育てる場所です。",
  "meta.compose.title": "投稿する — Hanōba",
  "meta.discover.title": "みんなの植物 — Hanōba",
  "meta.discover.description": "Nostr 全体の植物（#plantstr）と、Hanōba の投稿をまとめて眺める。",
  "meta.me.title": "あなたの植物 — Hanōba",
  "meta.me.description": "あなたが Hanōba に置いた植物の一覧。ここから投稿を削除できます（写真ごと）。",
  "meta.ranking.title": "人気ランキング — Hanōba",
  "meta.ranking.description": "Hanōba の投稿から、いま人気の品種を週次で集計。先週比（↑↓・NEW・RE）つき。",
  "meta.u.title": "市民のプロフィール — Hanōba",
  "meta.u.description": "Hanōba の市民の公開プロフィール。置いた植物と活動スタッツ（投稿・写真・育てた品種・居住日数）を眺める。",
  "meta.vote.title": "住民投票 — ハノーバ市役所",
  "meta.vote.description": "ハノーバ市役所の住民投票所。品種の並び順・欲しい機能・バグ報告を、掲示板で気軽に。名前は任意。",

  // 各ページ本体のリード文（h1 は既存ナビキーを再利用）。
  "discover.lead": "Nostr 全体の植物（#plantstr）と、Hanōba の投稿をまとめて眺めます。",
  "me.lead": "あなたが置いた1枚たち。削除すると、投稿と写真がいっしょに消えます。",
  // 原文は2文が改行＋字下げで分かれ JSX が1スペースに畳む＝ここでは半角スペース1つで繋ぐ。
  "ranking.lead": "Hanōba の投稿から、いま人気の品種を週ごとに集計します。先週との比較（↑↓・NEW・RE）つき。 みんなの投稿がそのままチャートを動かします。",

  // 住民投票ページ（vote・市長ボタニクスの声）。
  "vote.h1": "住民投票",
  "vote.intro": "おっほん。ここは住民投票所だ。市政に物申したい諸君、遠慮はいらぬ。名乗らずとも一票は一票。市長が必ず目を通す。",
  "vote.note": "※ 各欄は掲示板です。気軽に書き込めます（名前は任意）。",
  "vote.board.aria": "住民投票 — {title}",
  "vote.board.requests.title": "品種への要望",
  "vote.board.requests.intro": "品種に関する願いはすべてここへ。並び順、名簿に無い品種の追加、その他、遠慮はいらぬ。市長が必ず目を通す。",
  "vote.board.features.title": "欲しい機能",
  "vote.board.features.intro": "この市にあったらいい仕組みを請願せよ。市長が善処する（かもしれない）。",
  "vote.board.bugs.title": "バグ報告",
  "vote.board.bugs.intro": "市の不具合を見つけたら、ここへ。直ちに修繕隊を送る。",

  // 市民レベルの表示名（citizen.ts・#272）。Ln は {n} 補間。
  "citizen.level.traveler": "旅人",
  "citizen.level.citizen": "市民",
  "citizen.level.citizenN": "市民L{n}",

  // 活動スタッツ節（CitizenStats・#272）。見出しの主語 {subject} は自分=あなた/他人=表示名。
  "stats.subject.default": "この市民",
  "stats.activity.heading": "{subject}の活動",
  "stats.posts.label": "投稿",
  "stats.posts.unit": "件",
  "stats.photos.label": "写真",
  "stats.photos.unit": "枚",
  "stats.varieties.label": "品種",
  "stats.varieties.unit": "種",
  "stats.tenure.label": "居住",
  "stats.tenure.unit": "日",
  "stats.varieties.grown": "育てた品種",
  "stats.variety.filterTitle": "{label} でみんなの植物を絞る",

  // 緑の総面積（GreenArea・#310）。{subject}=主語・{n}=直近件数の上限。
  "green.heading": "{subject}が街に足した緑",
  "green.heading.note": "（1マス＝写真1枚・緑が多い写真ほど濃い）",
  "green.capped": "（直近{n}件）",
  "green.legend.low": "緑 少",
  "green.legend.high": "多",

  // 活動の草（ActivityHeatmap・#272）。連続記録は {n} を別途数値 span で出すので語のみ。
  "activity.heading": "活動の草",
  "activity.heading.note": "（横＝週・縦＝曜日・濃いほどその日の投稿が多い）",
  "activity.streak.current": "現在の連続",
  "activity.streak.longest": "最長",
  "activity.streak.days": "日",
  "activity.legend.low": "少",
  "activity.legend.high": "多",

  // 他人の公開プロフィール島（UserProfile・#272）。
  "profile.subject.default": "市民",
  "profile.notFound": "この市民のプロフィールが見つかりませんでした。",
  "profile.toDiscover": "みんなの植物へ",
  "profile.isMe": "これはあなたの公開プロフィールです（あなたの植物へ）",
  "profile.favorites": "好きな品種",
  "profile.loading.sr": "この市民の植物を読み込み中…",
  "profile.empty": "まだ、この市民の植物はありません。",

  // 投稿コンポーザー（Composer・島ルート・#147 段階2）。
  // アカウント名の促し（Composer→AccountName へ渡す promptLabel）。
  "compose.account.prompt": "はじめまして。ハンドルネームは？",
  // 写真セクション（見出し・枚数・上限案内・サムネ alt・並べ替え）。
  "compose.photos.heading": "写真",
  "compose.photos.count": "{count}/{max}枚",
  "compose.photos.limitNotice": "写真は4枚までです。追加できる分だけ追加しました。",
  "compose.photos.thumbAlt": "{n}枚目",
  "compose.reorder.left.aria": "選択中の写真を左へ移動",
  "compose.reorder.left": "左へ",
  "compose.reorder.right.aria": "選択中の写真を右へ移動",
  "compose.reorder.right": "右へ",
  "compose.reorder.counter": "{index}枚目 / 全{total}枚",
  // フィルタ節（Composer の見出し）。
  "compose.filter.heading": "フィルタ",
  // 撮影日節（#324）。
  "compose.shotDate.heading": "撮影日",
  "compose.shotDate.auto": "自動抽出しました。",
  "compose.shotDate.input.aria": "この写真の撮影日",
  "compose.shotDate.exclude": "撮影日を含めない",
  // 不足理由＋送信ボタン群。
  "compose.shortfall.name": "ユーザー名",
  "compose.shortfall.photo": "写真",
  "compose.shortfall.caption": "ひとこと",
  "compose.shortfall.lead": "あと ",
  "compose.shortfall.trail": "を入れると投稿できます",
  "compose.action.removeOne": "この写真を外す",
  "compose.action.resetImage": "写真を選び直す",
  "compose.submit.uploading": "写真を送信中 {done}/{total}",
  "compose.submit.publishing": "投稿中…",
  "compose.submit": "投稿する",
  // 投稿の結果メッセージ（done / error）。
  "compose.done": "投稿しました。あなたの植物へ移動します…",
  "compose.error.notConfirmed": "投稿を確認できませんでした。電波の良いところでもう一度お試しください（下書きは残っています）。",
  "compose.error.generic": "投稿に失敗しました。",
  "compose.error.imageLoad": "画像の読み込みに失敗しました。",

  // CropFrame（クロップ枠・回転・#314）。
  "crop.image.alt": "クロップ対象の写真",
  "crop.rotate.label": "回転",
  "crop.rotate.left90.aria": "写真を左に90度回転",
  "crop.rotate.left90": "左90°",
  "crop.rotate.fineLeft.aria": "0.5度 左へ",
  "crop.rotate.fineRight.aria": "0.5度 右へ",
  "crop.rotate.slider.aria": "角度の微調整（0.5度きざみ）",
  "crop.rotate.right90.aria": "写真を右に90度回転",
  "crop.rotate.right90": "右90°",
  "crop.dragHint": "枠をドラッグして位置を決めてください。",

  // CaptionInput（一言入力・ハッシュタグ補完・#165）。
  "caption.label": "ひとこと",
  "caption.placeholder": "株のこと。ひとことでも、じっくりでも。#アガベ のようにタグも。",
  "caption.suggest.aria": "ハッシュタグ候補",

  // FilterChips（フィルタ強度チップ・#171）。
  "filter.strength.none": "なし",
  "filter.strength.weak": "弱",
  "filter.strength.medium": "中",
  "filter.strength.strong": "強",
  "filter.group.aria": "フィルタを重ねる",
  "filter.chip.aria": "{name}（{strength}）",

  // ImagePicker（画像の選択・撮影/アルバム・#29）。
  "picker.shoot": "撮影",
  "picker.album": "アルバム",
  "picker.hint": "植物の写真を撮るか、アルバムから選んでください。最大4枚まで。",
  "picker.error.notImage": "画像ファイルを選んでください（動画は投稿できません）。",
  "picker.error.limit": "写真は4枚までです。",
  "picker.add.aria": "写真を追加",
  "picker.camera.aria": "カメラで撮影",
  "picker.gallery.aria": "アルバムから選ぶ",

  // TagPicker（タグピッカー・ドリルダウン・検索・#22/#312）。
  "tag.heading.filter": "品種で絞る",
  "tag.heading.compose": "タグを選ぶ",
  "tag.fromPlants": "植物から選ぶ",
  "tag.breadcrumb.root": "植物",
  "tag.group.recent": "最近使った",
  "tag.group.popular": "人気",
  "tag.overflow.button": "その他",
  "tag.overflow.aria": "{label}のその他のタグ",
  "tag.overflow.count": "{label}（ほか{n}件）",
  "tag.overflow.dialog.aria": "{label}のタグ一覧",
  "tag.overflow.close.aria": "タグ一覧を閉じる",
  "tag.request": "この植物が無い → 追加をリクエスト",
  "tag.back.aria": "一つ前に戻る",
  "tag.back": "‹ 戻る",
  "tag.close.aria": "ドリルダウンを閉じる",
  "tag.search.aria": "タグを検索",
  "tag.search.placeholder": "品種・属を検索（例: チタノタ）",
  "tag.dict.loading": "辞書を読み込み中…",
  "tag.dict.error": "辞書を読み込めませんでした。もう一度お試しください。",
  "tag.noResults": "該当なし",
  "tag.category.label": "カテゴリ",
  "tag.useFreeform": "そのまま #{tag} を使う",
  "tag.useCategory": "#{label} をこのまま使う",
  "tag.useGenus": "#{name} をこのまま使う",

  // アカウント名（AccountName・表示/編集/nsec 取り込み・#28/#22/#92/#104）。
  "account.handle.unset": "ハンドルネーム 未設定",
  "account.name.clear": "入力をクリア",
  "account.name.import.label": "お持ちのアカウントで続ける",
  "account.name.import.placeholder": "nsec1… を貼り付け",
  "account.name.import.aria": "nsec 秘密鍵",
  "account.name.import.error.invalid": "nsec が正しくありません。`nsec1…` を貼り付けてください。",
  "account.name.import.help": "mypace 等で使っているアカウントで続けられます。情報はこの端末にだけ保存されます。",
  "account.name.import.cancel": "やめる",
  "account.name.import.submitting": "確認中…",
  "account.name.import.submit": "続ける",
  "account.name.edit.placeholder": "ハンドルネーム（あとで変えられます）",
  "account.name.edit.aria": "ハンドルネーム",
  "account.name.edit.save": "保存",
  "account.name.edit.hint": "ハンドルネームを決めると、見るだけでなく投稿できます。",
  "account.name.edit.haveAccount": "すでにアカウントをお持ちですか？",
  "account.name.set": "ハンドルネームを設定",
  "account.name.change": "ハンドルネームを変更",
  "account.name.changeAccount": "アカウントを変更",

  // プロフィール編集（ProfileEditor・アイコン/自己紹介/サイト/秘密鍵・#35/#104/#188/#213）。
  "account.profile.heading": "プロフィール",
  "account.profile.sub": "アイコン・自己紹介・サイト",
  "account.profile.edit": "編集",
  "account.profile.icon.label": "アイコン",
  "account.profile.icon.uploading": "アップロード中…",
  "account.profile.icon.pick": "画像を選ぶ",
  "account.profile.icon.remove": "削除",
  "account.profile.icon.urlPlaceholder": "または画像 URL を貼る（https://…）",
  "account.profile.icon.urlAria": "アイコン画像 URL",
  "account.profile.icon.uploadError": "画像をアップロードできませんでした。時間をおいて再試行してください。",
  "account.profile.about.label": "自己紹介",
  "account.profile.about.placeholder": "育てている植物のこと、好きな品種など",
  "account.profile.sites.label": "サイト・SNS",
  "account.profile.sites.hint": "拡大写真の著者欄にアイコンで並びます。各人が自分のサイトへ誘導できます。",
  "account.profile.sites.urlPlaceholder": "https://…",
  "account.profile.sites.urlAria": "サイト {n} の URL",
  "account.profile.sites.clearAria": "サイト {n} をクリア",
  "account.profile.sites.moveUpAria": "サイト {n} を上へ",
  "account.profile.sites.moveDownAria": "サイト {n} を下へ",
  "account.profile.sites.removeAria": "サイト {n} を削除",
  "account.profile.sites.add": "＋ サイトを追加",
  "account.profile.nameMissing": "先に上でハンドルネームを設定してください。",
  "account.profile.saved": "保存しました。",
  "account.profile.saveError": "保存できませんでした（端末には保存済み）。",
  "account.profile.saving": "保存中…",
  "account.profile.save": "保存",
  "account.profile.nsec.label": "秘密鍵（バックアップ）",
  // 原文は2文が改行＋字下げで分かれ JSX が1スペースに畳む＝ここでは半角スペース1つで繋ぐ。
  "account.profile.nsec.warning": "この鍵を控えておかないと、端末を変えたりブラウザのデータを消すと二度と戻せません。 また、この鍵を知られると、あなたの投稿をすべて操作されます。人に見せたり貼り付けたりしないでください。",
  "account.profile.nsec.codeAria": "秘密鍵（nsec）",
  "account.profile.nsec.hideAria": "秘密鍵を隠す",
  "account.profile.nsec.showAria": "秘密鍵を表示する",
  "account.profile.nsec.hide": "隠す",
  "account.profile.nsec.show": "表示",
  "account.profile.nsec.copyAria": "秘密鍵をコピーする",
  "account.profile.nsec.copy": "コピー",
  "account.profile.nsec.copied": "コピーしました",

  // 好きな品種ピッカー（FavoriteVarietyPicker・#141）。多くは tag.* / profile.* を再利用。
  "account.favorites.hint": "プロフィールに並びます。同じ品種が好きな人と見つけ合えます。",
  "account.favorites.removeAria": "{name} を好きな品種から外す",
  "account.favorites.search.aria": "品種を検索",
  "account.favorites.dict.empty": "—",
  "account.favorites.useFreeform": "そのまま「{freeform}」を追加",
} as const;

/** 全文言キーの union（ja を単一ソースに型を導出する）。 */
export type MessageKey = keyof typeof ja;
