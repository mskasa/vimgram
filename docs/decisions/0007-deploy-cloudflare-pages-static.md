# 0007: Cloudflare Pages にデプロイし、静的サイトの前提を維持する

- Status: accepted
- Date: 2026-07-03
- Tags: deploy, infrastructure

## Context

vimgram の MVP はサーバーを必要としない。Vim 操作エンジンは全てクライアントサイド、問題データはビルド時にバンドル、学習履歴は localStorage で足りる。静的ホスティング先として GitHub Pages / Cloudflare Pages / Vercel を比較した。

## Decision

- **Cloudflare Pages**（Git 連携による自動デプロイ）とする
- main へのマージで本番デプロイ、PR ごとにプレビュー URL が自動発行される
- CI（GitHub Actions）は PR 時に `vitest run` + `tsc --noEmit` のみ。デプロイは Cloudflare 側の Git 連携に任せる
- **MVP〜Phase 2 の間、完全な静的サイトとして設計する**。サーバーサイド処理（API、SSR、DB）を導入してはならない。バックエンドが必要な機能（ランキング、クラウド同期）は Phase 3 以降とし、その際は Pages Functions / Workers を候補とする

## Alternatives Considered

- **GitHub Pages** — リポジトリと同じ場所で完結する手軽さはあるが、PR ごとのプレビュー環境が標準でなく、`base` パス設定も必要なため次点
- **Vercel** — Cloudflare Pages とほぼ同等。決定打はなく、無料枠の広さ（帯域・リクエスト無制限）とプレビューの手軽さで Cloudflare を選択

## Consequences

- 問題追加や判定ロジック修正など小さい PR ごとに、実際に遊べるプレビュー URL で動作確認できる（Claude Code による開発フローとも相性が良い）
- 無料枠（月500ビルド、20,000ファイル/サイト、静的配信は帯域無制限）で費用が発生するシナリオは現実的にない
- 静的サイトの前提が設計上の制約として固定され、安易なバックエンド導入を防ぐ
- Cloudflare が新規プロジェクトに Workers（静的アセット配信）を推奨する流れがあるため、セットアップ時は公式ドキュメントの推奨に従う（無料枠の実質条件は同等）
