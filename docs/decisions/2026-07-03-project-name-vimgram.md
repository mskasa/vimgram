# プロジェクト名を vimgram とする

- Date: 2026-07-03
- Type: ADR
- Status: Active
- Author: masahiro.kasatani

## Context

Vim のオペレータ＋モーション学習ゲームのプロジェクト名（リポジトリ名）を決める必要があった。本プロジェクトの核は「Vim コマンドの暗記」ではなく「operator + motion という編集文法の習得」であり、名前にもこのコンセプトを反映したい。

## Decision

**vimgram**（Vim + grammar）とする。

## Consequences

- 「文法学習」というプロジェクトの核が名前に埋め込まれ、「Vim クローンではないか」という誤解を招きにくい
- 検索上、既存の有名プロジェクトと競合しない
- ドメイン（vimgram.dev 等）やロゴへの展開がしやすい

## Alternatives Considered

- **vim-kata** — コンセプトには合うが、既存の複数プロジェクト（dankilman/vim-kata、adomokos/Vim-Katas 等）と衝突するため却下
- **vimgolf 系** — 有名サービス VimGolf と衝突するため却下
- **verb-noun** — Vim の文法（動詞＋名詞）を最も正確に表すが、Vim を含まず抽象的すぎるため次点
- **vim-drills / operator-dojo / vim-gym** — 分かりやすいが、文法学習というコンセプトの固有性が弱い
- **dfq / ciw-game 等のコマンド由来名** — 知らない人には暗号になるため却下

## Related Files

<!-- List files related to this decision (e.g. internal/search/search.go). -->
