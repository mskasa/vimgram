# スコア制の廃止と経過時間表示への置換

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

リザルトの判定バナーとサマリ画面は、それぞれ「スコア +2700」「合計スコア 16,050」という数字を表示していた。しかしこのスコアの実態は `1000 + 残り時間換算 + 効率ボーナス + streak ボーナス - ミス減点` という合成値で、比較対象（自己ベスト・他ユーザー・目安となる基準値のいずれも）を持たない、文脈のない数字として画面に浮いていた。プレイヤーがこの数字を見て取れる情報は乏しく、「大きい方がいい」以上の意味を持たせられていなかった。

一方、スコアの主成分は実質的に「速さ」（残り時間換算）であり、これは「かかった時間」としてそのまま見せた方が意味が自明である。

## Decision

- **スコア制を廃止し、リザルトの判定バナーとサマリの集計カードに経過時間を直接表示する。** 判定バナーは「タイム 2.4s」（小数点1桁）、サマリは「合計タイム」（クリアした問題の経過時間合計、回答閲覧後クリアは含めない）
- **経過時間は `Date.now()` ベースで精密に計測する。** ラウンド開始時刻（`ChallengeRound` マウント時）から終了時刻までの差分をミリ秒で取り、表示時に秒+小数点1桁へ丸める。従来のタイマー表示（1秒刻みのカウントダウン `timeLeft`）は残すが、これはあくまで残り時間の目安表示であり、経過時間の記録・表示には使わない（1秒単位では小数点1桁の表示ができないため）
- **時間切れ・ギブアップ・スキップでは経過時間を表示しない。** クリアできなかったラウンドの「かかった時間」は意味を持たない
- **回答閲覧後クリア（assisted）も経過時間を表示してよい。** スコア制のもとでは「スコア 0」という懲罰的な扱いをしていたが、経過時間表示に切り替えたことで、この特別扱いが不要になった。正式なクリアでないことは判定バナーの色（中立色）と文言（「クリア（回答閲覧後）」）だけで十分に伝わる
- **streak（連続クリア数）は表示用の指標としてそのまま残す。** `core/score.ts` にあった `nextStreak`/`RoundVerdict` を独立した `core/streak.ts` に移し、スコア計算の消滅に巻き込まれて消えないようにした
- **`Attempt.mistakeCount` は記録項目として残す。** スコア計算からは切り離されたが、将来の弱点フィードバック（「t 系モーションが苦手」等）に使うためのログとしての価値は変わらない

## Consequences

- `src/core/score.ts`/`src/core/score.test.ts` を削除。`RoundVerdict`/`nextStreak` は新設の `src/core/streak.ts`/`src/core/streak.test.ts` に移した
- `src/app/pages/LevelRound.tsx`: `RoundOutcome`/`LevelSessionStats` の `score`/`totalScore` を `elapsedMs`/`totalElapsedMs` に置き換えた。`endRound` はラウンド開始時刻（`startedAtRef`、`useRef(Date.now())`）からの経過時間を計算し、`recordAttempt` の `elapsedMs` フィールドにもこの精密な値を使うようにした（従来の `(timeLimitSec - finalTimeLeft) * 1000` という秒単位の粗い近似から置き換え、Attempt ログの精度も副次的に向上した）
- `endRound`/`skip` の呼び出し元から、もう使われない `finalTimeLeft`/`timeLeft` 引数を削除した（`noUnusedParameters`/未使用の ref を残さないため）
- `src/app/pages/LevelSummaryScreen.tsx`: 「合計スコア」の `MetricCard` を「合計タイム」に置き換えた
- `src/app/i18n/strings.ts`: `result.score`/`session.totalScore` を削除し、`result.time`/`session.totalTime` を追加した
- Attempt のスキーマ自体は変更していない（`elapsedMs` は既存フィールドで、計測方法だけを精密化した）

## Alternatives Considered

- **スコアの内訳（時間ボーナス・効率ボーナス・streak ボーナス等）を表示する** — 却下。数字が増えて複雑さが増すだけで、「比較対象がなく文脈がない」という根本問題は解決しない。むしろ「これは何と比べればいいのか」という疑問が複数の数字に対して発生し、悪化する
- **スコアをそのまま残し、経過時間を併記する** — 却下。スコアという情報量の少ない数字を残す理由がなくなる。経過時間だけで十分に「速さ」を伝えられる

## Future Work

問題ごとの自己ベストタイムの記録・表示は次の有力候補として温存する。`challengeStats` に `bestTimeMs` を1フィールド追加するだけで実現でき、経過時間表示という土台がすでにあるため実装コストは低い。

## Related Files

- src/core/streak.ts
- src/core/streak.test.ts
- src/app/pages/LevelRound.tsx
- src/app/pages/LevelSummaryScreen.tsx
- src/app/i18n/strings.ts
- CLAUDE.md
