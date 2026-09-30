# タスク: packages/database の schema.ts のドメイン別分割 (Issue #149)

- [x] **TASK-1** Issue #149 を作成し、`develop` からブランチ `refactor/issue149-split-database-schema` を切る
- [x] **TASK-2** 分割前に `drizzle-kit generate` を実行し、差分が無いことを確認する（依存: TASK-1）
  - 結果: `No schema changes, nothing to migrate`
- [x] **TASK-3** `src/schema/` の5ファイルを作り、`schema.ts` を削除する。`package.json` の exports と `drizzle.config.ts` を直す（依存: TASK-2）
  - 元ファイルの行範囲を `sed` で切り出して作った（手で書き写さない）
  - `transfer.ts` 冒頭の「難易度4列は #125 のあとの別デプロイで落とす」を、#136 で完了済みの現在形に直した
- [x] **TASK-4** 検証（依存: TASK-3）
  - `drizzle-kit generate`: `No schema changes, nothing to migrate`。`drizzle/` に差分なし
  - 行の並べ替え `diff`: 違いは各ファイルの見出しコメント4つと、TASK-3 のコメント修正だけ
  - `pnpm run typecheck`（6タスク）・`pnpm run lint`（4タスク）成功
  - `pnpm run test`: admin 627・platform-diagram 203・transfer-difficulty 55・frontend 42 すべて成功
  - `pnpm run build` 成功（DB に触れない）
- [x] **TASK-5** ドキュメントのパスを直す（依存: TASK-3）
  - `CLAUDE.md`（二段階マイグレーションの補足）・`apps/CLAUDE.md`・`packages/database/CLAUDE.md`・`.github/instructions/drizzle.instruction.md`・`.claude/agent-memory/frontend-engineer/MEMORY.md`
  - `docs/domain/station-visibility.md`・`docs/domain/station-master-model.md`: パスの言及のみ。ドメインルールの変更は無いことを確認した
  - ADR（0004・0005・0008）の `schema.ts` への言及は書き換えない（追記のみの運用）
- [x] **TASK-6** `docs/adr/`: 変更なし（design.md 決定3）
- [ ] **TASK-7** PR を `develop` 向けに作る。マイグレーションが増えないため、Vercel のビルドで流れるものは無い
