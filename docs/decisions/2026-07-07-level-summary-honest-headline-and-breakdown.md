# レベルサマリ画面を「結果に正直な見出し」+ 集計カード + 問題別内訳で再構成する

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

レベルサマリ画面は、1問でも落としているセッションでも一律「レベルクリア」という見出しを出しており、実際の結果と食い違う場面があった。集計もスラッシュ区切りの1行テキスト（`セッション — 挑戦数: N / クリア数: N / Great数: N / 合計スコア: N`）で、リザルト画面・メニュー画面で確立した「カード + 進捗バー」の視覚言語とも断絶していた。また、セッション中に何を解いたかの内訳（問題ごとの判定）を表示する手段がそもそも存在しなかった。

内訳を作るには、セッション中に「どの問題が最終的にどう終わったか」を記録する経路が必要だったが、既存の `LevelRound`/`ChallengeRound` は集計値（`LevelSessionStats`: attempted/cleared/great/totalScore）だけを積み上げており、しかも `skip` は `onRoundEnd` を一切呼ばずに `onNext()` へ直行していたため、スキップした問題は `attempted` にすら含まれていなかった。

## Decision

- **セッション中に解いた全問題の「最終結果」を、問題ごとに1件ずつ記録する経路を新設した。** `src/core/sessionSummary.ts` に `ChallengeSessionEntry`（challengeId/title/verdict/keyCount?/idealKeyCount?）を定義し、`LevelRound.tsx` が `index` をキーにした `Record<number, ChallengeSessionEntry>`（ref、再レンダリング不要のため state ではない）に記録する。`ChallengeRound` の `endRound`（great/verbose/timeout/gaveUp）と `skip`（skipped）の両方から新設の `onChallengeRecorded` コールバック経由で書き込む
- **`index` をキーにすることで、セッション内リトライは自然に「最後の試行」で上書きされる。** challengeId ではなく配列内の位置でキーイングしているため、同じ問題に何度リトライしても同じスロットが更新されるだけで、レコードが重複しない
- **見出しの3分岐判定・全メトリクスを、この `entries` からの純関数（`summarizeSessionEntries`/`summaryHeadlineKind`）だけで決める。** `LevelSessionStats` 自体の数値（attempted 等）からは一切分岐を組み立てない。理由: `attempted` はスキップを含まない等、集計のスコープが `entries`（全問題を必ず1件含む）と微妙に異なり、2つの集計源を混在させると「見出しは クリア と言っているのに内訳にタイムアウトが残っている」という食い違いを生みかねない。見出しと内訳の両方が同じ1つの計算から出ることで、この食い違いが構造的に起きなくなる（CLAUDE.md に明文化）
- **見出しは3分岐: 全問 Great（`--accent`）/ 全問クリア・Great未達あり（`--success`）/ 未クリアあり（中立の `--text-primary`）。** 復習セッション（`level === null`）は同じ3分岐に「（復習）」という接尾辞を追加するだけで表現し、専用の分岐を増やさなかった
- **集計は3枚のメトリクスカード（クリア n/N + 進捗バー、Great 数 + ★、合計スコアの桁区切り表示）にした。** リザルト画面の詳細カードと共通の `.vg-card` グリッドクラスを、`.vg-result-cards` から `.vg-card-grid` へ改名して転用した（リザルト専用の名前をやめ、サマリでも使う一般名にした）
- **問題別内訳リストの判定バッジは、リザルト画面の大バナーとは異なるトークンマッピングを採用した: Great は `--warn-star`（`--accent` ではない）。** メニューの Great カウント表示と揃えた ─ 「頻出する小さな Great 表示」の文脈であり、リザルトの一度きりの祝福バナーとは役割が違うと判断した。失敗系（時間切れ/ギブアップ/スキップ）は3種とも `--miss` + 「失敗」の1バッジに統一し、失敗理由の違いはバッジではなく行のキー数列（時間切れ/ギブアップ/スキップという文言）で表現した
- **失敗行の背景は `color-mix(in srgb, var(--miss) 10%, transparent)` でごく薄く色付けした。** 新しいトークンを増やさず、CSS の `color-mix()` で既存の `--miss` から動的に導出した
- **レベル説明の辞書（`LEVEL_DESCRIPTION_KEYS`）を `MenuScreen.tsx` から `src/app/levelDescriptions.ts` に切り出した。** サマリ画面のコンテキスト行（レベル番号 + レベル説明）でも同じ辞書が必要になったため、2画面が別々に定義して食い違うリスクを避けた
- **プレイグラウンド・サマリの `<h1>` を 30px（メニューと同じ）に統一した。** プレイグラウンドの他の部分（配色・キーヒント・レイアウト）は既にトークン参照のみで構成されており、旧デザインの残骸（ハードコードされた色・独自タイポグラフィ）は見当たらなかった

## Consequences

- `src/core/sessionSummary.ts`（+ テスト）を新設。`ChallengeSessionEntry`/`SessionSummary`/`summarizeSessionEntries`/`summaryHeadlineKind` はいずれも純関数・純データで、DOM/React に依存しない
- `src/app/pages/LevelRound.tsx`: `LevelSessionResult`（`LevelSessionStats & { entries }`）を新設し、`onLevelComplete` の型をこれに変更。`GamePage.tsx` の `Screen` 型・`handleLevelComplete` も追従
- `src/app/pages/LevelSummaryScreen.tsx` を全面的に書き直した。`session.title`/`session.attempted`/`levelSummary.title` は呼び出し元がなくなったため削除し、`session.great`/`session.cleared` の ja 値から日英混在の「数」接尾辞を除去した（`menu.great` で Step19 に行ったのと同じ修正をここにも適用）
- `.vg-result-cards` → `.vg-card-grid` に改名（`LevelRound.tsx`/`LevelSummaryScreen.tsx` 両方の参照を追従）
- `src/app/levelDescriptions.ts` を新設し、`MenuScreen.tsx`/`LevelSummaryScreen.tsx` の両方から参照するようにした

## Alternatives Considered

- **`LevelSessionStats` の既存の数値（attempted 等）から見出し分岐を組み立てる** — `attempted` がスキップを含まない等、`entries` とスコープが微妙に異なり、2つの集計源が将来ズレるリスクがあった。`entries` を唯一の正にすることでこのリスクを構造的に排除した
- **問題別内訳の Great バッジも `--accent` にする（リザルトの大バナーと統一）** — メニューの Great カウント表示は既に `--warn-star` を使っており、「頻出する小さな Great 表示」としての一貫性を優先した。`--accent` はリザルトの一度きりの祝福という役割に残した
- **失敗理由（時間切れ/ギブアップ/スキップ）ごとに別々のバッジ色/アイコンを用意する** — 3種とも「クリアできなかった」という点では同じで、バッジを3種に増やす実益が薄い。理由の区別はキー数列のテキストに委ねた

## Related Files

- src/core/sessionSummary.ts
- src/core/sessionSummary.test.ts
- src/app/pages/LevelRound.tsx
- src/app/pages/GamePage.tsx
- src/app/pages/LevelSummaryScreen.tsx
- src/app/pages/PlaygroundPage.tsx
- src/app/levelDescriptions.ts
- src/app/pages/MenuScreen.tsx
- src/app/i18n/strings.ts
- src/index.css
