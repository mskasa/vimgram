# CLAUDE.md

**vimgram**（Vim + grammar）の開発ガイド。Claude Code はこのファイルを読んでからコードに触れること。

## プロジェクト概要

vimgram は、お題（プロンプト）が出題され、制限時間内に該当する Vim 操作を行ってクリアする Web ゲーム。

このプロジェクトの目的は **Vim の完全再現ではない**。「編集したい範囲をモーションとして捉える訓練」、つまり `operator + motion` という Vim の編集文法を身体に入れることが目的である。実装判断に迷ったら、常に「オペレータ＋モーションの練習に必要な最小限の Vim サブセット」に倒すこと。

学習体験の核となるループ：

1. お題を見る
2. 編集後の状態をイメージする
3. 最短に近い operator + motion を選ぶ
4. 実行する
5. 結果を見る
6. より良い操作を知る

## 技術スタック

- TypeScript + React + Vite
- Node: 22（`.node-version` で固定。CI と Cloudflare Pages のビルド設定もこれに合わせる）
- パッケージマネージャ: **pnpm**
- 状態管理: React state のみ（MVP では Zustand 等は導入しない）
- テスト: Vitest
- Lint / Format: **Biome**（ESLint + Prettier は使わない）
- エディタ表示: 自作（CodeMirror は将来検討。CodeMirror の Vim mode に任せる設計は採らない — ゲーム側で入力を解釈・採点・解説する必要があるため）
- デプロイ: Cloudflare Pages（詳細は「デプロイ」セクション参照）
- ライセンス: **MIT**

## ディレクトリ構成

単一リポジトリ。コア（Vim 操作エンジン）は React から完全に独立させる。

```
challenges/        # 問題データ（1問1ファイルの JSON）。コントリビュートの入口
src/
  core/            # React 非依存。DOM に触れない純粋な TS
    buffer.ts      # バッファ状態と更新
    parser.ts      # キー入力 → コマンドの状態機械
    motions.ts     # モーションの解決（対象範囲の計算）
    operators.ts   # オペレータの適用
    execute.ts     # parse 結果をバッファに適用
    judge.ts       # 正誤判定・評価（クリア/最短級/冗長）
    challenges.ts  # Challenge の Zod スキーマ定義と JSON の読み込み・検証
    levels.ts      # Level は Challenge.difficulty から導出（スキーマに level フィールドは持たない）
    progress.ts    # Attempt 履歴からクリア/Great 状況を導出
  app/
    components/    # UI コンポーネント
    pages/
```

**ルール: `src/core/` から React・DOM・`src/app/` を import してはならない。** テスト容易性がこのプロジェクトで最重要であり、コアはすべて純関数ベースで書く。

画面遷移はルーターを導入せず、`GamePage` が持つ `screen: "menu" | "game" | "summary"` の判別可能ユニオンで切り替える（`src/app/pages/MenuScreen.tsx` / `LevelRound.tsx` / `LevelSummaryScreen.tsx`）。メニュー → レベル選択 → そのレベルの出題 → レベル別サマリ → メニュー、という一方向の流れのみで、URL ルーティング（レベル直リンク等）は Phase 3 以降の検討事項とする。

### UI 操作

**全画面がキーボードのみで操作可能であることを維持する。** 新しい画面・ダイアログを追加する際はキー操作を必ず定義すること。画面ごとのキー割り当ては `src/core/keymap.ts` に集約し（`resolveMenuKey` / `resolvePlayingKey` / `resolveResultKey` / `resolveSummaryKey`）、「どの画面がどのキーを持つか」が1箇所で見渡せる状態を保つ。

**画面遷移・操作の第一級の導線はキーボードとする。** マウス導線はキーヒント（`src/app/components/KeyHint.tsx` の「キーキャップ」表示）のクリックとして提供し、独立したボタンは置かない。ただし選択肢の集合（レベルカード等）は通常のクリック/タップ対象としてよく、クリックは選択と確定の同時実行として扱う。キーキャップへの一本化の対象は、キー操作と1対1で重複する単一の確定操作のみ。キーキャップはキー入力と同じアクションを発火するだけの薄い配線であり、見た目もボタンではなくキー表示を主役にする（クリック可能であることの主張はホバー/フォーカス時の変化程度に留める）。

**コンテンツ最大幅は 1200px・中央寄せとする。** ヘッダーの背景バーなど全幅の要素があっても、内容自体は `.vg-container`（`src/index.css`）で 1200px に揃える。

