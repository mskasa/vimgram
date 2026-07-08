# vimgram

[English version](./README.md)

**今すぐ遊ぶ: `<デプロイURL — Cloudflare Pages へのデプロイ後に記入>`**

vimgram は、Vim の `operator + motion` という編集文法を身体に入れるための
ブラウザゲームです。個々のコマンドを暗記するのではなく、テキストを見て
「これはモーションとして捉えられる」という感覚を鍛えることが目的です。

学習体験の核となるループ:

1. お題（編集内容の指示）を見る
2. 編集後のバッファをイメージする
3. そこに至る最短の `operator + motion` を選ぶ
4. 実行する
5. 結果を見る
6. より良い操作があれば、それを知る

## 特徴

- **判定は最終状態、コマンド完全一致ではない。** `df,` でも `xxxxxx` でも
  同じテキストになれば両方クリア扱いです。暗記すべき「唯一の正解キー列」は
  ありません。
- **3段階評価**: クリア / **Great**（想定キー数と同数か、それ以下） /
  クリア（冗長、より短い想定コマンドを提示）。
- **コマンド分解解説**: クリアするたびに、入力したキー列がオペレータ・
  モーション・（`c` の場合は）挿入テキストと `<Esc>` に分解され、それぞれに
  短い説明が付きます。日本語・英語どちらでも表示できます。
- **比較学習問題ペア**: 同じバッファを `f` と `t`、`diw` と `daw`、`ci"` と
  `ca"` などで解き比べることで、違いを読むのではなく体で覚えられます。

## 練習できる操作

- オペレータ: `d`（削除）, `y`（ヤンク）, `c`（変更、Insert mode へ遷移）、
  単体操作の `x`
- モーション: `h`, `l`, `w`, `e`, `b`, `0`, `$`, `f{char}`, `t{char}`
- テキストオブジェクト: `iw`/`aw`, `i"`/`a"`, `i'`/`a'`, `i)`/`a)`
- Insert mode（`c` 経由でのみ突入）、`<Esc>` で抜ける

すべて1行のテキストの上で完結します。複数行バッファ、Visual mode、
`.`（repeat）はまだ未実装です（詳細なスコープとロードマップは
`CLAUDE.md` を参照してください）。

## ローカル開発

Node 22（`.node-version` を参照）と `pnpm` が必要です。

```bash
pnpm install
pnpm dev          # ローカル開発サーバを起動
pnpm vitest run   # ユニットテスト + 問題データの自動検証
pnpm tsc --noEmit # 型チェック
pnpm biome check . # lint/format
```

`public/favicon.png` と `public/apple-touch-icon.png` は `public/favicon.svg`
から一度きり書き出した画像です（`npx sharp-cli` を使用、常設の依存追加はなし）。
元の SVG を変更した場合は以下で再生成してください:

```bash
npx sharp-cli -i public/favicon.svg -o public/favicon.png resize 32 32
# apple-touch-icon.png は同じ図形だが、背景の rect の rx を 0（角丸なし）に
# したもの。iOS 側で角丸が付与されるため。
```

## コントリビュート

問題の追加は JSON ファイル1つで、TypeScript を書く必要はありません。
手順は [CONTRIBUTING.ja.md](./CONTRIBUTING.ja.md)（[English](./CONTRIBUTING.md)）
を参照してください。問題のコントリビュート、特に比較学習ペアは大歓迎です。

## ライセンス

[MIT](./LICENSE)
