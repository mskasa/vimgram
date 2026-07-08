# 到達度と習熟度の分離、および回答閲覧後クリアの扱い

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

`challengeStats` はこれまで `clears`/`greats`/`attempts`/`lastPlayedAt` という累積カウントのみを持っていた。これには2つの問題があった。

1. **忘却が復習に反映されない。** 一度 Great になった問題は `greats >= 1` が永久に残るため、「Great 未達の問題」の復習リストから二度と出てこない。実際には数ヶ月後に同じ問題を完全に忘れていても、復習に戻る経路がなかった。
2. **回答閲覧後のなぞりクリアが正規のクリア・Great として記録される。** ギブアップして想定コマンドを見た直後に、見たばかりのコマンドをそのまま入力してクリアすると、実力で解いたときと区別がつかず `clears`/`greats` が増え、下手をすると Great も付いてしまう。これは実力を偽装できてしまうということでもある。

未リリースのため、既存データの移行は考慮不要（移行コードを書かない）。

## Decision

- **`challengeStats` に到達度（`clears`/`greats`、累積・単調増加、既存のまま）と習熟度（`lastOutcome`、直近の実挑戦の結果、新設）という2つの軸を持たせた。** 進捗表示・レベルカードの数値・シャッフル判定・マイルストーン検知・Star 促しは到達度のみを参照し、一度も後退しない。復習リストの選定だけが習熟度（`lastOutcome`）を参照し、直近の結果次第で変動する
- **`lastOutcome` は `"great" | "clear" | "redundant" | "fail"` の4値。** 実際に判定が下った試行（スキップでも回答閲覧後クリアでもない）のたびに上書きされる。`judge()` の `"great"`/`"verbose"` 判定はそれぞれ `"great"`/`"redundant"` にマップし、`"clear"` は現状のこのエンジンでは到達しない値として予約した（judge.ts は `great`/`verbose` の二択しか返さないため）。将来 Great と冗長クリアの中間的な判定を追加する余地として型に残し、復習リストの「Great 未達」判定はすでに `"clear"`/`"redundant"` の両方を見るようにしてある
- **回答閲覧後クリア（assisted）は、`challengeStats` の `clears`/`greats`/`lastOutcome` を一切更新しない。** `attempts` のみ加算する。理由: 実力での再挑戦を促すには、この問題が「まだ習熟していない」という状態（直前の `lastOutcome`、多くの場合 `"fail"`）を保ったまま復習リストに残り続ける必要がある。もし `clears`/`greats` を更新してしまうと、なぞりクリアが実力によるクリアと区別できなくなる
- **「閲覧済み」はアプリセッション中のみ、メモリ上の `Set<string>`（`src/app/revealedTracker.ts`）で管理し、永続化しない。** リロードすれば同じ問題を「まっさらな状態」から解けて正規クリアになるが、これは意図的な割り切りである: リロードで自分を欺いて正規クリアの記録を得ることは可能だが、それは対戦相手のいないゲームで自分のスコアを騙すのと同じで、それ以上の実害がない。一方、この割り切りにより「セッションをまたいで閲覧状態を追跡する」ための永続化コード・移行コードが一切不要になり、実装が大幅に単純になる。加えて、リロードという自然な区切りが、同じ問題への再挑戦に時間差を作る（暗記ではなく本当に解けるかを試す機会になる）という副次的な利点もある
- **判定バナーは中立色（`--border-strong`/`--text-primary`）とし、Great の暖色（`--accent`）ともクリアの `--success` とも異なる扱いにした。** 「いい練習ではあるが、正規の実力証明ではない」ことを色でも誠実に伝える
- **スコアは 0、streak はギブアップ時点でリセットされた値のまま増やさない。** 「クリアした」という行為自体は Attempt ログに `success: true, assisted: true` として正直に記録するが、ゲームの得点・連続記録には一切寄与させない
- **（小修正）サマリの「未クリアあり」見出しのサブテキストは、残っている問題が全て assisted（実力での失敗が1件もない）の場合、「あと N 問で全問クリアです」ではなく「回答閲覧後にクリアした問題が N 問あります。後日自力で解くと正式なクリアになります」という専用文言に分岐する。** 前者の文言は「まだクリアできていない」という含みがあり、実際にはクリア済み（ただし閲覧後）であることと食い違うため。`SessionSummary` に `assistedCount` を追加し、`notClearedCount - assistedCount === 0`（純粋な失敗が0件）を分岐条件とした。真の失敗（timeout/gaveUp/skipped）が1件でも混ざっていれば、従来通りの「あと N 問」表示のままにする

