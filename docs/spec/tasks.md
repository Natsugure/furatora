# タスク: admin の API GET を整理し、残る1本を Query Service 化する (Issue #48)

- [x] **TASK-1** ブランチ `refactor/issue48-admin-get-query-service` を切り、docs/spec を書き換える
- [ ] **TASK-2** `TrainDTO` と `TrainEditPageQuery.getTrain` を足し、`getEditContext` を `getTrain` で組み立てる
- [ ] **TASK-3** `GET /api/trains/[trainId]` を `getTrain` に置き換え、`DuplicateButton` を DTO に合わせる。テストを書く（依存: TASK-2）
- [ ] **TASK-4** 呼び出し元の無い GET 4本を削除し、ESLint の除外を外す
- [ ] **TASK-5** 検証（依存: TASK-3, TASK-4）
  - `turbo run typecheck lint test`・`pnpm run build`
  - dev で、号車の長さが入った列車を複製する。レイアウト編集画面で保存・削除できることを確かめる
- [ ] **TASK-6** `docs/domain/` を確認し、列車の書き込みの Repository 化を Issue に起票する
