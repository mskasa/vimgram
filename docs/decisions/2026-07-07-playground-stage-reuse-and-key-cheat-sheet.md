# プレイグラウンドをプレイ画面の部品再利用 + 自動生成キー早見表で再構成する

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

プレイグラウンドは独自のバッファ表示（`<BufferView>` 直置き + 「モード / カーソル / yankレジスタ」のスラッシュ区切りテキスト行）と、独自の「入力したキー: ...」表示、独自の `CommandExplanation`（累積シーケンス全体の箇条書き解説）を持っていた。プレイ画面が Step 18 で獲得した「バッファカード（`BufferStage`）+ 入力表示（`InputRow`）」という視覚言語と乖離しており、素振り場としての「使えるキーの一覧性」も弱かった（プリセット・キーの説明はどこにもまとまっていない）。

## Decision

- **プレイグラウンドを2カラム化する**（左1.5fr: ステージ、右1fr: 道具箱。`.vg-playground-grid`、860px 未満で1カラムに縦積み）
- **左ステージはプレイ画面と同一のコンポーネントを再利用する。** `BufferStage`/`InputRow`/`describePendingHint` を play screen 専用から app 共通コンポーネント（`InputRow.tsx` は新設、`BufferStage` はプレイグラウンド用の "freeform" バリアントを追加）に格上げした。`BufferStage` は `variant: "timed" | "freeform"` の判別可能ユニオンを取り、"timed" はこれまで通り残り時間、"freeform" はカーソル位置 + yank レジスタの中身をヘッダー右側に表示し、タイマーバーそのものを描画しない
- **直近のコマンド履歴を、リザルト画面の内訳リストと同じ行形式に作り替える。** 新しい `ParsedCommand` ごとにキーキャップ + 説明を1行で表示し、新しいものを上に最大8件。不成立コマンドは `--miss` 系の背景色にし、通常の操作説明の代わりに「不成立 — 理由」（`core/explain.ts` の新設 `explainFailure`）を表示する。理由は f/t なら対象文字、テキストオブジェクトなら「対象が見つかりません」で、この2つ以外は `found: false` を返しえない（`motions.ts` 参照）ため網羅的
- **右の道具箱に、explain 辞書から自動生成するキー早見表を新設する。** `core/explain.ts` に `listOperators`/`listMotions`/`listTextObjects` を追加し、既存の `operatorDescriptions`/`singleDescriptions`/`motionDescriptions`/`targetLabels` を `Object.entries` で走査して一覧を作る。手書きのキー一覧を持たないため、将来モーション等を追加すれば早見表にも自動で反映される。f/t は対象文字の代わりに `f·`/`t·` と表示する。早見表の各キーキャップはホバー/フォーカスで説明をツールチップ表示するが、クリックでコマンドを実行することはない（`<button>` だが `onClick` を持たない - キーボード/タップでフォーカスできる非装飾要素が欲しかっただけで、`<span tabIndex>` は a11y lint に引っかかるため `<button>` を採用した）
- **テキスト設定（入力欄 + セット/リセット + プリセット）を1つのカードに集約する。** プリセットは「チップ」スタイル（`.vg-chip`、pill 型ボタン）にし、Set/Reset とは視覚的に区別する
- **旧来の「入力したキー」行 + `CommandExplanation`（累積シーケンスの箇条書き解説）を廃止する。** `InputRow` がキー列そのものを常時表示し、直近のコマンド履歴が個々のコマンドの説明を担うため、両者を足した情報は失われない。`CommandExplanation.tsx` は他に使用箇所がなくなったため削除した

## Consequences

- 新設: `src/app/components/InputRow.tsx`（`InputRow`/`describePendingHint`、`LevelRound.tsx` からの抽出）、`src/app/components/KeyCheatSheet.tsx`
- `src/app/components/BufferStage.tsx`: props を `{mode, text, cursor} & ({variant: "timed", timeLeft, timeLimitSec} | {variant: "freeform", yankRegister})` の判別可能ユニオンに変更。`LevelRound.tsx` の呼び出しに `variant="timed"` を追加（既存動作は変更なし）
- `src/core/explain.ts`: `explainFailure`/`listOperators`/`listMotions`/`listTextObjects`/`CheatSheetItem` を追加
- 削除: `src/app/components/CommandExplanation.tsx`
- i18n: `playground.mode`/`playground.yankRegister`/`playground.empty`/`playground.pendingCount`/`playground.pendingMotion`/`playground.pendingCharTarget`/`playground.pendingTextObjectTarget`/`playground.keysTyped`/`playground.notResolved`/`explanation.title` を削除（すべて置き換え後の実装で不要になった）。`playground.yankLabel`/`playground.yankEmpty`/`playground.unresolvedPrefix`/`playground.cheatSheetTitle`/`playground.cheatSheetOperators`/`playground.cheatSheetMotions`/`playground.cheatSheetTextObjects` を追加。`playground.subtitle` は見出し行への埋め込み用に短縮
- CSS: `.vg-stage-timer` を `.vg-stage-info`（timed/freeform 共通のヘッダー右側情報スタイル）に一般化。`.vg-playground-grid`/`.vg-chip`/`.vg-keycap-tip`/`.vg-keycap-tip-bubble` を追加
- Playwright（scratchpad に一時導入、リポジトリの依存には追加していない）でブラウザ動作を確認: ci" での INSERT バッジ切り替え、yi" での yank レジスタ表示更新、fz（存在しない文字）での不成立行 + 理由表示、早見表の件数が Operators=4（d/y/c/x）・Motions=9（h/l/0/$/w/e/b/f/t）・Text objects=8（4対象×inner/around）と explain 辞書のエントリ数に一致すること、860px 未満での縦積み、日本語ロケールでの表示、リザルト画面からの `p` ハンドオフでのテキスト持ち込みを確認した

## Alternatives Considered

- **`<span tabIndex={0}>` でキー早見表のツールチップトリガーを作る** — biome の `lint/a11y/noNoninteractiveTabindex` に抵触し、非インタラクティブ要素をキーボードフォーカス対象に加えることになるため却下。`onClick` を持たない `<button>` に切り替えることで、意味的に正しい「フォーカス可能だが何も実行しない」要素にした
- **早見表のキー一覧を手書きの配列として別途持つ** — 26-5 の要件（explain 辞書からの自動生成、単一情報源の維持）に反するため却下
- **CommandExplanation を早見表と共存させたまま残す** — 「直近のコマンド履歴」が個々のコマンドの説明という同じ役割を行形式でより読みやすく担うため、累積シーケンス全体をなめて箇条書きにする旧実装は冗長と判断し削除した

## Related Files

- src/app/pages/PlaygroundPage.tsx
- src/app/components/InputRow.tsx
- src/app/components/BufferStage.tsx
- src/app/components/KeyCheatSheet.tsx
- src/core/explain.ts
- src/app/pages/LevelRound.tsx
- src/app/i18n/strings.ts
- src/index.css
- CLAUDE.md
