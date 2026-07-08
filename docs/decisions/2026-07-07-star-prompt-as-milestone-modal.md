# Star 促しをマイルストーン達成モーダルに一本化する

- Date: 2026-07-07
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

Step 22 で導入した祝福バナー（`MilestoneBanner`）は、達成のたびにテキストリンクとして `StarButton` を埋め込んでいたが、目立たず促しとして機能していなかった。一方で、達成のたびに毎回何らかの Star 訴求を出し続けるのは煩わしい。「希少な達成の瞬間だけ目立つ形で促し、ユーザーが一度でも意思表示したら二度と出さない」という設計に切り替える必要があった。

## Decision

- **Star 促しを、達成モーダル（`src/app/components/MilestoneModal.tsx`）という1つの専用サーフェスに一本化した。** 祝福バナー内の個別 Star リンクは廃止し、常設のヘッダー Star ボタン（`StarButton`）だけがそれ以外の Star 導線として残る
- **`vimgram:starPrompt:v1`（`{ status: "active" | "done" | "muted" }`）で、モーダルを出すかどうかの恒久状態を管理する。** 初期値は `"active"`。`[s]`（スターする）または `[n]`（今後表示しない）のどちらかを一度でも押した時点で `"done"`/`"muted"` に固定し、以後はセッションをまたいでも二度とモーダルを出さない。`[Enter]`/`[Esc]`（閉じるだけ）は状態を変えないため、次の達成では再度モーダルが出る
- **`status` が `"active"` でなくなった後の達成は、Star リンクなしの祝福バナー（`MilestoneBanner`）のみを表示する。** 達成の通知そのもの（「レベル 2 を全問クリアしました！」）は Star 促しとは独立した価値があるため、モーダルを止めても消さない
- **「スターしたかどうか」を検証する手段はないため、`[s]` は楽観的に `"done"` とみなす。** 実際にスターしなかったユーザーを追跡・再度促すような仕組みは持たない（CLAUDE.md に明文化）
- **モーダル表示中はキャプチャフェーズの `keydown` リスナー（`window.addEventListener("keydown", handler, true)`）で背後のキー入力を無条件に遮断する。** バブルフェーズで動く `LevelSummaryScreen`/`MenuScreen` 自身のキー処理より先に、DOM ツリー上のマウント順序に関係なく必ず先に実行されるため、モーダルが実際にどちらの画面の子として描画されても背後のキー操作が漏れない。認識する3キー（s/n/Enter・Esc）以外の全キーも `stopPropagation`+`preventDefault` で握りつぶし、フォーカスをモーダルに完全に閉じ込める
- **アクションは3つとも `KeyHintRow` のキーキャップとして統一表示する。** モーダルはゲーム外のダイアログだが、CLAUDE.md の「キーボード第一原則」を維持しつつマウスでも同じ3操作が可能なようにした
- **文言は懇願調にしない。** 達成内容 + 「vimgram が役に立っていたら、GitHub でスターをお願いします」の一言 + スター数のみで、1達成につき1モーダル

## Consequences

- `src/app/starPromptStorage.ts` を新設（`loadStarPromptStatus`/`markStarPromptDone`/`markStarPromptMuted`）。既存の `attemptStorage.ts`/`challengeStatsStorage.ts`/`milestoneStorage.ts` と同じ isStorageAvailable/try-catch パターンを踏襲
- `src/app/components/MilestoneModal.tsx` を新設。`src/app/milestoneText.ts` に `describeMilestone` を切り出し、`MilestoneBanner`（バナー）と `MilestoneModal`（モーダル）の両方から参照できるようにした
- `src/app/components/MilestoneBanner.tsx` は、`starPromptStatus` に応じて `MilestoneModal` か（Star リンクなしの）プレーンなバナーのどちらを描画するかを内部で振り分ける、引き続き props なしの自己完結コンポーネントのまま
- `src/app/components/StarButton.tsx` の `REPO_URL` を export し、モーダルの `[s]` アクション（`window.open`）から再利用した
- `src/index.css` に `--overlay-scrim`（`--bg-base` と同じ RGB の半透明値、モーダル背景の暗転用）と `.vg-modal-overlay`/`.vg-modal` を追加。アプリ初のモーダルのため、既存の視覚言語（`.vg-card` 相当のボーダー・角丸）を踏襲しつつ新設した
- CLAUDE.md の「GitHub Star ボタン」節・「達成（マイルストーン）検知」節を更新し、`vimgram:starPrompt:v1` を永続化のキー一覧に追加した

## Alternatives Considered

- **祝福バナー内の Star リンクをそのまま目立たせる（太字化・ボタン化等）** — 「希少な瞬間だけ強く促す」という要件に対し、バナーはすでに常時表示される情報（達成通知）と同居しており、そこにボタンを足しても埋没しやすい。独立したモーダルとして切り離す方が「ここぞ」という瞬間の演出になると判断した
- **バブルフェーズでキーボードを処理し、`stopPropagation` だけで背後を防ぐ** — バブルフェーズのリスナー同士は登録順（＝マウント順）に依存し、`MilestoneModal` が将来どちらの画面の子として描画されるかによって背後の画面のリスナーより後に登録される可能性があり、遮断が保証されない。キャプチャフェーズなら DOM 構造やマウント順に関係なく常に先に実行されるため、こちらを採用した
- **スター状態を GitHub API 等で検証する** — スコープ外として明示されている。認証が必要になり、静的サイトという前提（CLAUDE.md「静的サイトの前提を崩さないこと」）にも反する

## Related Files

- src/app/starPromptStorage.ts
- src/app/components/MilestoneModal.tsx
- src/app/components/MilestoneBanner.tsx
- src/app/milestoneText.ts
- src/app/components/StarButton.tsx
- src/app/i18n/strings.ts
- src/index.css
