# タスク: admin の API GET を整理し、残る1本を Query Service 化する (Issue #48)

- [x] **TASK-1** ブランチ `refactor/issue48-admin-get-query-service` を切り、docs/spec を書き換える
- [x] **TASK-2** `TrainDTO` と `TrainEditPageQuery.getTrain` を足し、`getEditContext` を `getTrain` で組み立てる
- [x] **TASK-3** `GET /api/trains/[trainId]` を `getTrain` に置き換え、`DuplicateButton` を DTO に合わせる。テストを書く（依存: TASK-2）
  - `app/api/trains/[trainId]/route.test.ts`（200 / 404 / 500）、`components/DuplicateButton.test.tsx`（POST の body、取得失敗）
- [x] **TASK-4** 呼び出し元の無い GET 4本を削除し、ESLint の除外を外す
  - 削除前に `apps/admin/src`・`apps/admin/e2e`・`apps/web`・`apps/scripts` を grep し、GET の呼び出し元が無いことを確かめた
- [ ] **TASK-5** 検証（依存: TASK-3, TASK-4）
  - [x] `turbo run typecheck lint test`（15タスク、admin 636 テスト）・`pnpm run build`（2タスク）が成功した
  - [ ] dev で、号車の長さが入った列車（development の「丸ノ内線」。6両すべてに `car_length` あり）を複製する。レイアウト編集画面で保存・削除できることを確かめる
- [ ] **TASK-6** `docs/domain/` を確認し、列車の書き込みの Repository 化を Issue に起票する
  - [x] `docs/domain/` は変更なし: 削除した GET への言及は無く、ドメインルールも変わらない
  - [x] ADR: 新規・ステータス変更なし（ADR-0003 の適用）
  - [ ] フォローアップ Issue の起票
