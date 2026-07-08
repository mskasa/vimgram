# メニュー画面をカード整列・進捗バー・幾何ナビゲーションで再構成する

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

メニュー画面のレベルカードは、説明文の長さがカードごとに異なるため統計行の高さが揃わず、見た目がガタついていた。統計行も「クリア数: X/Y」「Great数: Z/Y」というラベル付きの2行で、ja の「Great数」は日本語と英語が混在した表記になっていた。復習セクションは巨大な正方形カード2枚を占有し、レベルカードと比べて視覚的な重みが不釣り合いだった。ヘッダー（タイトル・紹介文・見出し）も画面上部の約1/3を占めていた。

また、j/k による上下移動を新設するにあたり、メニューのカードグリッドは `auto-fit` で列数がビューポート幅に応じて変わる（4列・2列・1列）ため、「上下」を固定の列数や行・セクション構造を仮定したインデックス計算で実装することはできない。

## Decision

- **レベルカードは `align-items: stretch` の grid + flex column 化し、説明文に `flex: 1` を与えて統計行を全カードで下端に揃えた。** 実装は `src/app/pages/MenuScreen.tsx` の `LevelCard`
- **統計行を「クリア X/Y」（`--success`）+ 星アイコン付き Great 数（`--warn-star`、★ グリフ）の1行に統合した。** Great は文言ではなくアイコンで表現し、ja の「Great数」という日英混在表記を解消した。未プレイのレベルは「未プレイ · N問」の1行（`--text-muted`）にまとめ、「問題数:」という独立ラベル行は廃止した
- **統計行の下に4pxの進捗バーを追加した（`.vg-bar-track`/`.vg-bar-fill`、`--success`）。** プレイ画面のタイマーバー（`BufferStage.tsx`）と同じ視覚言語にするため、既存の `.vg-stage-timerbar-*` クラスを `.vg-bar-*`/`.vg-bar-fill--miss` に一般化し、両方で共有した。未プレイのレベルは空のトラックのみ表示する
- **復習セクションを横長のコンパクトカードに変更した。** 左に対象問題数の大きな数字（26px、未クリア=`--miss`、Great未達=`--warn-star`）、右にタイトル+一言説明。0件のカードは既存どおり淡色表示 + キーボード選択のスキップ対象のまま。見出しに「— レベル横断で解き直す」という補足を追加した
- **ヘッダーを引き締めた。** タイトルを30px（メニュー画面のみのインラインスタイル。他画面の `<h1>` は次のデザイン展開まで現状維持）、紹介文に `max-width: 600px` を設定し、タイトル〜紹介文〜見出しの縦マージンを詰めた
- **j/k のレスポンシブ幾何ナビゲーションを `src/core/gridNav.ts` の `findNextInDirection`（純関数）として切り出した。** キー押下時に全選択可能カードの `getBoundingClientRect()` を測定し、(1) 現在のカードより下/上にある候補だけを残し、(2) その中で垂直中心距離が最も近い「行」を選び、(3) 同じ行内では水平中心距離が最も近いものを選ぶ、という2段階のアルゴリズムにした。列数や行・セクション構造を一切仮定しないため、4列・2列・1列のどのレイアウトでも同じロジックで動作する
- **h/l は既存どおり論理順（レベル→復習）のインデックス移動のままとした。** 折り返し後も読み順と一致するため座標計算は不要という指示どおり、`moveInDirection` に変更なし
- **resize イベントの監視はしない。** 矩形はキー押下のたびに `measureRects()` で都度測定するため、ウィンドウのリサイズを監視する必要がない
- **フッターのキーヒントは h/j/k/l を1つのグループとして視覚的にまとめつつ、各キーキャップは自分自身の方向アクションを個別に発火する。** 初版ではこの4キーを1つの結合キーキャップ（クリック no-op）として実装したが、「クリックできる見た目の要素が無反応なのは壊れて見える」「キーヒントのクリック＝キー操作と同じ結果、という確立済み原則の静かな例外を作りたくない」というオーナーの指摘を受けて撤回した。`src/app/components/KeyHint.tsx` の `KeyHintItem` に `kind: "group"` バリアントを追加し、`keys: { keyLabel, onActivate }[]` を個別に持たせた上で、ラベルだけを1つ共有する形にした。これにより「1キーキャップ = 1キー = 1アクション」の原則はグループ内の各キーについても完全に維持される

## Consequences

- `src/core/keymap.ts` の `MenuKeyAction` に `moveDown`/`moveUp` を追加し、`j`/`ArrowDown`/`k`/`ArrowUp` をマップした
- `src/core/gridNav.ts`（+ `gridNav.test.ts`）を新設。4列/2列/1列レイアウトの矩形フィクスチャと、0件レビューカードのスキップケースをテストした
- `src/app/i18n/strings.ts`: `menu.great`/`menu.challengeCount`/`keyHint.moveLeft`/`keyHint.moveRight` を削除（呼び出し元がなくなったため）。`menu.challengeUnit`/`menu.reviewSubtitle`/`menu.reviewUnclearedDescription`/`menu.reviewNotGreatDescription`/`keyHint.select` を追加した。`menu.challengeUnit` は en に意図的な先頭スペース（" challenges"）を持たせている（ja の助数詞「問」は数字に直接続き、空白を挟まないため）
- `.vg-stage-timerbar-track`/`.vg-stage-timerbar-fill`/`.vg-stage-timerbar-fill--low` を `.vg-bar-track`/`.vg-bar-fill`/`.vg-bar-fill--miss` に改名し、`BufferStage.tsx` の参照も追従させた
- `MenuScreen.tsx` の `LevelCard`/`ReviewCard` に `cardRef: (el) => void` プロップを追加し、各カードの DOM 矩形を測定できるようにした

## Alternatives Considered

- **j/k の移動先を固定の列数（例: `Math.floor(index / 4)` のような行計算）で決める** — `auto-fit` によって実際の列数はビューポート幅で変わるため、列数を決め打ちにすると狭い画面で確実に破綻する。実際に描画された矩形を都度測るアプローチのみが、レスポンシブなグリッドで正しく動作する
- **h/l も j/k と同じ幾何ベースのロジックに統一する** — 指示どおり、折り返し後も読み順と一致する h/l は座標計算が不要であり、既存のシンプルなインデックス移動のままにした
- **「h/j/k/l」を1つの結合キーキャップとして扱い、クリックを no-op にする（初版の実装）** — 実害（クリックできる見た目の要素が無反応に見える）と原則面（キーヒントのクリック＝キー操作という確立済み保証への静かな例外）の両方でオーナーから差し戻しがあり、4つの独立したキーキャップ（見た目だけグルーピング）に変更した
- **「h/j/k/l」の統合キーキャップに何らかの代表アクション（例: 常に moveRight）を割り当てる** — 4方向のうちどれか1つを代表として選ぶこと自体が恣意的で、押し間違いを誘発しかねない。個別キーキャップ化によって「代表を選ぶ」という問題自体が発生しない設計にした
- **resize 監視を追加してタブレット回転等に追従する** — 指示で明示的にスコープ外とされており、押下時の測定で十分という判断を尊重した

## Related Files

- src/app/pages/MenuScreen.tsx
- src/core/gridNav.ts
- src/core/gridNav.test.ts
- src/core/keymap.ts
- src/core/keymap.test.ts
- src/app/components/BufferStage.tsx
- src/app/components/KeyHint.tsx
- src/app/i18n/strings.ts
- src/index.css
