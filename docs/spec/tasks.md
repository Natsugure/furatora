# タスク: 方面ラベルの解決・接続の向きの揃え方を transfer-difficulty に集める (Issue #138)

- [x] **TASK-1** ブランチ `refactor/issue138-shared-transfer-rules` を切り、docs/spec を書き換える
- [x] **TASK-2** `transfer-difficulty` に `firstLineByStation` / `resolveStationDirectionLabels` とテストを追加する
  - 駅が路線を持たないときは、ホーム・既定行を見ずにフォールバックするよう明示的に分岐した（従来は `lineId === undefined` との比較で偶然一致しなかっただけ）
- [x] **TASK-3** `transfer-difficulty` に `orientConnection`（`connection.ts`）とテストを追加し、バレルに足す
- [x] **TASK-4** Admin の `comboOfConnection` と `transferPairEditPageQuery` を共有関数に置き換える（依存: TASK-2, 3）
- [x] **TASK-5** Web の組み立てを `features/station/domain/transferPartners.ts` に切り出し、`transferPartnerRows.ts`・`stationDetailQuery.ts` を置き換える（依存: TASK-2, 3）
  - `facilitiesByRoute` も移し、`transferPartnerRows.test.ts` の3ケースを `transferPartners.test.ts` へ移した（`DATABASE_URL` のダミー設定と動的 import は不要になった）
- [ ] **TASK-6** 検証: `typecheck` / `lint` / `test` / `build`、`git grep` で apps に写しが残っていないこと、dev で表示が変わらないこと（依存: TASK-4, 5）
  - `typecheck` / `lint` / `test`（15タスク）・`build`（2タスク）が成功した
  - `test`: transfer-difficulty 63（+8）・admin 631（テストの追加・削除なし）・frontend 47（+5。`facilitiesByRoute` の3件を移し、組み立ての5件を追加）・platform-diagram 203
  - `git grep -n "localeCompare(b.platformNumber\|stationAId.toLowerCase() ===" -- apps/`: 該当なし
  - dev での表示確認: 未（開発者が確認する）
- [x] **TASK-7** `docs/domain/` の実装の所在を更新する（依存: TASK-6）
  - `line-directions.md`: 方面ラベルの実装の所在を `resolveDirectionLabel` / `firstLineByStation` / `resolveStationDirectionLabels` と Web の `transferPartners.ts` に上書きした
  - `station-master-model.md`: 向きの揃え方の記述は無い。ただし未知の設備コードの Web 側の所在が旧パス（`transferPartnerRows.ts`）を指していたので、`transferPartners.ts` の `facilitiesByRoute` に直した
  - ADR: 新規・ステータス変更なし