**暖色アクセント（`--accent` / `--warn-star` 系）は選択中・主キー・Star・Great のみに使用する。** 地の色は藍〜菫系トークン（`--bg-*` / `--border-*` / `--text-*`、いずれも `src/index.css` の CSS カスタムプロパティ）から選ぶこと。新しい色をハードコードしないこと。

## MVP 仕様（確定事項）

- Web アプリ
- **1行バッファのみ**（複数行は Phase 3 まで実装しない）
- 判定: **最終テキスト一致**（期待コマンド完全一致にはしない）
- 評価: クリア / 最短級（Great） / 冗長クリア の3段階
- 問題数: 30問超（現在 33問）
- タイマーあり
- 失敗時に想定コマンドと解説を表示

### 実装済みスコープ

- Normal mode + Insert mode（**`c` 経由のみ**。`i`/`a` 単体での Insert mode 突入は未実装 — 下記「スコープ外」参照）
- オペレータ: `d`, `y`, `c`（単体操作として `x`）
- モーション: `h`, `l`, `w`, `e`, `b`, `0`, `$`, `f{char}`, `t{char}`
- テキストオブジェクト: `iw`/`aw`, `i"`/`a"`, `i'`/`a'`, `i)`/`a)`（count 付きは非対応。`2diw` 等は `f`/`t` の対象文字なしと同じ「コマンド全体が不成立」として parser レベルで扱う）
- 解説システム（オペレータ＋モーション＋挿入テキスト＋`<Esc>` の分解表示、en/ja）
- i18n 基盤（en/ja 辞書 + フォールバック、ブラウザ言語判定 + 手動トグル + localStorage 永続化）
- スコアリング・Attempt 記録（localStorage、詳細は「スコアリングと記録」参照）
- メニュー画面・レベル選択（Level は Challenge.difficulty から導出、クリア状況は Attempt 履歴から導出）
- 全画面のキーボード操作（詳細は「UI 操作」参照）

### スコープ外（Phase 3 以降）

- 複数行、`j`/`k`
- 段落テキストオブジェクト（`ip`/`ap`）— 複数行対応とセットでのみ実装可能なため、`i]`/`i}` 等の追加対象とは切り離して検討する
- `i]`/`i}` 等の追加テキストオブジェクト対象（`iw`/`i"`/`i)` と同じ scope×target 合成設計で追加コスト自体は低いが、公開に必須ではないため未着手）
- idle 中の `i`/`a`（Insert mode への単体突入）。実装する場合は「空の change」ではなく専用の single コマンドとして実装し、`insert.ts` を再利用する方針とする（`i` はカーソル位置のまま、`a` はカーソル+1 してから Insert 遷移）。`A`/`I`/`o`/`O` 等とまとめて検討する
- Visual mode、`dd`/`yy`、`p`、`.`（repeat）
- レジスタ指定、マクロ、`:` コマンド
- 弱点分析ダッシュボード（タグ別成功率など）。Attempt 記録を貯める設計は完了しているが、分析表示は記録が貯まってから別途検討する

## コアのデータモデル

### バッファ

```ts
type BufferState = {
  text: string;
  cursor: number; // 0-based。カーソルは「文字の間」ではなく「文字上」にある
  mode: "normal" | "insert";
  yankRegister?: string;
};
```

### コマンド文法とパーサ

対象文法: `[count] operator [count] motion`（例: `d2w`, `2dw`, `3df,`）

入力は1キーずつ受け取り、状態機械で解析する：

```ts
type InputState =
  | { phase: "idle"; countBuffer: string }
  | { phase: "operatorPending"; operator: string; countBuffer: string }
  | { phase: "charMotionPending"; operator: string; motion: "f" | "t" };
```

`f`/`t` は次の1文字を待つ pending 状態を持つ（`d` → operatorPending、`df` → charMotionPending、`df"` → 実行）。

パース結果の型：

```ts
type ParsedCommand =
  | { type: "operatorMotion"; operator: "d" | "c" | "y"; count?: number; motion: Motion }
  | { type: "single"; command: "x"; count?: number };
```

### Vim セマンティクスの注意点

- `f{char}` は対象文字を**含んで**移動（inclusive）、`t{char}` は対象文字の**手前まで**（exclusive）。オペレータと組み合わせたときの削除範囲もこれに従う
- `f` は「現在位置の次」から対象文字を探す。カーソル位置に依存するため、お題側でカーソル初期位置を必ず明示する
- 迷ったら実際の Vim の挙動を正とする（対象サブセット内に限る）

## お題（Challenge）の定義

