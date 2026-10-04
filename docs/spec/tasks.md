# タスク: 方面ラベルの解決・接続の向きの揃え方を transfer-difficulty に集める (Issue #138)

- [x] **TASK-1** ブランチ `refactor/issue138-shared-transfer-rules` を切り、docs/spec を書き換える
- [ ] **TASK-2** `transfer-difficulty` に `firstLineByStation` / `resolveStationDirectionLabels` とテストを追加する
- [ ] **TASK-3** `transfer-difficulty` に `orientConnection`（`connection.ts`）とテストを追加し、バレルに足す
- [ ] **TASK-4** Admin の `comboOfConnection` と `transferPairEditPageQuery` を共有関数に置き換える（依存: TASK-2, 3）
- [ ] **TASK-5** Web の組み立てを `features/station/domain/transferPartners.ts` に切り出し、`transferPartnerRows.ts`・`stationDetailQuery.ts` を置き換える（依存: TASK-2, 3）
- [ ] **TASK-6** 検証: `typecheck` / `lint` / `test` / `build`、`git grep` で apps に写しが残っていないこと、dev で表示が変わらないこと（依存: TASK-4, 5）
- [ ] **TASK-7** `docs/domain/line-directions.md` の実装の所在を更新する。`station-master-model.md` は変更なしを確認する（依存: TASK-6）
