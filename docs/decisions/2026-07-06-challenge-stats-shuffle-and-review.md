# challengeStats を進捗表示の正とし、シャッフルと復習モードの土台にする

- Date: 2026-07-06
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

これまでレベルカードのクリア数/Great数表示は、`Attempt` ログ（直近1000件でローテーションする生の試行履歴）をレベル選択のたびに毎回フィルタ・集計して求めていた。ログがローテーションすると古い問題の集計が静かに欠落しうる上、「全問クリア後はシャッフル」「未クリア/Great未達を横断的に復習」を実装するには、そもそも問題ごとの集計を都度計算ではなく安定して参照できる形で持つ必要があった。

## Decision

- **問題ごとの集計を `vimgram:challengeStats:v1`（`challengeId → { clears, greats, attempts, lastPlayedAt }`）として新設し、これを進捗表示・シャッフル判定・復習リストの唯一の正とする。** レベルカードの表示も、シャッフル判定（`isLevelFullyCleared`）も、復習リストの抽出（`buildReviewQueue`）も、すべてこのマップだけを参照し、`Attempt` ログを都度フィルタすることをやめた
- **`great`（そのラウンドが Great だったか）は Attempt 記録時に judge の結果から直接書き込み、あとから keyCount で再導出しない。** `Attempt.great` を新設し、`recordChallengeStats` はこの値をそのまま使う。理由は二重実装の回避: 「Great の条件」は `judge.ts` に既に1つあり、`challengeStats.ts` 側で `keyCount <= idealKeyCount` を再計算する処理を持つと、将来 judge.ts 側だけ変更されて静かに食い違う余地が生まれる
- **既存ユーザーの移行は「初回ロード時に1度だけ、Attempt ログから再構築」する。** `rebuildChallengeStatsFromAttempts` が唯一の例外として `keyCount` からの Great 再導出にフォールバックする（`attempt.great` が存在しない古い記録のみ対象）。ログはローテーションしているため「ログにある範囲で再構築できればよい」という割り切りで、完全な復元は狙わない。再構築後は結果を保存し、以後は `recordChallengeStats` による増分更新のみになる
- **シャッフルは、レベルの全問題が `challengeStats` 上でクリア済み（`clears >= 1`）になっている場合だけ発生する。** 初見のプレイヤーにとって重要な「比較学習ペアが隣接する固定順」を崩さないための条件分岐で、`GamePage.tsx` の `handleSelectLevel` が選択時に一度だけ判定し、順序を確定した配列を `screen` state に保持する（レベルの再選択がある限り毎回再判定するので、`LevelRound` 自身は「今の並びで最初から最後まで進むだけ」のシンプルな責務のままにできた）
- **シャッフルは `core/shuffle.ts` の Fisher-Yates 実装 + RNG 注入で行う。** `Math.random` を直接使わず引数として渡す設計にしたのは、テストで「同じシードなら同じ順序になる」ことを検証するため
- **復習モードは「未クリア」「Great 未達」の2バケットをレベル横断で集め、`lastPlayedAt` の古い順に出題する。** 本格的な間隔反復（SRS）アルゴリズムではなく、「一番放置されている問題を先に出す」という最小限の近似
- **`GamePage` の `Screen` union は `level: Challenge["difficulty"] | null` で「単一レベルのセッション」と「レベル横断の復習セッション」を1つの型で表現する。** `null` が復習を表す。ほとんどの挙動（`LevelRound` に渡す `challenges`、リザルト画面、Attempt/challengeStats の更新経路）が両者で完全に共通なので、別のユニオンメンバーとして分岐を増やすより、この1フィールドの違いに閉じ込める方が見通しがよいと判断した。「初回レベルクリア」の Star ボタン判定だけは `level !== null` のときのみ行う（復習セッションには「初クリア」という概念がないため）
- **メニューの選択肢（レベルカード + 復習エントリ）は1つのフラットな配列として h/l ナビゲーションする。** 復習エントリが 0 件のときは選択をスキップする（`isSelectable`）。`challengeStats` が空（1件もプレイしていない）の場合は復習セクションごと非表示にする

## Consequences

- `src/core/progress.ts` の `summarizeChallengeProgress`（Attempt 配列を受け取っていた版）は削除し、`summarizeLevelProgress`/`isLevelFullyCleared` は `ChallengeStatsMap` を受け取るシグネチャに変更した。呼び出し側（`MenuScreen.tsx`/`GamePage.tsx`）もすべて追従済み
- レベルカードの「シャッフル」表示、復習セクションの2エントリなど、UI 面の変更は CLAUDE.md「永続化」節に判定条件ごと明文化した
- `challengeStatsStorage.ts` は `attemptStorage.ts` と同じ isStorageAvailable/try-catch パターンを踏襲しており、共通化はしていない（既存の `starCache.ts`/`locale.ts` との重複も同様に許容している方針を継続）

## Alternatives Considered

- **`Attempt` ログを都度集計し続け、シャッフル/復習だけ別ロジックで対応する** — ログのローテーションにより古い問題の集計が欠落するリスクが常に残る上、都度集計のコストがレベルカード表示のたびに発生する。集計を1つの安定したストアに切り出す方が筋が良いと判断した
- **復習セッションを `Screen` の別ユニオンメンバー（`{ type: "review"; ... }`）として分離する** — レベルセッションとの共通点が非常に多く（`LevelRound` へ渡す props、リザルト画面、Attempt 更新経路がすべて同じ）、別メンバーにすると分岐が増えるだけだった。`level: number | null` の1フィールドで表現する方が差分が小さかった

## Related Files

- src/core/challengeStats.ts
- src/core/challengeStats.test.ts
- src/core/shuffle.ts
- src/core/shuffle.test.ts
- src/core/reviewQueue.ts
- src/core/reviewQueue.test.ts
- src/core/progress.ts
- src/core/progress.test.ts
- src/core/attempt.ts
- src/app/challengeStatsStorage.ts
- src/app/pages/GamePage.tsx
- src/app/pages/MenuScreen.tsx
- src/app/pages/LevelRound.tsx
- src/app/pages/LevelSummaryScreen.tsx
