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

トップレベルの画面は `App.tsx` が持つ「ゲーム / プレイグラウンド」のタブ切り替えで、両方とも常時マウントしたまま `hidden` 属性で出し分ける（`active` プロパティで各画面が自分の keydown リスナーを止める。タブを行き来してもリザルト画面等の状態が失われないようにするため）。**プレイグラウンドはタイマー・判定・Attempt 記録なしの素振り場**で、解説を読む → 試す → リトライという学習ループの受け皿にする。リザルト画面から `p` キーでその問題の初期テキスト・カーソル位置を持ち込んで開ける。

### UI 操作

**全画面がキーボードのみで操作可能であることを維持する。** 新しい画面・ダイアログを追加する際はキー操作を必ず定義すること。画面ごとのキー割り当ては `src/core/keymap.ts` に集約し（`resolveMenuKey` / `resolvePlayingKey` / `resolveResultKey` / `resolveSummaryKey`）、「どの画面がどのキーを持つか」が1箇所で見渡せる状態を保つ。

**画面遷移・操作の第一級の導線はキーボードとする。** マウス導線はキーヒント（`src/app/components/KeyHint.tsx` の「キーキャップ」表示）のクリックとして提供し、独立したボタンは置かない。ただし選択肢の集合（レベルカード等）は通常のクリック/タップ対象としてよく、クリックは選択と確定の同時実行として扱う。キーキャップへの一本化の対象は、キー操作と1対1で重複する単一の確定操作のみ。キーキャップはキー入力と同じアクションを発火するだけの薄い配線であり、見た目もボタンではなくキー表示を主役にする（クリック可能であることの主張はホバー/フォーカス時の変化程度に留める）。

**例外: プレイグラウンド内の UI 操作（テキスト差し替え・リセット等）はクリック操作とテキスト入力フィールドで行い、キー割り当てをしない。** プレイ中のキーを全て Vim エンジンに渡す必要があり、UI 操作キーとの名前空間の衝突を避けられないため。この例外はプレイグラウンドに限定する。

**プレイグラウンドは左ステージ（プレイ画面と同一のバッファカード・入力表示）+ 右道具箱（テキスト設定・キー早見表）の2カラム。** 早見表は explain 辞書（`src/core/explain.ts`）から自動生成し、手書きの一覧を持たない。

**コンテンツ最大幅は 1200px・中央寄せとする。** ヘッダーの背景バーなど全幅の要素があっても、内容自体は `.vg-container`（`src/index.css`）で 1200px に揃える。

**暖色アクセント（`--accent` / `--warn-star` 系）は選択中・主キー・Star・Great のみに使用する。** 地の色は藍〜菫系トークン（`--bg-*` / `--border-*` / `--text-*`、いずれも `src/index.css` の CSS カスタムプロパティ）から選ぶこと。新しい色をハードコードしないこと。

**失敗系の判定色は `--miss`（黄昏のローズ、`#e58fb1`）を使う。** リザルトの時間切れ・ギブアップなど、失敗系の判定バナーにのみ使用する専用トークンで、それ以外の用途（警告一般、エラーメッセージ等）には流用しない。

**リザルトは判定バナー → 詳細カード → キー操作の3層構造とする。** ラウンド終了後に意味を失う情報（残り時間・NORMAL/INSERT のモード表示、編集中の大きなバッファ表示）は表示しない。実装は `src/app/pages/LevelRound.tsx` の `ResultBanner`。

**プレイ画面はコンテキスト → お題 → バッファカード（モード・タイマー・テキストを集約）→ 入力表示 → 静音フッターの構造とする。** バッファカード（`src/app/components/BufferStage.tsx`）はモードバッジ・残り秒数・バッファテキスト・タイマーバーを1枚に集約し、視線移動をなくす。フッターのキーヒントは区切り線の下に置き、サイズ・彩度を落として静かにする。実装は `src/app/pages/LevelRound.tsx` の `ChallengeRound`。

