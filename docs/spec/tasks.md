# タスク: 方面ラベルの解決・接続の向きの揃え方を transfer-difficulty に集める (Issue #138)

- [x] **TASK-1** ブランチ `refactor/issue138-shared-transfer-rules` を切り、docs/spec を書き換える
- [x] **TASK-2** `transfer-difficulty` に `firstLineByStation` / `resolveStationDirectionLabels` とテストを追加する
  - 駅が路線を持たないときは、ホーム・既定行を見ずにフォールバックするよう明示的に分岐した（従来は `lineId === undefined` との比較で偶然一致しなかっただけ）
- [x] **TASK-3** `transfer-difficulty` に `orientConnection`（`connection.ts`）とテストを追加し、バレルに足す
- [x] **TASK-4** Admin の `comboOfConnection` と `transferPairEditPageQuery` を共有関数に置き換える（依存: TASK-2, 3）
- [x] **TASK-5** Web の組み立てを `features/station/domain/transferPartners.ts` に切り出し、`transferPartnerRows.ts`・`stationDetailQuery.ts` を置き換える（依存: TASK-2, 3）
  - `facilitiesByRoute` も移し、`transferPartnerRows.test.ts` の3ケースを `transferPartners.test.ts` へ移した（`DATABASE_URL` のダミー設定と動的 import は不要になった）
- [x] **TASK-6** 検証: `typecheck` / `lint` / `test` / `build`、`git grep` で apps に写しが残っていないこと、dev で表示が変わらないこと（依存: TASK-4, 5）
  - `typecheck` / `lint` / `test`（15タスク）・`build`（2タスク）が成功した
  - `test`: transfer-difficulty 63（+8）・admin 631（テストの追加・削除なし）・frontend 47（+5。`facilitiesByRoute` の3件を移し、組み立ての5件を追加）・platform-diagram 203
  - `git grep -n "localeCompare(b.platformNumber\|stationAId.toLowerCase() ===" -- apps/`: 該当なし
  - dev での表示確認: 同じ dev サーバーで develop と本ブランチを切り替え、同じ画面のデータを比べた。すべて一致した
    - Web 駅詳細（淡路町）: ページに埋め込まれた乗換先の DTO（`partners`。RSC の参照番号は正規化）の SHA-256 が一致（`3b676638…`、5,453 文字）。
      乗換先5件、方面ラベル（丸ノ内線「東京・新宿・荻窪・方南町方面」「池袋方面」、JR は「上り」「下り」）、組み合わせ、ルートの順
    - Admin 駅対編集画面（淡路町 → 新御茶ノ水 と 新御茶ノ水 → 淡路町）: 画面のテキストと入力の状態の SHA-256 がどちらも一致
      （`bf0bdaa2…`・`7b9cbc93…`、チェック 13/33）。淡路町は接続行の B 側なので、逆向きで A 側も確かめた
- [x] **TASK-7** `docs/domain/` の実装の所在を更新する（依存: TASK-6）
  - `line-directions.md`: 方面ラベルの実装の所在を `resolveDirectionLabel` / `firstLineByStation` / `resolveStationDirectionLabels` と Web の `transferPartners.ts` に上書きした
  - `station-master-model.md`: 向きの揃え方の記述は無い。ただし未知の設備コードの Web 側の所在が旧パス（`transferPartnerRows.ts`）を指していたので、`transferPartners.ts` の `facilitiesByRoute` に直した
  - ADR: 新規・ステータス変更なし
- [x] **TASK-8** PR #157 のレビュー指摘に対応する（依存: TASK-7）
  - 方面ラベル・最初の路線の解決で、駅 ID の大文字小文字を区別していた。組み合わせ（`orientConnection`）と食い違い、
    大文字の uuid では組み合わせだけ合って方面ラベルが「上り／下り」に、路線名が空に落ちていた。
    `firstLineByStation` を大文字小文字に依らず引ける形（`StationFirstLineLookup`）にし、`resolveStationDirectionLabels` のホームの絞り込みも小文字で比べる
  - `orientConnection` は自駅に接しない行を例外にする（呼び出し側はすべて自駅に接する行だけを読むので、挙動は変わらない）
  - Web の `assembleTransferPartners` は、相手駅の方面ラベルを駅ごとに一度だけ解決する
  - 修正前のコードで追加したテスト5件が落ち、修正後に通ることを確かめた
  - `typecheck` / `lint` / `test`（13タスク）が成功した。`test`: transfer-difficulty 66（+3）・admin 631・frontend 49（+2）
  - 対象外として起票: 最初の路線の並び順を呼び出し側の SQL に頼っていること（#158）、方面ラベルの入力の SQL が Web と Admin で重複していること（#159）
