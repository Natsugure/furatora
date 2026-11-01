# タスク: 使われなくなった設備の対応フラグ・メモと廃止日の列を DROP する (Issue #217)

ブランチ: `chore/drop-unused-columns-217`（`main` から）

- [x] **TASK-1** `pnpm run db:generate` で DROP のマイグレーションを作り、5列の DROP だけが出ることを確かめる
  - `0021_drop_unused_columns.sql` に5つの `DROP COLUMN` だけが出た
- [x] **TASK-2** `docs/domain/station-master-model.md` の適用状況から、DB に列が残っている旨の注記を外す
- [x] **TASK-3** 開発者が development で `pnpm run db:push` を流し、5列が消えたことを Neon MCP で確かめる
  - push の前に、development に残っている差分が5列だけであることを確かめた（`platforms.platform_side` などは消えている）
  - push のあと、`information_schema.columns` で5列が無く、ほかの列が残っていることを確かめた
- [x] **TASK-4** 画面での確認: Admin の駅レイアウト編集で設備を保存できる。Web の駅ページのホーム図が描かれる
  - 赤坂見附 2番線、コンコース「日枝神社・溜池方面」で、110m にエスカレーターを足して保存（PUT 200、DB に入った）→ 外して保存し、元に戻した
  - Web の駅ページのホーム図が描かれた。admin・Web ともコンソールのエラー・警告は無い
  - 全列を返す公開 API（`/api/v1/stations/[id]`・`/api/v1/operators`）も 200 を返した。駅の JSON に `abolishedAt` は無い
- [x] **TASK-5** PR の前に、PR #220 が Web・Admin の両方で本番にデプロイされたことを確かめる
  - マージコミット `680cee5` の Vercel のステータスが、`furatora`・`furatora-admin` とも success だった
