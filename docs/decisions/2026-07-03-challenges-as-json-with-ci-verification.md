# 問題データは1問1ファイルの JSON とし、Zod スキーマ + CI で自動検証する

- Date: 2026-07-03
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

問題データを外部コントリビュータが追加しやすくしたい。当初案は `challenges.ts` に TypeScript でベタ書きする方式だったが、TS を書けない人の参入障壁になり、またコントリビュートされた問題の品質（本当に解けるか）をレビューで人力確認するのはコストが高い。

## Decision

- 問題は **1問1ファイルの JSON** として `challenges/` ディレクトリに置く
- スキーマは `src/core/challenges.ts` に **Zod** で定義し、TS 型はそこから導出する。JSON Schema も書き出してエディタ補完に使えるようにする
- `examples[0]`（想定解）を必須とし、CI（Vitest）で全問題に対して以下を機械的に検証する:
  1. Zod スキーマ適合（ID 重複なしを含む）
  2. `execute(initial, examples[0])` の結果が `expected` に一致（＝想定解で実際に解ける）
  3. `idealKeyCount` が `examples[0]` のキー数と一致
- CONTRIBUTING.md に「この手順で JSON を置いて CI が通れば OK」と言い切れる手順を書く

## Consequences

- 問題追加 PR は「CI が通れば動作保証済み」となり、レビューはお題文の自然さの確認だけで済む
- 想定解の間違い・解けない問題はマージ前に自動で弾かれる
- Zod への依存が増える（コアの数少ない外部依存として許容）
- 将来のゲーム内問題作成モード（解いて確認 → JSON 書き出し → GitHub の PR 導線）への土台になる

## Alternatives Considered

- **challenges.ts に TS でベタ書き** — 型安全だがコントリビュートの参入障壁が高く、検証もビルド任せになるため却下
- **人力レビューによる品質担保** — 「解けない問題」の検出をレビュアーの注意力に依存し、スケールしないため却下。コアが純関数（ADR `core-engine-separation`）である以上、機械検証できる

## Related Files

<!-- List files related to this decision (e.g. internal/search/search.go). -->
