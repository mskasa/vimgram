# 単一の「トワイライト」テーマを CSS カスタムプロパティで一元管理する

- Date: 2026-07-04
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

これまでの UI は各コンポーネントが `#444` や `#1e1e1e` のような色をその場でハードコードしており、画面が増えるにつれ配色に一貫性がなくなっていた。またコンテンツ幅・タイポグラフィのサイズも各所でバラバラだった。メニュー・ゲーム画面・リザルト・サマリ・プレイグラウンドを通して一貫した見た目にする。

## Decision

- **色は `src/index.css` の `:root` に定義した CSS カスタムプロパティ（デザイントークン）としてのみ管理する。** コンポーネント側のハードコードされた hex 値はすべて `var(--token-name)` 参照に置き換えた。トークンは「地の色」（`--bg-*` / `--border-*` / `--text-*`、藍〜菫系）と「暖色アクセント」（`--accent` / `--accent-soft` / `--warn-star`）に大別される
- **暖色アクセントの使用箇所は「選択中・主キー・Star・Great」のみに限定する。** それ以外の強調表現（バッファのカーソルハイライトなど）は地の色トークン（例: `--text-primary` を反転させたブロックカーソル）で表現し、暖色を安易に使わない。キーヒントの「キーキャップ」表示でも、行の主アクション（Enter 等）だけを `--accent` で強調し、その他は中立色（`--text-secondary` / `--bg-key` / `--border-strong`）に留める（`KeyHintItem.primary` フラグ、`.vg-keycap-key--primary`）
- **ライト/ダークの自動切替は導入しない。** `color-scheme: dark` を明示し、単一の「トワイライト」テーマとして固定する。CSS カスタムプロパティは値を1箇所で変更すれば全体に反映されるため、将来的にテーマを増やす場合も `:root` の定義を差し替える／`data-theme` 属性で切り替える形で対応でき、コンポーネント側の変更は不要になる
- **コンテンツ幅は `.vg-container`（`max-width: 1200px; margin-inline: auto; padding-inline: 2rem`）で統一する。** ヘッダーの背景バーのように全幅であるべき要素と、コンテンツ自体の最大幅は分離し、外側の全幅要素の中に `.vg-container` を持つ内側の要素を置く構成にする（`App.tsx` のナビゲーションを参照）
- **レベルカードのグリッドは固定列数ではなく `repeat(auto-fit, minmax(260px, 1fr))` にする。** ウィンドウ幅に応じて 4 → 2 → 1 列に自然に折り返す
- **タイポグラフィのサイズも `--font-*` トークンとして定義する。** 見出しは `h1`/`h2`/`h3` の要素セレクタに対する既定スタイルとしてグローバルに適用し、コンポーネント側で個別にフォントサイズを指定しない
- **バッファ表示（`BufferView`）の幅は 900px を上限とする。** 編集対象のテキストが長くなっても視線移動が練習の妨げにならないようにするための制約で、それを超える場合は横スクロールに任せる

## Consequences

- 新しい色を使いたくなった場合、まず既存トークンで表現できないか検討することが設計上のデフォルトになる。どうしても新しい色が必要な場合は `:root` にトークンを追加し、この ADR を更新する
- ネイティブな `<button>` 要素にもグローバルなベーススタイル（`src/index.css` の `button { ... }`）を与えた。キーキャップ（`.vg-keycap`）やレベルカードのボタンは `all: unset` またはインラインスタイルの完全指定でこれを上書きしており、意図しない衝突はない
- `disabled` 属性は「選択中のナビゲーションタブ / ロケール」を表す意味で使われている（`App.tsx` の Game/Playground 切替、`LocaleToggle` の EN/JA）。これをグレーアウトではなく `--accent` を使った「選択中」の見た目にした。レベルカードの「選択中」表現と同じ思想の適用である

## Alternatives Considered

- **Tailwind CSS 等のユーティリティフレームワーク導入** — トークン管理も容易になるが、CLAUDE.md の「最小限の Vim サブセット」という技術選定方針（新規依存を増やさない）と噛み合わないため却下。プレーンな CSS カスタムプロパティ + インラインスタイルという既存パターンの延長で十分だった
- **ライト/ダーク切替を今回あわせて実装する** — スコープ外として明示的に依頼されておらず、CSS カスタムプロパティの導入自体が将来のテーマ切替を安価にするため、今回は単一テーマに留めた

## Related Files

- src/index.css
- src/app/App.tsx
- src/app/components/BufferView.tsx
- src/app/components/StarButton.tsx
- src/app/components/KeyHint.tsx
- src/app/pages/MenuScreen.tsx
- src/app/pages/GamePage.tsx
- src/app/pages/PlaygroundPage.tsx
- src/app/pages/LevelSummaryScreen.tsx
