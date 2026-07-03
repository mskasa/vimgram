# 0002: 技術スタックとして TypeScript + React + Vite（Web）を採用する

- Status: accepted
- Date: 2026-07-03
- Tags: tech-stack, architecture

## Context

vimgram は既存プロジェクトと無関係の新規プロジェクトであり、技術スタックを自由に選定できる。候補として Web 構成（TypeScript + React + Vite）と、Go + Ebitengine（2D ゲームエンジン）を比較検討した。

## Decision

**TypeScript + React + Vite による Web アプリ**とする。

- 状態管理: React state のみ（MVP では Zustand 等を導入しない）
- テスト: Vitest
- エディタ表示: 自作（CodeMirror 6 は将来検討。ただし CodeMirror の Vim mode に処理を任せる設計は採らない — ゲーム側で入力を解釈・採点・解説する必要があるため）

## Alternatives Considered

### Go + Ebitengine — 却下

- 本ゲームは実質「テキスト UI アプリ」であり、Ebitengine の強み（ゲームループ、スプライト描画、当たり判定）をほぼ使わない
- 逆に必要なもの（テキストレイアウト、リッチな解説表示、UI ウィジェット）は DOM/CSS が無料で提供するのに対し、Ebitengine では全て自作になる
- WASM ビルドでのブラウザ配信は可能だが、バイナリが数 MB〜十数 MB 級になり、テキスト主体のアプリには割に合わない
- キー入力の逐次処理は Ebitengine が素直だが、ブラウザの keydown でも同等のことが問題なくできる

### Go + Bubble Tea（TUI）— 次点

- ターミナルで動く Vim トレーナーは Vim ユーザーの生活圏にあり、対象ユーザーへの刺さり方は良い
- `go install` 一発の配布も Vim ユーザー層には摩擦にならない
- ただし「URL を送れば誰でも遊べる」リーチの広さを優先し、Web 構成を採用した

## Consequences

- URL 共有だけで誰でも遊べる（学習ゲームとして最大のリーチ）
- CodeMirror・i18n・学習履歴ダッシュボード等、Web 生態系の資産を将来利用できる
- コアエンジンのテスト容易性は Go と互角（→ ADR 0004 でコア分離により担保）
- ネイティブ配布・オフライン動作は失う（PWA 化で将来カバー可能）
