# タスク: ホーム図の設備アイコンに wheelchairEscalator を足す (Issue #140)

- [x] **TASK-1** ブランチ `fix/issue140-wheelchair-escalator-icon` を切り、docs/spec を書き換える
- [x] **TASK-2** `FACILITY_ICON_FILES` を `Record<FacilityTypeCode, string>` にし、`wheelchairEscalator` を足す。Admin に画像を複製する
  - 画像は `cmp` で Web のものと同一であることを確かめた
- [x] **TASK-3** `platform-diagram` の README と `facility.ts` の手順コメントにアイコンの追加を書く
- [x] **TASK-4** 検証（依存: TASK-2）
  - 対応表から `wheelchairEscalator` の行を一時的に外すと、`platform-diagram` の typecheck が TS2741（`Property 'wheelchairEscalator' is missing`）で失敗することを確かめ、戻した
  - `turbo run typecheck lint test`（15タスク）・`pnpm run build`（2タスク）が成功した
  - dev での目視は省略: 該当データが 0 件で、変更は静的ファイルの追加と型・対応表の1行のみ
- [x] **TASK-5** `docs/domain/` を確認する
  - 変更なし: 設備の種類の一覧（7値）は `station-master-model.md` に既に記載済みで、ドメインルールは変わらない。アイコンの対応は実装の詳細として README に置く
  - ADR: 新規・ステータス変更なし
