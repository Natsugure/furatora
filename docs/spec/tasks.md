# タスク: 使われていない DB の列をコードから外す（二段階の削除の1段目）

どのサイクルも TDD（テストを書く → 失敗を確かめる → 実装 → 通る）。

ブランチ: `refactor/remove-unused-columns`（`main` から）

- [x] **TASK-1** 全テーブルの列の読み書きを追い、本番のデータ件数と合わせて、消す列を開発者と決める
- [x] **TASK-2** テストを先に書き換え、落ちることを確かめる
  - `ConcourseInspector.test.tsx`・`facility/schema.test.ts`・`editDraft.test.ts` の5件が、消す項目が残っているために落ちた
- [x] **TASK-3** スキーマ・DTO・Web・Admin から項目を外し、テストを通す。ほかのテストのフィクスチャからも外す
- [x] **TASK-4** 検証: 全パッケージの typecheck・lint・test
  - typecheck 6 タスク、test・lint 9 タスクが通った（admin 56 ファイル、web 30、platform-diagram 11、transfer-difficulty 5）
- [ ] **TASK-5** 画面での確認: admin の駅レイアウト編集で設備の追加・削除・保存ができ、入力欄が消えていること。Web の駅ページのホーム図が描かれること
- [x] **TASK-6** `docs/domain/station-master-model.md` を更新し、適用状況に「DB の列は #217 で落とす」と書く
- [x] **TASK-7** 別の作業を Issue にする: #217（DROP COLUMN）、#218（場所メモの Web 表示）、#219（駅の新規作成でメモが保存されない）
