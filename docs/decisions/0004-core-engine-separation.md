# 0004: Vim 操作エンジンを React 非依存の純関数コアとして分離する

- Status: accepted
- Date: 2026-07-03
- Tags: architecture, testing

## Context

このプロジェクトで最も重要な品質特性は、UI の見た目ではなく **Vim 操作エンジンのテスト容易性**である。モーションごとの境界ケース（行頭・行末、対象文字なし、count 付き、`f`/`t` の inclusive/exclusive 差)を網羅的にテストできなければ、学習ゲームとしての信頼性が成立しない。

## Decision

- コア（parser / motions / operators / execute / judge / challenges スキーマ）を `src/core/` に置き、**React・DOM・`src/app/` を import してはならない**というルールを課す
- コアはすべて純関数（`(state, input) => newState`）で書き、副作用・可変状態を持ち込まない
- ロケール判定など UI の関心事は app 側の責務とし、コアは必要な値（ロケール等）を引数で受け取る

## Alternatives Considered

- **monorepo（packages/vim-game-core + packages/web）** — 分離の強制力は最も高いが、個人プロジェクトの規模に対してツーリングが重い。単一リポジトリ + import ルールで十分と判断し却下（プロジェクトが成長したら再検討可）
- **UI と編集ロジックの一体実装** — 初速は出るが、境界ケースのテストが E2E 頼みになり本末転倒のため却下

## Consequences

- 「キー列 → 期待するバッファ状態」形式の高速なユニットテストで品質を担保できる
- 問題データの自動検証（ADR 0006）が可能になる — CI 上で想定コマンドをエンジンで実行できるのはこの分離のおかげ
- 将来 UI を CodeMirror に載せ替えてもコアは無傷
- import ルールは機械的に強制されない（lint ルール等での強制は将来検討）ため、レビューでの注意が必要
