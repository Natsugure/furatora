# タスク: 長命ブランチを main のみにし、develop を廃止する (Issue #183)

ブランチ: `chore/issue183-main-only-branching`（`main` から）

- [x] **TASK-1** Issue #183 を起票し、ブランチを切る
- [x] **TASK-2** ADR-0020 を `Proposed` で書き、`docs/adr/README.md` の一覧に足す
- [x] **TASK-3** `ci.yml`・`CLAUDE.md`・`.claude/agents/*.md` から `develop` を外し、`CLAUDE.md` にブランチ運用の節を足す
- [x] **TASK-4** `docs/spec/` の3点を書き換える
- [x] **TASK-5** PR #182 のマージ後、main を取り込む（`docs/spec/` はこちらを採る）
- [ ] **TASK-6** GitHub の設定を変える（マージ方法、ブランチの自動削除、ruleset）。`rules/branches/main` で効いているルールを確かめる
  - 開発者が変更。確認結果: マージコミットのみ・自動削除・対象 `~DEFAULT_BRANCH`・削除と強制 push の禁止・PR 必須（merge のみ）・`verify` 必須が main に効いている
  - 残り: 管理者の除外が `bypass_mode: always` のまま（ADR-0020 決定4 は `pull_request`）
- [ ] **TASK-7** この PR を main へマージする（新しいルールの下での最初のマージで確かめる）
- [ ] **TASK-8** `develop` を消す。開発者: Neon の `preview/develop` を消す、Vercel の Production Branch が `main` であることを確かめる
- [ ] **TASK-9** 振り返り: 受け入れ基準を確かめ、ADR-0020 を `Accepted` にする（開発者の承認を得てから）。`docs/domain/` は変更なし