```ts
type LocalizedText = {
  en: string;  // 必須
  ja?: string; // 任意。欠けていれば en にフォールバック
};

type Challenge = {
  id: string;
  title: LocalizedText;
  prompt: LocalizedText;
  initial: { text: string; cursor: number; mode: "normal" };
  expected: {
    text: string;
    cursor?: number;
    mode?: "normal" | "insert";
    yankRegister?: string;
  };
  constraints?: {
    timeLimitSec: number;
    allowedOperators?: string[];
    allowedMotions?: string[];
    maxKeys?: number;
    requireInsertMode?: boolean;
  };
  hints?: LocalizedText[];
  examples?: string[]; // 想定コマンド例（判定には使わない。解説と CI 検証に使う）
  tags: string[];
  difficulty: 1 | 2 | 3 | 4 | 5;
};
```

### バッファテキストは翻訳しない（重要）

`initial.text` / `expected.text`（編集対象のテキスト）は **言語に関係なく ASCII のコード風テキストに統一**する。日本語をバッファに入れてはならない。理由：

- Vim で実際に編集するのはコードや英文であることが多く、練習素材として自然
- CJK 文字を許すと `w` の単語境界判定・文字幅の描画・カーソル位置計算が複雑化し、「最小限の Vim サブセット」という前提が崩れる

翻訳対象は `title` / `prompt` / `hints` のみ。

### 保存形式とバリデーション

- 問題は **1問1ファイルの JSON** として `challenges/` に置く（TS を書けない人もコントリビュートできるようにするため）
- スキーマは `src/core/challenges.ts` に **Zod** で定義し、TS 型はそこから導出する。JSON Schema も書き出し、エディタ補完に使えるようにする
- `examples[0]` は「その問題の想定解」であり、必須とする。CI 検証と `idealKeyCount` の算出に使う（下記「問題データの自動検証」参照）
- 翻訳は **`en` 必須・`ja` 任意**。`ja` の欠落は CI エラーにせず、欠落一覧のレポートとして出力する（コントリビュートの参入障壁を上げないため。翻訳はメンテナ側で後から埋める運用）

## 正誤判定と評価

判定の基本は最終状態の一致（同じ結果に至るコマンドが複数あるため、コマンド列一致では判定しない）：

- **クリア**: `text === expected.text`（必要に応じて cursor / mode / yankRegister も比較）
- **最短級（Great）**: クリアかつ `keys.length <= idealKeyCount`
- **冗長クリア**: 結果は正しいがキー数が多い。「よりVimらしい操作」として想定コマンドを提示する

`df"` でも `xxxxxx` でも結果が同じなら両方クリア扱いとし、後者には短い操作を教える。**暗記クイズにしないこと。**

正解後は想定コマンドを分解して解説する：

```
df, = d + f,
d: 削除オペレータ
f,: 次の , まで移動（, を含む）
```

**答えを知る正規ルートはギブアップ（敗北として記録）のみとする。** コストなしで想定コマンドを閲覧できる導線を作らないこと。ギブアップはプレイ中いつでも発動でき（残り時間による出し惜しみはしない）、時間切れと同じ失敗扱い（`Attempt.success = false`、streak リセット）としつつ、`Attempt.revealed = true` で「時間切れ」と区別する。リザルト画面・解説表示は時間切れと共通で、見出し文言のみ変える。

## スコアリングと記録

```ts
score = 1000
  + remainingTimeMs * 0.1
  + Math.max(0, idealKeys - actualKeys) * 100
  + streak * 50
  - mistakes * 100;
```

- `mistakes`: そのお題の挑戦中に発生した「不成立コマンド」（`f`/`t` の対象文字なし、テキストオブジェクト解決失敗など、`found: false` で終わった操作）の回数
- `streak`: 連続クリア数（クリア・冗長クリアいずれも対象）。失敗・時間切れ・ギブアップでリセットする
- `idealKeys` は `idealKeyCount`（examples[0] のトークン数）から導出する。実装は `src/core/score.ts`

スコアより復習しやすさを優先。試行ごとに記録を残す：

```ts
type Attempt = {
  challengeId: string;
  input: string;
  success: boolean;
  elapsedMs: number;
  keyCount: number;
  mistakeCount: number;
  usedCommandTypes: string[];
  revealed?: boolean; // ギブアップ（答えを見た）で終了した
  skipped?: boolean;  // スキップ（解説なしで次へ）で終了した
};
```

