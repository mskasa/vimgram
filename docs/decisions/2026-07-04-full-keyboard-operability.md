# 全画面をキーボードのみで操作可能にし、キー割り当ては core に集約する

- Date: 2026-07-04
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

vimgram は Vim のキーボード操作を練習するゲームでありながら、メニュー選択やリザルト確認・次の問題への遷移をマウスクリックでしか行えなかった。これはゲームの趣旨と矛盾するため、メニュー → レベル選択 → プレイ → リザルト → 次の問題 → サマリ → メニュー という全フローをキーボードのみで完結できるようにする。

## Decision

- **画面ごとのキー割り当ては `src/core/keymap.ts` に集約する**（`resolveMenuKey` / `resolveResultKey` / `resolveSummaryKey` / `routeKeydown`）。DOM 型を一切持たない純関数とし、「どの画面がどのキーを持つか」をこのファイル1つで見渡せるようにする。各画面コンポーネント（`MenuScreen` / `LevelRound` の `ChallengeRound` / `LevelSummaryScreen`）は実際の `KeyboardEvent` から `{ key, hasModifier }` を取り出してこれらの関数に渡すだけの薄い配線に留める
- **ゲーム中（プレイ中）とリザルト表示中の keydown リスナーは、1つの常駐リスナーを ref で分岐させる**。以前の実装は `result` を含む依存配列を持つ `useEffect` でリスナーを毎回張り替えていたが、`result` が null → 非 null に変わる瞬間にリスナーの取り外し・再登録の隙間が生じ、その隙間に飛び込んだキー入力（Enter 連打等）を取りこぼす可能性があった。`resultRef.current` を都度読む単一の永続リスナーに統一し、`routeKeydown(phase, input)`（`src/core/keymap.ts`）で「今どちらのフェーズか」を判定することで、リスナーの張り替え自体をなくし、この隙間を構造的に排除した
- **プレイ中の Esc は、リザルト用のキー割り当てに一切奪われない。** `routeKeydown` は `phase === "result"` のときしか `resolveResultKey`（Esc → メニューへ戻る、を含む）を参照しないため、Normal/Insert mode 中の Esc は常に既存の意味（Insert mode 脱出、または Normal mode でのペンディングコマンドのキャンセル）のまま残る。誤操作でプレイ中の進行を失わせないための意図的な制約であり、ゲーム中のメニュー復帰はマウスまたは画面上のボタンに限定する
- **修飾キー（Cmd/Ctrl/Alt）付きの入力は全画面で素通しする**（`src/app/keyInput.ts` の `hasModifierKey`）。Shift は対象外とする（`?` や大文字の入力そのものが Shift 前提のため）。ブラウザの既定動作（リロード等）を殺さないための必須条件とする
- **マウス/タップの導線は、独立したボタンではなく「キーキャップ」表示のクリックとして提供する**（`src/app/components/KeyHint.tsx` の `KeyHintRow`）。見た目はキー表示が主役で、クリック可能であることの主張はホバー/フォーカス時の色変化程度に留める。既存の「次へ」「リトライ」「メニューへ」「レベルをもう一周」等の独立ボタンはすべてキーキャップに置き換えた。例外は「プレイ中のメニューへ戻る」ボタンのみ — これはキーボード割り当てを意図的に持たない（下記参照）ため、対応するキーキャップが存在せず、通常のボタンのまま残す
- **プレイ中の「スキップ」は独立ボタンを置かず、キーヒントに `[s] skip` を追加して表現する**（`resolvePlayingKey`）。`s` は本サブセットのどの Vim コマンドにも使われていないため Normal mode との衝突はない。Insert mode 中はこのチェック自体を行わず、`s` は通常通り置換テキストとして入力される
- **カード等、キーキャップ以外のクリック可能要素（レベルカードなど）はそのまま残す。** 「独立ボタンをキーキャップに一本化する」のはキーキャップと同じアクションを重複して提供するボタンに限った話であり、レベルカード自体（クリックでそのレベルを直接プレイ）はキーキャップ「Enter: プレイ」と同じ結果に至る別経路として共存させる。タッチデバイスでも、キーボード操作なしにカードのタップだけで全遷移が完結する

## Consequences

- キー割り当てが1ファイルに集約されるため、新しい画面やダイアログを追加する際に「キー操作を定義したか」のレビューが容易になる（CLAUDE.md「UI 操作」に明文化）
- `ChallengeRound` の keydown ハンドラは、プレイ中の値（buffer/inputState/keys/mistakes/commands/result/timeLeft）と各種コールバックをすべて ref 経由で読むようになり、以前から efficiency の観点で指摘されていた「毎キー入力でリスナーを張り替える」問題も副次的に解消された
- リトライ（同じ問題をもう一度）は `ChallengeRound` の `key` に `retryNonce` を含めることで実現し、既存の「`challenge.id` をキーにしたフルリマウントでラウンド状態をリセットする」パターンをそのまま流用した。専用のリセット処理は追加していない
- 「連打耐性」の核心（ref を介した単一リスナーはフェーズ切り替えの隙間を持たない）は `src/core/keymap.ts` の `routeKeydown` に対する純粋関数テストで検証している。実際の DOM/React タイミングを再現する結合テストではない点は限界として残る（下記 Alternatives Considered 参照）
- キーキャップへの一本化により、`ResultBanner` / `LevelSummaryScreen` / `MenuScreen` の「押せるキー一覧」がそのまま実際のクリック導線になり、テキストだけの説明表示（例: 旧 `keyHint.result` の1行テキスト）を持つ必要がなくなった。i18n 辞書は「アクション名」単位（`keyHint.next` / `keyHint.retry` など）に分割され、`common.backToMenu` や `menu.play` など既存の文言をキーキャップのラベルとしても再利用している

## Alternatives Considered

- **`result` の有無で2つの `useEffect`（プレイ用・リザルト用）を張り替える設計** — シンプルだが、上記の「リスナー張り替えの隙間」問題を構造的に抱えるため却下
- **jsdom / @testing-library/react を導入し、実際の DOM イベント連打をシミュレートする結合テストを書く** — 「連打耐性」をより直接的に検証できるが、本プロジェクトは `vitest` の `environment: "node"` を前提とした純粋ロジック中心のテスト方針（CLAUDE.md「テスト方針」: 「UI のテストは後回しでよい」）を取っており、この1機能のためだけにテスト基盤を拡張するのは過剰と判断した。ref 分岐の核心ロジックを `core/keymap.ts` に抽出し、そちらを純粋関数としてテストする方式で代替した。将来 UI テストの必要性が高まった時点で改めて検討する
- **ゲーム中の Esc をメニュー復帰にも割り当てる** — Vim の Esc に慣れたプレイヤーの誤操作で、進行中のラウンド（と、まだ記録されていない Attempt）を失うリスクが高いため却下。中断は明示的なボタン操作のみとする
- **レベルカードをクリックしても即プレイせず、まず選択状態にするだけにして、実際の開始は「Enter: プレイ」キーキャップのクリックに一本化する** — キーボード操作との対称性は高くなるが、マウス/タップ利用者にとっては1回のクリックで完結していた操作が2回に増えるだけで体験が悪化する。カード自体がキーキャップの代替ではなく独立した「直接プレイ」導線として自然に機能するため、共存させることにした

## Related Files

- src/core/keymap.ts
- src/core/keymap.test.ts
- src/app/keyInput.ts
- src/app/components/KeyHint.tsx
- src/app/pages/MenuScreen.tsx
- src/app/pages/LevelRound.tsx
- src/app/pages/LevelSummaryScreen.tsx
- src/index.css
