# タスク: 使われていない DB の列をコードから外す（二段階の削除の1段目）

どのサイクルも TDD（テストを書く → 失敗を確かめる → 実装 → 通る）。

ブランチ: `refactor/remove-unused-columns`（`main` から）

- [x] **TASK-1** 全テーブルの列の読み書きを追い、本番のデータ件数と合わせて、消す列を開発者と決める
- [x] **TASK-2** テストを先に書き換え、落ちることを確かめる
  - `ConcourseInspector.test.tsx`・`facility/schema.test.ts`・`editDraft.test.ts` の5件が、消す項目が残っているために落ちた
- [x] **TASK-3** スキーマ・DTO・Web・Admin から項目を外し、テストを通す。ほかのテストのフィクスチャからも外す
- [x] **TASK-4** 検証: 全パッケージの typecheck・lint・test
  - typecheck 6 タスク、test・lint 9 タスクが通った（admin 56 ファイル、web 30、platform-diagram 11、transfer-difficulty 5）
- [x] **TASK-5** 画面での確認: admin の駅レイアウト編集で設備の追加・削除・保存ができ、入力欄が消えていること。Web の駅ページのホーム図が描かれること
  - development DB の赤坂見附 2番線、コンコース「日枝神社・溜池方面」で確かめた
  - 設備を選んでも「車いす対応」「ベビーカー対応」「設備メモ」は出ない。場所メモは残っている
  - 110m のアクセス点にエスカレーターを足して保存した。PUT は 200 で、送った設備は `{"typeCode": ...}` だけだった。DB に行が入り、図にも出た
  - エスカレーターを外して保存し、元の内容（110m に階段、125m にエレベーター）に戻した。この保存で入れ直した行の古い列には DB の既定値（true）が入るが、#217 で列ごと消える
  - Web の駅ページ（/stations/tokyometro-marunouchi-akasakamitsuke）でホーム図が描かれた。admin・Web ともコンソールのエラー・警告は無い
- [x] **TASK-6** `docs/domain/station-master-model.md` を更新し、適用状況に「DB の列は #217 で落とす」と書く
- [x] **TASK-7** 別の作業を Issue にする: #217（DROP COLUMN）、#218（場所メモの Web 表示）、#219（駅の新規作成でメモが保存されない）