## Consequences

- `src/core/challengeStats.ts`: `ChallengeStats` に `lastOutcome: LastOutcome` を追加。`AttemptOutcome` の形を `{ challengeId, timestamp, outcome: LastOutcome | null }` に変更した（`outcome: null` が「attempts のみ加算、他は不変」を表す、skip とassisted の共通の表現）
- `src/core/reviewQueue.ts`: 判定を `clears === 0` / `clears > 0 && greats === 0`（累積）から `clears === 0 || lastOutcome === "fail"` / `lastOutcome === "clear" || lastOutcome === "redundant"`（直近）に変更した
- `src/core/progress.ts`/`src/core/milestones.ts` は変更していない（到達度のみ参照する既存の実装のままで、この変更の影響を受けないことをテストで固定した）
- `src/app/revealedTracker.ts` を新設（モジュールレベルの `Set`、React state ではない）
- `src/app/pages/LevelRound.tsx`: `RoundResult` に `assisted: boolean` を追加し、`endRound` が `wasRevealed(challenge.id)` を見て判定・スコア・streak・Attempt・challengeStats・セッション内訳の全てで分岐するようにした
- `src/core/sessionSummary.ts`: `ChallengeSessionEntry.verdict` に `"assisted"` を追加。`summarizeSessionEntries` は assisted をクリアとして数えないため、assisted を含むセッションのサマリ見出しは「1周おつかれさまでした」（`partial`）になる
- `src/core/attempt.ts`: `Attempt.assisted?: boolean` を追加
- CLAUDE.md の「正誤判定と評価」「スコアリングと記録」「永続化」節を更新
- `"clear"` が現行 judge では到達しない予約値であること自体は、意図的にユニットテストで固定していない。将来この値を実際に生成する判定を追加したときにテストが障害にならないようにするため（型定義のコード内コメントで説明を残すのみ）

## Alternatives Considered

- **忘却を反映するために `clears`/`greats` を減算する** — 却下。「達成の巻き戻り」はプレイヤーにとって罰のように感じられ、Step 22 で導入したマイルストーン（一度全問クリアしたレベルは祝福済みのまま）とも直接矛盾する。到達度は増える一方、習熟度は独立して変動する、という2軸分離の方が両立できると判断した
- **「閲覧済み」を localStorage に永続化する** — スコープ外として明示されている。加えて、上記の「リロードは自分を欺くだけ」という割り切りにより、永続化する実益が薄いと判断した
- **`lastOutcome` に `"clear"` を実際に生成する新しい判定を追加する（例: Great と冗長クリアの中間）** — 今回のスコープ外。型だけ4値で用意し、実装済みの2値（`great`/`redundant`）でまず運用する

## Related Files

- src/core/challengeStats.ts
- src/core/challengeStats.test.ts
- src/core/reviewQueue.ts
- src/core/reviewQueue.test.ts
- src/core/progress.test.ts
- src/core/milestones.test.ts
- src/core/sessionSummary.ts
- src/core/sessionSummary.test.ts
- src/core/attempt.ts
- src/app/revealedTracker.ts
- src/app/pages/LevelRound.tsx
- src/app/pages/LevelSummaryScreen.tsx
- src/app/i18n/strings.ts