`revealed`/`skipped` はどちらも省略可能な追加フィールドで、保存済みデータとの互換性のためスキーマバージョンは上げない（欠落 = false として扱う）。将来的に「t 系モーションが苦手」等の弱点フィードバックに使う。型定義とローカルストレージへの記録は `src/core/attempt.ts` / `src/app/attemptStorage.ts` を参照。

## 実装順序

1. **1行バッファ + カーソル移動**（`h`, `l`, `0`, `$`）— ✅ 完了
2. **`x` と `d` + 基本モーション**（`dw`, `d$`, `df,`, `dt,`）— ✅ 完了（ここでゲームとして成立）
3. **お題システム**（initial / expected / timeLimit / tags / difficulty、結果一致判定）— ✅ 完了
4. **解説システム**（コマンド分解表示）— ✅ 完了
5. **`c` と Insert mode**（`ciw`, `ci"` + `<Esc>` で Normal 復帰）— ✅ 完了（Phase 2）
6. **テキストオブジェクト**（`iw`, `aw`, `i"`, `a"`, `i)`, `a)`）— ✅ 完了（Phase 2〜3）
7. **スコアリング・Attempt 記録**（localStorage）— ✅ 完了
8. **メニュー画面・レベル選択**（menu/game/summary の画面遷移、Level 別クリア状況）— ✅ 完了
9. **全画面のキーボード操作**（メニュー/リザルト/サマリのキー割り当て、`src/core/keymap.ts`）— ✅ 完了
10. **ギブアップ**（`?` で敗北記録 + 解説表示、`skip` との使い分け）— ✅ 完了
11. **トワイライトテーマ**（CSS カスタムプロパティによるデザイントークン、`.vg-container` によるレイアウト統一）— ✅ 完了

`c` は「対象範囲を削除 → `mode = insert` に遷移」として実装した。Insert mode 中の文字入力と `<Esc>` はこのステップで導入した。

## 難易度カーブ（問題設計の指針）

- Level 1: 単純削除（`dw`, `de`, `d$`, `df,`, `dt,`, `x`）
- Level 2: 文字検索系（`df"` vs `dt"` の違いを体で覚える）
- Level 3: 単語・範囲（`diw`, `daw`, `ciw`, `caw`）
- Level 4: 引用符・括弧（`di"`, `da"`, `ci"`, `di)` など）
- Level 5: 複合操作（`dt,x`, `ci"hello<Esc>`, `yi)` など複数コマンド許可）

「比較学習」問題を重視する（同じ初期テキストで `df,` と `dt,`、`diw` と `daw`、`ci"` と `ca"` を対比させる出題）。

## テスト方針

- 最重要テスト対象は `src/core/`（parser / motions / operators / execute / judge）
- モーションごとに境界ケースを網羅する: 行頭・行末、対象文字が見つからない場合、count 付き、`f`/`t` の inclusive/exclusive 差
- テストは「キー列 → 期待するバッファ状態」の形式で書くと Challenge 定義と対称になり読みやすい
- UI のテストは後回しでよい。コアが正しければゲームは成立する

### 問題データの自動検証（コントリビュートの品質担保）

`challenges/` 配下の全 JSON に対して、Vitest で以下を機械的に検証するテストを常備する：

1. Zod スキーマに適合すること（ID 重複がないことを含む）
2. `execute(initial, examples[0])` の結果が `expected` に一致すること（＝想定解で実際に解けること）
3. `idealKeyCount` が `examples[0]` のキー数と一致すること

この検証があるため、問題追加 PR は「CI が通れば動作は保証済み」となり、レビューはお題文の自然さの確認だけで済む。**問題を追加・修正したら、必ずこのテストが通ることを確認すること。**

## デプロイ・CI

デプロイ先は **Cloudflare Pages**（Git 連携による自動デプロイ）。

- main へのマージで本番デプロイ、PR ごとにプレビューURLが自動発行される
- CI（GitHub Actions）は PR 時に `vitest run`、`tsc --noEmit`、`biome check` を実行する（問題データの自動検証は Vitest に含まれる）。デプロイ自体は Cloudflare 側の Git 連携に任せ、Actions からはデプロイしない
- ビルドコマンドは `pnpm run build`（`vite build`）、出力ディレクトリは `dist/`

### 静的サイトの前提を崩さないこと

**MVP〜Phase 2 の間、vimgram は完全な静的サイトとして設計する。** サーバーサイドの処理（API、SSR、DB）を導入してはならない。

