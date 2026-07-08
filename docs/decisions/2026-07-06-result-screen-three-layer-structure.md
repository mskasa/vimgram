# リザルト画面を「判定バナー→詳細カード→キー操作」の3層構造に再設計する

- Date: 2026-07-06
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

リザルト画面は、判定見出し・スコア/連続クリア・入力の解説・想定コマンドの解説・キー操作がすべて同じ視覚的重みの `<p>`/`<ul>` として縦に並んでおり、一番伝えたい「クリアしたか失敗したか」という判定が他の情報に埋もれていた。加えて `LevelRound` が `ChallengeRound` の下に常時「メニューへ戻る」ボタンを描画しており、リザルト表示中は `ResultBanner` 自身の Esc キーキャップと機能が完全に重複していた（UI 操作の「キーキャップへの一本化」ルール違反）。

## Decision

- **リザルトを「判定バナー（層1）→ 詳細カード2枚（層2）→ キー操作（層3）」の3層に再構成した。** 判定バナーは `--font-verdict`（24px）の見出し + キーカウントのサブテキスト + スコア/連続クリア数（クリア系のみ）を横並びで見せる、画面内で最も視覚的に重いブロックとする
- **判定ごとの色を固定した。** Great は `--accent`（暖色アクセントの許可された4用途の1つ）+ ★アイコン、クリア（冗長）は `--success` だが枠を1pxかつ見出し色を `--text-primary`（中立）に落として Great より視覚的に控えめにする、時間切れ・ギブアップは新設の `--miss`（`#e58fb1`、黄昏のローズ）を使う。`--miss` は失敗系の判定バナー専用とし、他の警告表示には流用しない
- **詳細カードは「テキストの変化」と「あなたの入力（または想定コマンド）」の2枚を `.vg-result-cards`（CSS Grid、`auto-fit, minmax(280px, 1fr)`）で横並びにし、幅が足りない画面では自動的に1カラムへ折り返す。** 新しいデータは持ち込まず、`challenge.initial.text` と最終 `BufferState`（`finalBuffer`、`ChallengeRound` の `buffer` state をそのまま result 表示時点の値として渡す）から導出する
- **「テキストの変化」カードの差分は、共通接頭辞・共通接尾辞のトリミングで求める（`src/core/textDiff.ts` の `diffText`）。** 本格的な LCS diff は不要と判断した: このエンジンが持つ全オペレータ（delete/change/yank）はバッファを単一の連続範囲 `[start, end)` でしか書き換えないため（`operators.ts`）、変化点は必ず1箇所であり、複数の非連続な差分を考える必要がない
- **「あなたの入力」カードは `CommandExplanation`（`<ul><li>` の箇条書き）ではなく、新設した `CommandBreakdown`（キーキャップ+説明の行）で表示する。** `CommandExplanation` はプレイグラウンドの解説表示（本リデザインの対象外）でも使われているため、リザルト用に見た目を変える際は別コンポーネントに分けた。冗長クリア・失敗時は同じカード内で「あなたの入力」の下に「想定コマンド」も続けて表示する（情報量は変えず、レイアウトだけ統一した）
- **ラウンド終了後に意味を失う情報（残り時間、NORMAL/INSERT モード表示、編集中の大きな `BufferView`、ヒント、未対応キーのトースト）は、result 表示中は非表示にする。** お題文だけは小さく地味なスタイル（`--font-keyhint` + `--text-muted`）に落として文脈として残す
- **「メニューへ戻る」の独立ボタンは `ChallengeRound` の非 result 分岐（プレイ中のみ）に移した。** プレイ中は Esc がすでに Normal/Insert モードの意味を持っており（`keymap.ts`）exitToMenu の割り当てがないため、このボタンはプレイ中に限れば何のキーキャップとも重複しない唯一の導線になる。result 表示中は完全に消え、`ResultBanner` 自身の Esc キーキャップだけが「メニューへ戻る」の導線になる

## Consequences

- `src/index.css` に `--miss` トークンと `--font-verdict` タイポグラフィトークン、`.vg-result-cards` / `.vg-card` / `.vg-result-divider` / `.vg-breakdown` 系のレイアウトクラスを追加した
- `src/core/textDiff.ts`（+ テスト）、`src/app/components/CommandBreakdown.tsx` を新設。`src/app/components/BufferView.tsx` に `compact` バリアントを追加し、テキスト変化カードの「変更後」行で再利用した
- `result.verbose`（旧: 冗長クリアの見出し文言そのもの）は廃止し、`result.verboseHeadline`（見出し）と `result.shorterSolutionHint`（「より短い操作があります」）・`result.keyCountLabel`/`result.idealKeyCountLabel`（ラベル:値の合成に使う語のみ）に分割した。キーカウントの文言合成が言語ごとに語順を変えず「ラベル: 値」の形（他の統計表示と同じ慣用句）で組めるようにするため
- CommandExplanation・プレイグラウンドの解説表示・サマリ画面・メニュー画面は今回変更していない（スコープ外として明示された）

## Alternatives Considered

- **`CommandExplanation` 自体をキーキャップ表示に書き換える** — プレイグラウンドの解説表示にも影響してしまい、今回スコープ外のプレイグラウンドの見た目が意図せず変わってしまう。新しい `CommandBreakdown` を分けて追加する方が安全と判断した
- **テキスト差分に本格的な LCS ベースの diff ライブラリを使う** — このゲームのオペレータは単一連続範囲の書き換えしか生成しないため（複数箇所の同時編集は存在しない）、共通接頭辞・接尾辞のトリミングで十分。過剰な実装を避けた
- **「メニューへ戻る」ボタンをプレイ中も含めて完全に削除し、代わりに `[` や新しいキーを exitToMenu に割り当てる** — プレイ中のキー空間（Vim エンジンの入力）を圧迫する新しい変更であり、今回のリクエストは「result 表示中の重複」の是正が目的だったため見送った。プレイ中の唯一の非キーキャップ導線として残すのがスコープに対して最小の変更だった

## Related Files

- src/app/pages/LevelRound.tsx
- src/core/textDiff.ts
- src/core/textDiff.test.ts
- src/app/components/CommandBreakdown.tsx
- src/app/components/BufferView.tsx
- src/app/i18n/strings.ts
- src/index.css
