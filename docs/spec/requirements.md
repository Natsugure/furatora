# 要件: 長命ブランチを main のみにし、develop を廃止する (Issue #183)

## 概要

- **対象**: ブランチ運用と、それを前提にしたリポジトリの記述・CI・GitHub の設定
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) / [Issue #183](https://github.com/Natsugure/furatora/issues/183) /
  [ADR-0020](../adr/0020-main-only-long-lived-branch.md) / [ADR-0008](../adr/0008-environment-database-branch-mapping.md)
- **ブランチ**: `chore/issue183-main-only-branching`（`main` から）
- **信頼度**: 90%（高）
  - アプリのコードは変えない。変更は設定と文書
  - 不確かな点: ruleset の変更後に、PR のマージが想定どおり通るか（最初の PR のマージで確かめる）

## 背景

開発者が1人で、`develop` はリリース PR とコンフリクトの原因にしかなっていない。
また、main を守るはずの ruleset が対象を持たず、実際には何も守っていなかった。詳細は ADR-0020「コンテキストと課題」。

## 要件（EARS記法）

- **REQ-1**: リポジトリは、`develop` を長命ブランチとして前提にした記述・設定（CI の対象、CLAUDE.md、エージェント定義）を持たないこと
- **REQ-2**: 誰かが `main` へ直接 push したとき、GitHub はそれを拒否すること（管理者を含む）
- **REQ-3**: CI（`verify`）が成功していない PR の場合、GitHub は `main` へのマージを止めること（管理者が明示的に迂回する場合を除く）
- **REQ-4**: PR をマージするとき、GitHub はマージコミットだけを許し、マージ後に作業ブランチを消すこと
- **REQ-5**: 移行が終わったとき、`develop` ブランチと Neon の `preview/develop` ブランチは存在しないこと

## 受け入れ基準

| 要件 | 確かめ方 |
|---|---|
| REQ-1 | `rg develop` で、ADR の経緯の記述と `development`（Neon のブランチ名）以外に当たらない |
| REQ-2・REQ-3 | `gh api repos/Natsugure/furatora/rules/branches/main` に、削除・強制 push の禁止、PR 必須、`verify` 必須が出る |
| REQ-4 | `gh api repos/Natsugure/furatora` で `allow_merge_commit: true`、Squash・Rebase が `false`、`delete_branch_on_merge: true` |
| REQ-5 | `git ls-remote --heads origin develop` が空。Neon のブランチ一覧に `preview/develop` が無い |

## 範囲外

- `~/.claude/CLAUDE.md`（開発者の個人設定）の「main・develop に直接コミットしない」。害が無いため開発者の判断に任せる

## 依存関係とリスク

| 依存・リスク | 影響 | 緩和 |
|---|---|---|
| PR #182（Issue #143）が同じ `docs/spec/` を書き換えている | 後からマージする側がコンフリクトする | #182 を先にマージし、このブランチに main を取り込んで `docs/spec/` はこちらを採る |
| ruleset の設定ミス | main への PR のマージまで止まる | 管理者の除外を `pull_request` で残す。変更後に `rules/branches/main` で効いているルールを確かめる |
| Vercel の Production Branch が `main` でない | マージしても本番に出ない | 開発者が Vercel の設定を確かめる |
