# vimgram へのコントリビュート

[English version](./CONTRIBUTING.md)

最も簡単で歓迎されるコントリビュートは**問題（Challenge）の追加**です。
TypeScript を書く必要はありません。JSON ファイルを1つ置くだけで、Vitest が
自動的に検証します。`pnpm vitest run` が通れば、その問題は正しく動作します。

## 問題を追加する手順

1. id を決め（例: `level2-my-challenge`）、
   `challenges/level2-my-challenge.json` を作成します。最も簡単な方法は、
   `challenges/` にある似た形の既存ファイルをコピーして編集することです。
2. 先頭の `"$schema": "./schema.json"` は残してください。VS Code など
   多くのエディタで、以降すべてのフィールドに補完と検証が効くようになります。
3. `examples[0]` に、`initial` から `expected` まで実際に解ける
   キー列を書きます。これは単なるドキュメントではなく、その問題自身の
   想定解であり、CI で実際にエンジンに通されます。
4. ローカルでチェックを実行し（下記参照）、通れば PR を送ってください。

手順はこれだけです。誰かが手動であなたの問題を解き直してレビューすることは
ありません — 正しさの担保は自動チェックが行います。人間によるレビューは
お題文が自然かどうかの確認だけです。

## Challenge のフィールド

```ts
type Challenge = {
  id: string; // 一意、kebab-case、例: "level2-df-comma"
  title: LocalizedText; // 問題一覧に表示される短い名前
  prompt: LocalizedText; // プレイヤーに表示される指示文
  initial: { text: string; cursor: number; mode: "normal" };
  expected: {
    text: string; // 常に比較される
    cursor?: number; // 定義されている場合のみ比較
    mode?: "normal" | "insert"; // 定義されている場合のみ比較
    yankRegister?: string; // 定義されている場合のみ比較
  };
  constraints?: { timeLimitSec: number };
  hints?: LocalizedText[];
  examples: string[]; // examples[0] は必須: 想定解
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
};

type LocalizedText = { en: string; ja?: string }; // en 必須、ja は任意
```

- `initial.cursor` は `f`/`t` 等のモーションがカーソル位置に依存するため、
  カーソルの初期位置を必ず明示してください。
- `expected` はそのお題に必要なフィールドだけを書けば十分です。ほとんどの
  お題は `text` だけで足ります。`y` 系のお題なら `yankRegister`、
  `<Esc>` まで打つ `c` 系のお題なら `mode: "normal"`、着地位置そのものが
  学習ポイントの場合のみ `cursor` を追加してください。
- `examples[0]` は `idealKeyCount`（Great/冗長クリアの判定基準）の算出にも
  使われます。別フィールドとして保存されるのではなく、このフィールドの
  キー数から導出されます。`<Esc>` 等の書き方は下記「キー表記」を参照。
- バッファテキスト（`initial.text` / `expected.text`）は、言語に関係なく
  **常に ASCII のコード風テキスト**にしてください（下記
  「バッファテキストは翻訳しない」を参照）。

### `examples` 内のキー表記

印字可能な文字はそのまま書きます（`d`, `f`, `,`, `"` など）。特殊キーは
Vim 風の山括弧で表記します: Escape は `<Esc>`、Backspace は `<BS>`。
例えば `ci"jiro<Esc>` は `c`, `i`, `"`, `j`, `i`, `r`, `o`, `<Esc>` の
8キーです。

### バッファテキストは翻訳しない

`initial.text` と `expected.text` は、問題文がどの言語で書かれていても、
常に ASCII のコード風テキストにします。これにより単語境界判定・カーソル
計算・描画がシンプルに保たれ、実務で Vim が実際に編集する対象（コードや
英文）にも近くなります。翻訳対象になるのは `title` / `prompt` / `hints`
だけです。

## 良い問題の条件

- **比較学習ペアは特に歓迎します。** このゲームの核はオペレータ＋モーションの
  直感を鍛えることであり、`f` と `t`、`iw` と `aw` の違いを学ぶ最良の方法は、
  *同じ*バッファを両方の方法で解いて違いを目で見ることです。ペアの片方
  （例: `df,`）を追加する際は、同じ `initial` を使った `dt,` 版も
  一緒に追加することを検討してください。
- バッファは短く、1つのモーション/オペレータの概念に焦点を絞ってください。
- 既存の難易度カーブに沿った `difficulty` を選んでください（詳細は
  CLAUDE.md の「難易度カーブ」を参照、または似たタグの既存問題を参考に）:
  - 1: 単純な削除（`dw`, `d$`, `df,`, `x` など）
  - 2: `f` と `t` の判別
  - 3〜4: テキストオブジェクト（`iw`/`aw`, `i"`/`a"`, `i)`/`a)`）、
    `c` + Insert mode
- `tags` は自由記述です。同じ概念には既存のタグ（`delete`, `yank`,
  `change`, `find`, `till`, `word`, `quote`, `paren`, `textObject`,
  `comparison`, `count` など）を再利用し、新しいタグを乱立させないで
  ください。

## 翻訳ポリシー

すべての `LocalizedText` フィールドで `en` は必須、`ja` は任意です。
`en` だけの問題を投稿しても構いません（日本語から書きたい場合も、型上
`en` は必須なので、簡単な英語版だけは用意してください）。`ja` の欠落は
CI エラーになりません。ゲームは実行時に `en` へフォールバックし、
翻訳の補完はメンテナが順次行います。翻訳がコントリビュートの障壁に
ならないようにしています。

## 開発セットアップ

- Node 22（`.node-version` を参照。`mise` や `nvm` 等のバージョン
  マネージャを使っていれば自動的に検出されます）
- パッケージマネージャ: `pnpm`

```bash
pnpm install
pnpm dev          # ローカル開発サーバ
pnpm vitest run   # ユニットテスト + 問題データの自動検証
pnpm tsc --noEmit # 型チェック
pnpm biome check . # lint/format
```

CI は PR ごとに上記と同じ `vitest run` / `tsc --noEmit` / `biome check .`
の3つを実行します。ローカルで通れば CI でも通ります。

## JSON Schema の再生成

`src/core/challenges.ts` の Zod スキーマを変更した場合は、
`challenges/schema.json` を再生成してください:

```bash
pnpm run schema
```

手順はこれだけです。スクリプト自身が出力をフォーマットまで済ませます。
CI では `challenges/schema.json` がこのコマンドの生成結果と一致しているかを
検証しているため、再生成を忘れると `biome check` ではなく
`pnpm vitest run` の方で落ちます。

## コードのコントリビュート

問題追加以外の変更（エンジン・UI 等）については、まず Issue を立てて
方針を相談してください。`CLAUDE.md` にプロジェクトの設計方針と現在の
スコープが詳しくまとまっています。