- 問題データ（`challenges/` の JSON）はビルド時にバンドルへ含める
- 学習履歴（Attempt）は localStorage に保存する
- ユーザー間ランキングやクラウド同期など、バックエンドが必要な機能は Phase 3 以降の検討事項とし、その際は Pages Functions / Workers を候補とする（Workers 無料プランのクォータ: 1日10万リクエストに注意）

無料枠の制約（月500ビルド、20,000ファイル/サイト）は本プロジェクトの規模では実質問題にならないが、CI の設計でビルドを無駄に多発させないこと。

## コミュニティ・コントリビュート

### GitHub Star ボタン

- **自作ボタン + GitHub REST API** で実装する（`buttons.github.io` の公式ウィジェットは使わない。iframe の見た目が vimgram の UI に馴染まないため）
- スター数は `https://api.github.com/repos/<owner>/vimgram` から取得し、**localStorage に数時間キャッシュ**する（未認証 API は IP あたり毎時60リクエストの制限があるため、毎回取得しない）。取得失敗時はスター数非表示で、リンクだけのボタンとして成立させる
- 配置: ヘッダーに常設。問題ごとのクリア画面では**毎回表示しない**こと。レベル一式の初クリア時のみ、そのレベルのサマリ画面に表示する（2周目以降は表示しない）

### 問題コントリビュートの導線（段階的に実装）

- **Phase 1（MVP）**: JSON + Zod スキーマ + 上記の自動検証。CONTRIBUTING.md に「問題を1問追加する手順」を具体例付きで書く（「この手順で JSON を置いて CI が通れば OK」と言い切れる状態にする）。翻訳ポリシー（en 必須・ja 任意、片方の言語だけで投稿可、翻訳はメンテナが補完する）も明記する
- **Phase 2 以降**: GitHub Issue Forms による問題提案テンプレート（PR を作れない人向け）
- **Phase 2〜3**: ゲーム内問題作成モード。エンジンで実際に解いて動作確認 → JSON 書き出し → GitHub の `new/main?filename=…&value=…` 形式 URL でファイル作成画面（フォーク＋PR 導線付き）へ誘導する

## 多言語対応（i18n）

対応言語は **英語（en）と日本語（ja）**。en がベース言語であり、ja が欠けている箇所はすべて en にフォールバックする。

### 方針

- **バッファテキストは翻訳しない**（「お題の定義」セクション参照）。翻訳対象は、お題文（title / prompt / hints）、UI 文字列、解説文、ドキュメントのみ
- **i18n ライブラリは導入しない**。UI 文字列は数が少ないため、辞書オブジェクト + フォールバックを自作する（react-i18next 等は過剰）
- 言語切り替えは、ブラウザ言語の自動判定 + 手動トグル（選択を localStorage に保存）。**URL パスによるロケールルーティングはしない**（静的サイトをシンプルに保つ）

### 解説文の扱い

解説システムが生成する文（例:「`d`: 削除オペレータ」「`f,`: 次の `,` まで移動」）も翻訳対象。オペレータ / モーションごとの説明辞書を `src/core/` に言語別で持ち、解説生成時にロケールを引数で受け取る。コアに UI の関心事を持ち込まないため、ロケール判定自体は app 側の責務とする。

### ドキュメント

- README / CONTRIBUTING は `README.md`（英語）+ `README.ja.md` の構成とする
- **CLAUDE.md は翻訳しない**。開発者向け内部ドキュメントとして日本語のまま維持する

## コーディング規約

- コアは純関数で書く（`(state, input) => newState`）。副作用・可変状態を持ち込まない
- 型は `type` で定義し、判別可能ユニオン（discriminated union）を活用する
- 新しいオペレータ / モーションの追加は motions.ts / operators.ts への追加で完結するようにし、parser 本体の分岐を肥大化させない
- Vim の挙動に関する非自明な判断（inclusive/exclusive 等）はコード内コメントで根拠を残す
- app 層の `useEffect` は依存配列を最小に保つ。頻繁に変わる値は ref で参照し、再スケジュール条件だけを依存に入れる（タイマー実装を参照）
- コールバック props を effect の依存に入れない設計を優先する。`useCallback` はメモ化された子への受け渡しか effect 依存でどうしても必要な場合のみ使い、理由のないメモ化はしない

## 設計判断の記録（ADR）

設計判断の経緯・却下した代替案は `docs/decisions/` の ADR（kizami で管理）を参照すること。本ファイルの記述を書き換えるような大きな設計変更を行う際は、必ず対応する ADR を追加してから変更すること。ADR は日本語で記述する（CLAUDE.md と同様、開発者向け内部ドキュメントの扱い）。
