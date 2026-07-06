# メニュー画面とレベル選択は state ベースのスクリーン切替、Level は差別化フィールドを持たない

- Date: 2026-07-04
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

これまで vimgram は起動直後にいきなり最初のお題が始まる構成だったが、問題数が増えるにつれ「今どのレベルの何問目か」「どのレベルをクリア済みか」が分からなくなる。メニュー画面とレベル選択を導入し、ゲームフローを メニュー → レベル選択 → そのレベルの出題 → レベル別サマリ → メニュー に変える。

## Decision

- **画面遷移はルーターを導入せず、`screen: "menu" | "game" | "summary"` の判別可能ユニオンで切り替える**（`GamePage` が保持し、`MenuScreen` / `LevelRound` / `LevelSummaryScreen` を出し分ける）。vimgram は静的サイトで単一ページ内の一方向フロー（メニュー→レベル→サマリ→メニュー）しか持たず、レベル直リンクや戻る/進むのブラウザ操作対応は現時点で価値がない
- **Level は Challenge の既存フィールド `difficulty`（1〜5）から導出する**。`Challenge` スキーマに level 用の新フィールドは追加しない。`src/core/levels.ts` の `groupByLevel` が difficulty ごとに Challenge をグルーピングし、メニューの表示レベル数もここから自動的に決まる（Level 5 の問題を追加すれば自動的にメニューに現れる）
- **レベルのクリア状況（クリア数/Great数）は Attempt 履歴から都度導出する**（`src/core/progress.ts`）。専用の進捗フィールドを別途永続化はしない。クリア = そのお題に成功した Attempt が1件以上、Great = idealKeyCount 以下のキー数で成功した Attempt が1件以上、と定義する
- Star ボタンは「レベル一式の初クリア」時にレベルサマリ画面へ表示する。判定はレベル選択時点でのクリア状況（`wasFullyClearedBefore`）とレベル終了時点でのクリア状況を比較し、false → true に変わった瞬間だけ表示する

## Consequences

- レベル進行 UI が整ったことで、GitHub Star ボタンの表示条件を ADR「GitHub Star ボタンは自作 + REST API で実装する」が本来意図していた「レベル一式の初クリア」に戻せる（それまでは暫定的に「全問1周のセッションサマリ」で代替していた）
- Challenge の JSON スキーマは変更不要（後方互換）。既存の問題データはそのまま新しいメニューに反映される
- Attempt 履歴が空（初回訪問・localStorage 無効環境）でもクリア状況の導出は 0 件として扱われ、エラーにならない
- URL からレベルを直接開く・ブラウザの戻る/進むでレベル間を移動する、という導線は持たない（将来必要になれば Phase 3 以降で URL ルーティングとして再検討する）

## Alternatives Considered

- **React Router 等のルーター導入** — レベル直リンクやブラウザ履歴連携ができるが、vimgram は静的サイト・単一フローで十分であり、CLAUDE.md の「最小限の Vim サブセット」という設計方針とも噛み合わないため却下
- **Challenge に `level` フィールドを追加** — difficulty と level が別概念になり得る柔軟性は得られるが、現状は 1:1 で十分であり、二重管理・スキーマ変更・既存問題データの移行コストに見合わないため却下。将来 difficulty と level を分離する必要が出た時点で改めて検討する

## Related Files

- src/core/levels.ts
- src/core/progress.ts
- src/app/pages/GamePage.tsx
- src/app/pages/MenuScreen.tsx
- src/app/pages/LevelRound.tsx
- src/app/pages/LevelSummaryScreen.tsx
