# 未対応キーは非破壊的なヒントで案内し、専用の検出ロジックを core に置く

- Date: 2026-07-06
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

Vim 経験者がプレイ中に反射で `i` を押すと、このゲームでは何も起きない（`i`/`a` 単体での INSERT mode 突入は意図的に非対応）。無反応のままだと「バグでは」と誤解されるため、静的な注釈（遊び方）と動的なフィードバック（プレイ中のヒント表示）の2段構えで案内する。

## Decision

- **「未対応キーが押された」の判定は `src/core/parser.ts` の純関数 `isUnsupportedIdleKey(wasIdle, result)` に集約する。** `ParseResult` の形だけでは判定できない: 「idle で未対応キーが押されて `initialInputState` に戻った」場合と「`operatorPending` 等の pending 状態が無効なキーでキャンセルされて `initialInputState` に戻った」場合（例: `dd` の2打目）は、結果の形が完全に同じになる。そのため呼び出し側が「このキーを打つ直前に本当に idle だったか」（`wasIdle`）を渡す設計にした。これにより `df,` の入力途中（`f` そのものや対象文字）が誤ってヒント対象になることもない
- **ヒント表示は `src/app/hooks/useUnsupportedKeyHint.ts` に共通化し、`ChallengeRound`（`LevelRound.tsx`）と `PlaygroundPage` の両方から使う。** `dedupe` オプションを持ち、`ChallengeRound` では `true`（同一ラウンド内で同じヒントは最大1回）、`PlaygroundPage` では `false`（素振り場なので毎回出してよい）を渡す。ラウンドが変わると `ChallengeRound` ごと再マウントされるため、「表示済みフラグ」は特別なリセット処理なしに自然に初期化される
- **`i`/`a` は専用文言、それ以外は汎用文言。** 汎用文言の対象からは、`s`/`?`/`r`/`[` のようにこの画面で既に機能が割り当て済みのキーは自然に除外される。これらは `parseKey` に渡る前の meta キー判定（`resolvePlayingKey`）で既に消費されており、`isUnsupportedIdleKey` の判定に到達すらしないため、除外のための特別な分岐を追加する必要はなかった
- **`ChallengeRound` 側は `t`/`show` 関数を ref 経由で読む。** `ChallengeRound` の keydown ハンドラは「マウント時に1度だけ登録し、以後は ref 経由で最新値を読む」設計（Step 11 の ADR 参照）になっており、ここに素朴に `t`（`useT()` は毎レンダー新しい関数を返す）を依存配列へ足すと、その設計の前提が崩れて実質「毎レンダー張り替え」に戻ってしまう。`PlaygroundPage` 側はもともと簡易な「状態が変われば張り替える」設計のため、`t` や `show` を素直に依存配列に含めている
- **（2026-07-06 追記）汎用ヒントの文言は画面ごとに分岐させず、`hint.unsupportedKey` 1本に統一する。** 初版では「このキーは未対応です。? で遊び方を確認できます」としていたが、プレイ中（`ChallengeRound`）の `?` は「遊び方」ではなく「ギブアップ」に割り当て済みであり（Step 12）、この文言のままだと誤ってギブアップを誘発しかねなかった。`? で遊び方` への言及を削除し、「このキーは vimgram では未対応です」に統一した。プレイグラウンドへの遊び方の導線は、両画面の上に常設されているヘッダーのタブバー（`App.tsx`）が既に兼ねており、追加の UI 要素は不要と判断した

## Consequences

- `isUnsupportedIdleKey` は core に置いたことで、DOM/React 抜きで単体テスト可能になっている（`src/core/parser.test.ts`）。特に「`dd` の2打目のような pending キャンセルは、結果の形だけでは未対応キーと区別できない」という非自明な性質をテストで固定した
- ヒント文言でキーに言及する際は `src/core/keymap.ts` の割り当てと矛盾しないことを確認する、という点を CLAUDE.md「UI 操作」に明文化した（本 ADR の教訓を再発防止として反映）

## Alternatives Considered

- **汎用ヒントの文言をプレイ中とプレイグラウンドで出し分ける（プレイ中は "?" に言及しない）** — 画面ごとに文言を分岐させると保守コストが増える上、今後さらに `?` の意味が画面ごとに変わる余地を残してしまう。1本の文言に統一し、そもそも矛盾が起きない表現にする方を選んだ
- **「未対応キー」の判定をコンポーネント側（app 層）に持たせる** — `InputState`/`ParseResult` の内部形状に依存する判定なので、`src/core/parser.ts` に置く方が自然で、かつ2箇所（`ChallengeRound`/`PlaygroundPage`）から重複なく使える

## Related Files

- src/core/parser.ts
- src/core/parser.test.ts
- src/app/hooks/useUnsupportedKeyHint.ts
- src/app/components/KeyHintToast.tsx
- src/app/pages/LevelRound.tsx
- src/app/pages/PlaygroundPage.tsx
- src/app/pages/MenuScreen.tsx