**プレイ中のキー割り当ては `s`（スキップ）/ `?`（ギブアップ）/ `r`（リトライ）/ `[`（前の問題へ戻る）の4つ。** いずれも Normal モードかつ `inputState.phase === "idle"`（オペレータ/f/t/テキストオブジェクトの入力待ちでない）ときのみ有効とし、Vim のモーション対象文字としての意味を優先する（例: `f?` は「?」を検索する動作が優先され、ギブアップにはならない）。`[` はオーナーの直接指示で追加された機能で、レベル選択時に決まった出題順（フルクリア後のシャッフルが効いていればその並び、シャッフル未発生なら固定順）上で1つ前の問題に戻る。戻る際、直前まで進行中だったラウンドは Attempt/challengeStats に一切記録されない（スキップと異なり「挑戦した」扱いにもならない、単に index を1つ戻すだけの操作）。先頭の問題では no-op。`[` は Vim 本来では `[(`/`[)` 等のモーション prefix であり、将来これらを実装する際にキー割り当てが衝突しうる点は既知のトレードオフとして許容し、実装時に再検討する。

**未対応キーは無反応にせず、非破壊的なヒントで案内する。** 特に Vim 本来の挙動と異なる箇所（`i`/`a` の INSERT 突入等）は専用文言を持つ（`src/app/hooks/useUnsupportedKeyHint.ts` / `src/core/parser.ts` の `isUnsupportedIdleKey`）。

**カード類の統計行は下端固定とし、進捗・残量はバー（タイマーバーと同じ視覚言語）で示す。** メニューのレベルカード（`src/app/pages/MenuScreen.tsx` の `LevelCard`）はカード内を flex column 化し、説明文に `flex: 1` を与えて統計行を下端に揃える。進捗バーは `.vg-bar-track`/`.vg-bar-fill`（`src/index.css`）としてプレイ画面のタイマーバーと共通化し、新しいバーを追加する際もこのクラスを再利用すること。

**サマリは結果に正直な見出し（3分岐）→ 集計カード → 問題別内訳 → キー操作の構造。見出しは実結果と食い違う文言を使わない。** 3分岐（全問 Great / 全問クリア（Great未達あり）/ 未クリアあり）とその判定は `src/core/sessionSummary.ts` の `summaryHeadlineKind` を唯一の正とし、画面側で独自に条件を組み立てない。実装は `src/app/pages/LevelSummaryScreen.tsx`。

**ヒント・ガイダンス文言でキーを案内する場合、そのキーが当該画面で別機能に割り当てられていないことを確認する。** キー割り当ての一覧は `src/core/keymap.ts` を正とする（例: プレイ中の `?` は「ギブアップ」に割り当て済みのため、「? で遊び方を確認」という案内はプレイ中の文言としては使えない）。

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
- メニュー画面・レベル選択（Level は Challenge.difficulty から導出、クリア状況は `challengeStats` から導出。詳細は「永続化」参照）
- 全画面のキーボード操作（詳細は「UI 操作」参照）
- プレイグラウンド（タイマー・判定・Attempt 記録なしの素振り場。リアルタイム解釈表示、リザルトからのテキスト持ち込み）
- シャッフル・復習モード（詳細は「永続化」参照）

### スコープ外（Phase 3 以降）

- 複数行、`j`/`k`
- 段落テキストオブジェクト（`ip`/`ap`）— 複数行対応とセットでのみ実装可能なため、`i]`/`i}` 等の追加対象とは切り離して検討する
- `i]`/`i}` 等の追加テキストオブジェクト対象（`iw`/`i"`/`i)` と同じ scope×target 合成設計で追加コスト自体は低いが、公開に必須ではないため未着手）
- idle 中の `i`/`a`（Insert mode への単体突入）。実装する場合は「空の change」ではなく専用の single コマンドとして実装し、`insert.ts` を再利用する方針とする（`i` はカーソル位置のまま、`a` はカーソル+1 してから Insert 遷移）。`A`/`I`/`o`/`O` 等とまとめて検討する
- Visual mode、`dd`/`yy`、`p`、`.`（repeat）
- レジスタ指定、マクロ、`:` コマンド
- 弱点分析ダッシュボード（タグ別・コマンド別成功率など）。Attempt/challengeStats を貯める設計は完了しているが、分析表示は記録が貯まってから別途検討する
- シャッフルの手動オン/オフ設定、本格的な間隔反復（SRS）アルゴリズム（現状は `lastPlayedAt` 昇順という簡易版）

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

