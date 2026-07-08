# プレイ画面を「バッファのステージ化」で再構成する

- Date: 2026-07-06
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

プレイ中の画面は、モード表示・残り時間・バッファ・入力キーの生文字列がそれぞればらばらの `<p>` として縦に並んでおり、状態を把握するのに視線があちこち移動する構造だった。リザルト画面（`docs/decisions/2026-07-06-result-screen-three-layer-structure.md`）で確立した「1つの主役ブロックに情報を集約する」設計をプレイ中にも展開する。

また、プレイ中のキーヒントに `[ 前の問題へ` が存在していた。調査の結果、`git log -p --follow -- src/core/keymap.ts` で確認できる唯一の該当コミット（`0a9806d`、2026-07-06、コミットメッセージ "update"）で `resolvePlayingKey` に `retry` と同時に追加されていることが分かった。このコミットはシャッフル・復習モード追加（本セッションの Step 16 に相当する作業）を含む大きな一括コミットで、対応する ADR（`2026-07-06-challenge-stats-shuffle-and-review.md`）にも `back`/`[` の追加は記載がない。この本 ADR の初版では「ユーザーからの指示なしに追加されたスコープ外機能」と判断して削除したが、ユーザーから「削除指示は自分の勘違いだった、元に戻してほしい」との訂正があったため、`[ 前の問題へ` は維持する（本 ADR を同日中に修正）。

## Decision

- **プレイ中の情報を「コンテキスト（13px）→ お題（19px前後）→ バッファカード → 入力表示 → 静音フッター」の縦の階層に再構成した。** 実装は `src/app/pages/LevelRound.tsx` の `ChallengeRound` と、新設した `src/app/components/BufferStage.tsx`
- **バッファカード（`.vg-stage`）は、モードバッジ（左）+ 残り秒数（右、時計アイコン）のヘッダー行、拡大したバッファテキスト（26px、`BufferView` の新しい `size="stage"` バリアント）、下辺のタイマーバーを1枚にまとめた。** モードバッジは NORMAL が控えめな菫系、INSERT が `--accent` 系（暖色アクセントの許可された用途の1つ）で、`c` 系問題でのモード遷移が一目で分かるようにした
- **タイマーバーの幅は `timeLeft / timeLimitSec` からその都度計算するだけで、専用の RAF ループは持たない。** CSS の `transition: width 1s linear` により、既存の秒単位の `timeLeft` state が更新されるたびに滑らかに縮む見た目になる。判定に使う残り時間の真実は既存の `ChallengeRound` の `timeLeft` state のままで、表示側は何も新しい時計を持たない
- **残り20%を切ったらタイマーバーの色を `--success` から新設の `--miss` に変える。** リザルト画面の失敗色トークンをプレイ中の警告色としても再利用した（用途が「あと少しで失敗」という意味的に近い場面のため、流用として妥当と判断した）
- **入力表示は「入力キー: （なし）」という生文字列をやめ、打ったトークンをキーキャップの連なりとして表示する。** リザルト画面の `CommandBreakdown` と同じキーキャップの見た目（`.vg-keycap-key`）を流用し、視覚言語を統一した。未入力時は「入力」ラベルのみを表示し、「（なし）」のプレースホルダは出さない
- **pending 状態の可視化をプレイグラウンド（14-2）の `describePending` と同じ「`InputState` の phase を切り替えて一言添える」構造で導入した。** ただし文言はプレイ画面専用の新しい辞書キー（`game.pendingOperator` など）を用意した: プレイグラウンドの一言は「d2 — モーション待ち」のような添え書きだったが、プレイ画面では `operatorPending` 中に「オペレータ待機中」という文言そのものが画面に出ることが完了条件として明示されており、プレイグラウンド側の既存文言（「モーション待ち」）とは表現が異なるため
- **`[ 前の問題へ`（`resolvePlayingKey` の `"back"` アクション）は維持する。** 導入経緯の由来は上記 Context の通りだが、削除の指示自体がユーザーの勘違いだったため復元した。フッターの `s`/`?`/`r` キーヒントの並びの末尾に `[` を戻してある
- **「メニューへ戻る」の独立ボタンは維持しつつ、`.vg-textlink`（控えめなテキストリンク）にスタイルを変え、静音フッターの右端に寄せた。** これは Step 11 で確定した意図的な例外（プレイ中は Esc を Insert 脱出専用にするため、中断はマウス導線とする）であり、Step 17-0 の重複ボタン一掃の対象ではない
- **フッターの `s`/`?`/`r` キーヒントは既存の `KeyHintRow` コンポーネントをそのまま使い、`.vg-footer-row` が `--font-keyhint` カスタムプロパティをローカルに上書き + `opacity: 0.85` を掛けることで見た目だけ静かにした。** `KeyHintRow` 自体に「静音バリアント」を持たせず、他画面（メニュー・サマリ・リザルト）への影響をゼロに保った

## Consequences

- `src/core/keymap.ts` の `PlayingKeyAction`（`"back"` を含む）と `resolvePlayingKey` の `[` ハンドリングは変更なし。`src/core/keymap.test.ts` のテストケースも維持
- `src/app/pages/LevelRound.tsx` の `onBack`/`back`（index を1つ戻す処理）も変更なし
- `src/app/i18n/strings.ts`: `keyHint.back` は維持。`game.timeLeft`/`game.keys` はバッファカードに吸収されて呼び出し元がなくなったため削除し、代わりに `game.inputLabel`/`game.pendingCount`/`game.pendingOperator`/`game.pendingCharTarget`/`game.pendingTextObjectTarget` を追加した。`game.keysNone` はプレイグラウンドの「入力したキー」表示がまだ参照しているため維持した
- `src/app/components/BufferView.tsx`: `compact?: boolean` を `size?: "default" | "compact" | "stage"` に一般化した。プレイグラウンドの呼び出しは `size` 省略時のデフォルト（従来の見た目）のまま変更なし
- `.vg-result-divider` は用途が「リザルト画面専用」から「リザルトとプレイ画面フッターの両方」に広がったため、`.vg-divider` に改名した

## Alternatives Considered

- **タイマーバーの補間に `requestAnimationFrame` を使う** — 見た目はより滑らかになるが、判定用の `timeLeft` state とは別に高頻度で再計算するループを持つことになり、「判定に使う残り時間の真実は既存ロジックのまま」という要件に対して不要な複雑さとリスクを追加する。CSS の `transition` だけで同じ体験（滑らかに縮むバー）を、真実のソースを増やさずに達成できると判断した
- **`[ 前の問題へ` を削除する（本 ADR 初版の決定）** — 「指示にない機能だから削除する」という判断だったが、削除指示自体がユーザーの勘違いだったため撤回し、維持することにした
- **静音フッター用に `KeyHintRow` へ `quiet?: boolean` プロパティを追加する** — CSS カスタムプロパティのローカル上書きだけで見た目を落とせたため、コンポーネント側に新しい分岐を増やす必要がなかった

## Related Files

- src/app/pages/LevelRound.tsx
- src/app/components/BufferStage.tsx
- src/app/components/BufferView.tsx
- src/core/keymap.ts
- src/core/keymap.test.ts
- src/app/i18n/strings.ts
- src/index.css
