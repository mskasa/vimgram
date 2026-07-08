# 達成（マイルストーン）検知をセッション種別から独立させる

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

「レベル全問クリア」の検知（Star ボタン露出のトリガー）は、これまで `GamePage.tsx` の `handleLevelComplete` がレベルセッション完了時にその場で計算していた（`wasFullyClearedBefore` と `isFullyClearedNow` を比較）。この実装はレベルセッションの完了イベントにしか接続されておらず、復習セッション（`level === null`）経由で、あるレベルの最後の1問をたまたまクリアして全問クリアを達成した場合、検知自体が発生しなかった（復習セッションは `isFirstFullClear` を常に `false` にしていた）。バグ報告どおり、達成検知がセッション種別に依存してしまっていたのが根本原因。

## Decision

- **検知を `challengeStats` の更新イベントそのものに接続し、画面・セッション種別を一切問わないようにした。** `src/core/milestones.ts` の `detectMilestones(prevStats, nextStats, challenges)`（純関数）が、更新前後の `challengeStats` を比較して新たに閾値を超えたマイルストーンを返す。呼び出し元は「今どの画面にいるか」「レベルセッションか復習セッションか」を一切知る必要がない
- **`challengeStatsStorage.ts` の `recordChallengeStatsForOutcome` に検知呼び出しを直接組み込んだ。** 呼び忘れを構造的に防ぐため、「stats を更新する」と「検知する」を同じ関数内で常にセットにした。呼び出し側（`LevelRound.tsx` の `endRound`/`skip`）は既存のコードのまま変更不要
- **未祝福キュー（`vimgram:milestones:v1`）を新設し、検知された達成を `celebrated: false` で積む。** 表示（Star ボタンの露出）を検知の瞬間から切り離すことで、「検知はしたがまだユーザーに見せていない」状態を永続化でき、セッションをまたいでも取りこぼさない
- **表示は `MilestoneBanner` という1つの自己完結コンポーネントに一本化した。** props なしで呼び出すだけで、マウント時に未祝福キューを読み、その場でバナー表示 + `celebrated: true` へのマークを行う。`LevelSummaryScreen`（主要な祝福面）と `MenuScreen`（サマリを経由せず Esc 等で離脱したセッションの保険）の両方にこの1コンポーネントを置くだけで済み、2箇所が別々に load/mark ロジックを持って食い違うリスクを避けた
- **`Milestone` はユニオン型にして、現状は `{ type: "levelFullyCleared"; level }` の1種類だけを持つ。** 将来「レベル N 全問 Great」を追加する際、`detectMilestones` に分岐を1つ足すだけで済むようにした
- **既存のレベルサマリ内の達成判定ロジック（`GamePage.tsx` の `wasFullyClearedBefore`/`isFullyClearedNow`/`isFirstFullClear`、`LevelSummaryScreen.tsx` の `showStarButton`/`levelSummary.firstClear`）は全て削除した。** 新機構への一本化のため、旧ロジックを並行して残さない

## Consequences

- `src/core/milestones.ts`（+ テスト）を新設。`Milestone`/`milestoneKey`/`detectMilestones`/`StoredMilestone`/`appendMilestones` はいずれも純関数・純データ
- `src/app/milestoneStorage.ts` を新設（`attemptStorage.ts`/`challengeStatsStorage.ts` と同じ isStorageAvailable/try-catch パターン）。読み込み時、`celebrated` フィールドを欠く要素は `celebrated: true` として読み替える防御的マイグレーションを持つ（このリポジトリにはまだ移行元データが存在しないが、将来のスキーマ変更に対する保険として最初から組み込んだ）
- `src/app/pages/GamePage.tsx`: `Screen` 型から `wasFullyClearedBefore`/`isFirstFullClear` を削除し、`handleLevelComplete` を大幅に簡略化した。シャッフル判定用の `isLevelFullyCleared` 呼び出し自体は `handleSelectLevel` にローカル変数として残した（マイルストーン検知とは別の既存の関心事のため）
- `src/app/pages/LevelSummaryScreen.tsx`: `isFirstFullClear` プロパティと `levelSummary.firstClear` の使用を削除し、`<MilestoneBanner />` に置き換えた
- `src/app/pages/MenuScreen.tsx`: レベルカード群の直前に `<MilestoneBanner />` を追加（保険）
- `src/app/i18n/strings.ts`: `levelSummary.firstClear` を削除し、`milestone.bannerTitle`/`milestone.levelFullyClearedPrefix`/`milestone.levelFullyClearedSuffix` を追加した

## Alternatives Considered

- **`GamePage.tsx` に復習セッション用の分岐を追加し、都度 `isLevelFullyCleared` を再チェックする** — セッション種別ごとに同じロジックを個別に実装することになり、今回のバグ（「検知がある画面/セッション種別でしか効かない」）を再発させるリスクの高い対症療法。検知そのものを画面から切り離す方が構造的に正しいと判断した
- **`MilestoneBanner` を持たず、`LevelSummaryScreen`/`MenuScreen` それぞれに load/mark ロジックを書く** — 2箇所が独立して同じロジックを持つと、片方だけ修正されて食い違うリスクがある。1つの自己完結コンポーネントに閉じ込める方が安全と判断した
- **未祝福キューを持たず、検知の瞬間にその場でバナーを出す** — 検知が発生する瞬間（`recordChallengeStatsForOutcome` 呼び出し時）は必ずしも「ユーザーに見せられる画面」のタイミングと一致しない（ラウンド中に発生することもある）。検知と表示を永続化されたキューで分離する必要があった

## Related Files

- src/core/milestones.ts
- src/core/milestones.test.ts
- src/app/milestoneStorage.ts
- src/app/challengeStatsStorage.ts
- src/app/components/MilestoneBanner.tsx
- src/app/pages/GamePage.tsx
- src/app/pages/LevelSummaryScreen.tsx
- src/app/pages/MenuScreen.tsx
- src/app/i18n/strings.ts