**ギブアップで想定コマンドを閲覧した問題を、アプリセッション中（ページロードから離脱まで）に自力でクリアした場合は「回答閲覧後クリア（assisted）」として扱う。** 判定バナーは中立色で「クリア（回答閲覧後）」+「いい練習です。後日もう一度自力で解くと正式なクリアになります」を表示し、Great 判定は付けない。経過時間は表示してよい（懲罰的な扱いは不要。正式クリアでないことは判定バナーの色と文言だけで伝える）。streak はギブアップ時点でリセットされた値のまま増やさない。`challengeStats` の clears/greats/lastOutcome は一切更新しない（`attempts` のみ加算）— 詳細は「永続化」節参照。閲覧済みマークはメモリ上のみで、リロードで消える（意図的な割り切り。詳細は ADR `2026-07-07-proficiency-vs-attainment-and-assisted-clears.md` 参照）。

## 経過時間表示と記録

**スコア制は廃止した**（経緯は ADR `2026-07-07-remove-scoring-show-elapsed-time.md` 参照）。クリア・冗長クリア・回答閲覧後クリアのリザルトには、代わりに経過時間をそのまま表示する（判定バナーに「タイム 2.4s」のように小数点1桁で表示。時間切れ・ギブアップ・スキップでは表示しない）。サマリ画面の集計カードも「合計スコア」ではなく「合計タイム」（クリアした問題の経過時間合計。回答閲覧後クリアは含めない）を表示する。経過時間は `Date.now()` ベースの精密な計測（ラウンド開始時刻からの差分）で、タイマーバー表示用の秒単位カウントダウンとは別に持つ。

`streak`（連続クリア数、クリア・冗長クリアいずれも対象。失敗・時間切れ・ギブアップでリセット）は表示用の指標として残る。実装は `src/core/streak.ts` の `nextStreak`（スコア計算の消滅と無関係に独立させた）。

