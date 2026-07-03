# 正誤判定は最終状態の一致で行い、3段階で評価する

- Date: 2026-07-03
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

Vim では同じ結果に到達する操作が複数ある（例: `df"` でも `dt"` + `x` でも、極端には `x` の連打でも同じテキストになり得る）。期待コマンドとの完全一致で判定すると、正しい編集をしたユーザーを不正解にしてしまい、ゲームが「暗記クイズ」に堕ちる。

## Decision

- 判定の基本は **最終状態の一致**（`text === expected.text`。必要に応じて cursor / mode / yankRegister も比較）。コマンド列一致では判定しない
- 評価は3段階とする:
  - **クリア**: 期待結果に到達した
  - **最短級（Great）**: クリアかつ `keys.length <= idealKeyCount`
  - **冗長クリア**: 結果は正しいがキー数が多い。「より Vim らしい操作」として想定コマンドを提示する
- 正解後は想定コマンドを分解して解説する（`df,` = `d`（削除）+ `f,`（次の `,` まで移動））

## Consequences

- どんな解き方でも結果が正しければ報われ、そのうえで最短操作へ誘導できる（学習体験の核: 結果を見る → より良い操作を知る）
- 問題定義に `expected`（期待状態）と `examples[0]`（想定解）の両方が必要になる（→ ADR `challenges-as-json-with-ci-verification`）
- `idealKeyCount` の妥当性が評価の公平性を左右するため、CI で `examples[0]` のキー数と一致することを検証する

## Alternatives Considered

- **期待コマンド完全一致** — 別解を不正解にしてしまい、暗記クイズ化するため却下
- **結果一致のみ（評価なし）** — `x` 連打と `df"` が同評価になり、「編集したい範囲をモーションとして捉える」という学習目標に誘導できないため却下。3段階評価で「正解だが、もっと良い操作がある」を伝える

## Related Files

<!-- List files related to this decision (e.g. internal/search/search.go). -->
