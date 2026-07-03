# GitHub Star ボタンは自作 + REST API で実装する

- Date: 2026-07-03
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

リポジトリへのスターを促すボタンをヘッダーとクリア画面に置きたい。GitHub API でのスター操作は認証が必要なため、ボタンから直接スターは付けられず、リポジトリへの誘導 + スター数表示が現実的な実装となる。

## Decision

- **自作ボタン + GitHub REST API** で実装する。スター数は `https://api.github.com/repos/<owner>/vimgram` から取得し、localStorage に数時間キャッシュする（未認証 API は IP あたり毎時60リクエストの制限があるため）。取得失敗時はスター数非表示のリンクボタンとして成立させる
- 配置はヘッダーに常設。クリア画面では毎回表示せず、「レベル一式の初クリア」「初 Great 評価」など達成感のピークに合わせて表示する

## Consequences

- UI デザインの一貫性を保てる。外部スクリプト依存もない
- スター数キャッシュ・失敗時フォールバックの実装が必要（小規模）
- クリア画面での表示タイミング制御（達成イベントの判定）が必要になるが、これは学習ゲームとして「役に立ったと感じた瞬間に出す」ための意図的な設計

## Alternatives Considered

- **buttons.github.io（公式ウィジェット / react-github-btn）** — 実装は最も手軽だが、iframe による外部スクリプト読み込みが発生し、見た目が vimgram のターミナル風 UI に馴染まないため却下

## Related Files

<!-- List files related to this decision (e.g. internal/search/search.go). -->
