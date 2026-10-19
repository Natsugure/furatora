# 設計: 長命ブランチを main のみにし、develop を廃止する (Issue #183)

運用と、その根拠は [ADR-0020](../adr/0020-main-only-long-lived-branch.md) による。ここには変更点だけを書く。

## リポジトリ内の変更

| ファイル | 変更 |
|---|---|
| `docs/adr/0020-main-only-long-lived-branch.md` | 新規（Proposed） |
| `docs/adr/README.md` | 一覧に 0020 を足す |
| `.github/workflows/ci.yml` | `push.branches` を `[main]` にする |
| `CLAUDE.md` | 「ブランチ運用」の節を足し、禁止事項から `develop` を外す |
| `.claude/agents/frontend-engineer.md`・`test-runner-analyst.md` | ブランチの確認から `develop` を外す |

ADR-0008 は Accepted のため本文を変えない。「制約」の git-flow と `preview/develop` の記述は、ADR-0020 の「関連」から置き換えを示す。

## GitHub の設定（`gh api`）

### リポジトリ

```bash
gh api -X PATCH repos/Natsugure/furatora \
  -F allow_merge_commit=true -F allow_squash_merge=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true
```

### ruleset「Protect main branch」（id 13600230）

```json
{
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request" }],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": { "allowed_merge_methods": ["merge"], "required_approving_review_count": 0, "...": "既存の値を保つ" } },
    { "type": "required_status_checks", "parameters": { "strict_required_status_checks_policy": false,
      "required_status_checks": [{ "context": "verify" }] } }
  ]
}
```

- `verify` は `ci.yml` のジョブ名
- `strict`（main の最新を取り込んでいることを必須にする）は付けない。1人の開発では、取り込みのためだけの push が増えるため

## 移行の順序

1. PR #182（#143）を main へマージする（`docs/spec/` のコンフリクトを避けるため先に）
2. このブランチに main を取り込み、`docs/spec/` はこちらを採る
3. GitHub の設定を変える（この PR のマージ前。この PR 自体が新しいルールの最初の確認になる）
4. この PR をマージする
5. `develop` を消す。開発者が Neon の `preview/develop` を消し、Vercel の Production Branch を確かめる

## テスト

コードの変更が無いため、自動テストは足さない。設定は requirements.md「受け入れ基準」のコマンドで確かめる。

## ドメイン知識・決定の振り分け

- ADR: ADR-0020（新規）
- `docs/domain/`: 変更なし（システムの振る舞いではなく、開発の運用であるため。運用の要点は `CLAUDE.md` に置く）
