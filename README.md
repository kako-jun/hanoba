# hanoba（葉の場 / Hanoba）

植物専用の正方形写真SNS。1投稿 ＝ 正方形写真1〜4枚 ＋ 一言（必須）。

自前のバックエンドを持たない（バックエンドレス）。状態は全て Nostr（クライアント側）に乗る。
フロントエンドは Astro（静的生成）＋ React islands ＋ PWA。

## 開発

```sh
npm install     # 依存をインストール
npm run dev     # 開発サーバー（http://127.0.0.1:4321）
npm run build   # 静的ビルド（dist/ を生成）
npm run typecheck  # astro check（型チェック）
npm test        # テスト（vitest）
```

Node は `>=20.3.0`（`.nvmrc` は 22）。

## デプロイ

Cloudflare Pages（Git 連携で自動ビルド）。`output: "static"` で `dist/` をそのまま配信する。

## 設計

詳細な設計・規律・Nostr 契約・デザインシステムは [`DESIGN.md`](./DESIGN.md) を参照。