試行ごとに記録を残す：

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
  great?: boolean;    // ラウンドの judge 結果が Great だった（keyCount からの再導出はしない）
  assisted?: boolean; // 回答閲覧後クリア（success: true と対で記録。「正誤判定と評価」参照）
};
```

`revealed`/`skipped`/`great`/`assisted` はいずれも省略可能な追加フィールドで、保存済みデータとの互換性のためスキーマバージョンは上げない（欠落 = false として扱う）。将来的に「t 系モーションが苦手」等の弱点フィードバックに使う。型定義とローカルストレージへの記録は `src/core/attempt.ts` / `src/app/attemptStorage.ts` を参照。

## 永続化

localStorage に保存するキーと役割の一覧（すべて `vimgram:` プレフィックス）：

| キー | 役割 | 実装 |
| --- | --- | --- |
| `vimgram:attempts:v1` | 試行ログ（Attempt の配列、直近1000件までのローテーション） | `src/app/attemptStorage.ts` |
| `vimgram:challengeStats:v1` | 問題ごとの集計（`{ clears, greats, attempts, lastPlayedAt, lastOutcome }` のマップ）。**進捗表示・シャッフル判定・復習リストの唯一の正**とする | `src/app/challengeStatsStorage.ts` |
| `vimgram:milestones:v1` | 達成（マイルストーン）の未祝福キュー（`{ type, level, celebrated }` の配列） | `src/app/milestoneStorage.ts` |
| `vimgram:starPrompt:v1` | Star 促し（達成モーダル）の恒久状態（`{ status: "active" \| "done" \| "muted" }`） | `src/app/starPromptStorage.ts` |
| `vimgram:starCount:v1` | GitHub スター数のキャッシュ（数時間） | `src/app/starCache.ts` |
| `vimgram:locale` | 選択中の言語（en/ja） | `src/app/i18n/locale.ts` |

**`Attempt.mistakeCount` は、そのお題の挑戦中に発生した「不成立コマンド」（`f`/`t` の対象文字なし、テキストオブジェクト解決失敗など、`found: false` で終わった操作）の回数。** スコア計算からは切り離されたが、Attempt の記録項目としては引き続き残す（将来の弱点フィードバックに使う）。

**集計・進捗表示は `challengeStats` を正とし、Attempt ログからの都度集計はしない。** Attempt ログはローテーションするため、レベルカードのクリア数・Great数・シャッフル判定・復習対象の抽出はすべて `challengeStats`（`src/core/challengeStats.ts` / `src/core/progress.ts` / `src/core/reviewQueue.ts`）を参照する。`challengeStats` は Attempt 記録と同じタイミングで増分更新し（`src/core/challengeStats.ts` の `recordChallengeStats`、純関数）、初回ロード時に限り既存の Attempt ログから一度だけ再構築する（`rebuildChallengeStatsFromAttempts`。ログにある範囲でよく、ローテーションで消えた分は諦める）。

**`challengeStats` は到達度（`clears`/`greats`、累積・単調増加）と習熟度（`lastOutcome`、直近の実挑戦の結果）を併せ持つ。** 進捗表示・レベルカードの数値・シャッフル判定・マイルストーン検知・Star 促しは到達度（`clears`/`greats`）のみを参照し、`lastOutcome` を一切見ない（`src/core/progress.ts` / `src/core/milestones.ts`）。復習リストの選定だけが `lastOutcome` を参照する（下記「復習モード」）。`lastOutcome` は `"great" | "clear" | "redundant" | "fail"` のいずれかで、実挑戦（スキップでも回答閲覧後クリアでもない、判定が下った試行）のたびに上書きされる。**回答閲覧後クリア（assisted）はどちらも更新しない**（`attempts`/`lastPlayedAt` のみ加算）。詳細は「正誤判定と評価」節、および ADR `2026-07-07-proficiency-vs-attainment-and-assisted-clears.md` を参照。

### シャッフル

レベルの全問題が `challengeStats` 上でクリア済み（`clears >= 1`）になっている場合のみ、そのレベルの再プレイは出題順をシャッフルする（`src/core/shuffle.ts` の `shuffle`、Fisher-Yates、RNG 注入可）。未達のレベルは常に固定順（`challenges/` の ID 順）を保つ。比較学習ペア（`df,`/`dt,` 等）を隣接させる出題設計は、初見のプレイヤーにとって重要だが、全問クリア後の復習ではランダム化して記憶ではなく判断力を試す。判定・出題順の決定は `GamePage.tsx` の `handleSelectLevel` で行う。この判定は到達度（`clears`）のみを参照し、`lastOutcome` の影響は受けない。

### 復習モード

`challengeStats` から2種類のリストをレベル横断で、**直近（`lastOutcome`）ベースで**抽出する（`src/core/reviewQueue.ts` の `buildReviewQueue`）：

- **未クリア**: `attempts >= 1` かつ（`clears === 0` または `lastOutcome === "fail"`）。一度 Great になった問題でも、直近の挑戦（復習等）が失敗すればここに戻る
- **Great 未達**: `lastOutcome` が `"clear"` または `"redundant"`

どちらも `lastPlayedAt` の古い順に出題する（間隔反復の簡易版）。1件もプレイしていない（`challengeStats` が空の）初回訪問ではメニューの復習セクションごと非表示にする。復習セッション中の Attempt/challengeStats 更新は通常のレベルプレイと同一の経路を通る。回答閲覧後クリア（assisted）は `lastOutcome` を変えないため、閲覧前の状態のまま復習リストに残り続ける。

### 達成（マイルストーン）検知

**達成の検知は `challengeStats` 更新時に core で行い、画面・セッション種別に依存させない。表示は未祝福キュー経由で次のサマリまたはメニューが行う。** レベルセッションでも復習セッションでも、どの画面から達成しても同じ経路で検知・祝福されることが目的（例: 復習経由である問題をクリアしてそのレベルが全問クリアになった場合も、レベルセッションを普通にプレイして全問クリアした場合と同じように祝福される）。

- 検知は `src/core/milestones.ts` の `detectMilestones(prevStats, nextStats, challenges)`（純関数）が唯一の正。`challengeStats` の更新前後を比較し、新たに達成されたマイルストーン（現状は「レベル N 全問クリア」の1種のみ。ユニオン型なので将来「レベル N 全問 Great」等を追加できる）を返す
- **`challengeStatsStorage.ts` の `recordChallengeStatsForOutcome` が、stats 更新と `detectMilestones` の呼び出しを1つの関数に束ねている。** 呼び出し側（`LevelRound.tsx`）は何も意識せず、challengeStats を更新するすべての経路で自動的に検知される
- 検知結果は `vimgram:milestones:v1`（`{ type, level, celebrated }` の配列）に `celebrated: false` で積む（`src/app/milestoneStorage.ts` の `recordDetectedMilestones`）。同じマイルストーンは一度しか記録しない
- 表示は `src/app/components/MilestoneBanner.tsx` が唯一の実装で、`LevelSummaryScreen`（主要な祝福面）と `MenuScreen`（サマリを経由せず Esc 等で離脱したケースの保険）の両方から props なしで呼び出す。マウント時に未祝福の達成を読み、その場で表示 + `celebrated: true` にマークする（複数レベルが同時に未祝福なら列挙して1つにまとめる）

**Star 促しはマイルストーン達成モーダル（`src/app/components/MilestoneModal.tsx`）のみとする。** `vimgram:starPrompt:v1` の状態が `"active"`（初期値、まだ何も意思表示していない）のときだけモーダルを出し、`[s]`（GitHub でスターする。新規タブで開き `"done"` にする）か `[n]`（今後表示しない、`"muted"` にする）のいずれかを一度でも押したら恒久停止し、以後の達成では（このセッションに限らず永久に）Star リンクなしの祝福バナーのみになる。`[Enter]`/`[Esc]` は「今回は閉じるだけ」で状態を変えず、次の達成では再度モーダルが出る。**スター状態を検証する手段はないため、`[s]` は自己申告を信頼する**（実際にスターしたかを追跡・催促しない）。モーダル表示中はキャプチャフェーズの keydown リスナーで背後の画面（サマリ/メニュー）へのキー入力を無条件に遮断し、フォーカスをモーダルに閉じ込める。以後は常設のヘッダー Star ボタンだけが導線として残る

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
12. **プレイグラウンドの一般ユーザー向け昇格**（リアルタイム解釈表示、リザルトからの `p` 導線、両画面常時マウント + `active` ゲーティング）— ✅ 完了
13. **未対応キーの案内**（遊び方の「vimgram と Vim の違い」小節、`i`/`a` 等への動的ヒント表示）— ✅ 完了
14. **シャッフルと復習モード**（`challengeStats` 集計ストア、全問クリア後のシャッフル、未クリア/Great未達の復習リスト）— ✅ 完了
15. **リザルト画面の3層構造化**（判定バナー / テキスト変化・入力の詳細カード / キー操作、`--miss` トークンの追加）— ✅ 完了
16. **プレイ画面の3層構造化**（バッファのステージ化: モードバッジ・タイマーバー・拡大したバッファテキストを1枚のカードに集約、キーキャップ化した入力表示、静音フッター）— ✅ 完了
17. **メニュー画面の整列と進捗バー化**（レベルカードの高さ揃え+進捗バー、復習カードのコンパクト化、j/k のレスポンシブ幾何ナビゲーション）— ✅ 完了
18. **レベルサマリ画面の再構成**（結果に正直な見出しの3分岐、集計カード、問題ごとの内訳リスト、プレイグラウンド/サマリの h1 統一）— ✅ 完了
19. **達成（マイルストーン）検知の独立化**（`detectMilestones` の core 化、未祝福キュー、サマリ/メニュー両方での祝福バナー表示）— ✅ 完了
20. **Star 促しのモーダル化**（達成モーダル + `vimgram:starPrompt:v1` による恒久停止、キーボードトラップ）— ✅ 完了
21. **習熟度の導入と回答閲覧後クリアの扱い**（`challengeStats.lastOutcome`、直近ベースの復習リスト、assisted クリア）— ✅ 完了
22. **スコア制の廃止と経過時間表示への置換**（判定バナー・サマリの集計カードをタイム表示に、streak は表示用として独立化）— ✅ 完了
23. **プレイグラウンドの再構成**（左ステージへのプレイ画面部品の再利用、行形式の直近コマンド履歴、explain 辞書から自動生成するキー早見表）— ✅ 完了

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

**コマンド実行は pnpm スクリプト経由（`pnpm vitest run` / `pnpm tsc --noEmit` / `pnpm biome check`）を使う。** `PATH` の手動 export や `node_modules/.bin` の直接実行はしない（権限確認の多発を招くため）。

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
- 配置: ヘッダーに常設（`src/app/components/StarButton.tsx`、`src/app/App.tsx`）。これとは別に、**Star 促しはマイルストーン達成モーダルのみ**とする（下記「達成（マイルストーン）検知」参照）。問題ごとのクリア画面や祝福バナー内に個別の Star リンクは置かない
- **ユーザーが一度でもスター/非表示の意思を示したら恒久停止し、以後はヘッダー常設ボタンのみが導線として残る。** スター状態は検証不能のため、`[s]`（スターする）を押した時点で自己申告を信頼し、実際にスターしたかどうかを追跡・確認する仕組みは持たない（`src/app/starPromptStorage.ts`、`vimgram:starPrompt:v1`）

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
