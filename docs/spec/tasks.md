# タスク: 乗換の評価カードのタグと補足の文言を見直す (Issue #189)

どのサイクルも TDD（テストを書く → 失敗を確かめる → 実装 → 通る）。

ブランチ: `feat/issue189-transfer-labels`（`main` から）

- [x] **TASK-1** `docs/spec/` の3点を #189 用に書き換える
- [x] **TASK-2** Web のテストを新しい仕様に書き換え、8 件が落ちることを確かめた
- [x] **TASK-3** `REQUIREMENT_LABEL`・`ROUTE_FLAG_LABEL`・`RouteChips`・迂回度・最も負担の少ない方法を実装し、Web 26 件が通った
- [x] **TASK-4** Admin のテストの期待と `RouteCard` の入力ラベル、パッケージのテスト名・コメントを揃えた
- [ ] **TASK-5** 検証: 3 パッケージの test・型チェック・lint・build、dev サーバーで目視
  - test（transfer-difficulty 71・admin の transfer-connection 125・web 195）・lint・`pnpm run build` が通った
  - 目視は未実施（DevTools の Chrome が起動しておらず、dev サーバーへの curl は許可されなかった）
- [x] **TASK-6** 振り返り: `docs/domain/station-master-model.md` に `requiresStaff` の定義・タグの規則を書き、迂回度の規則を上書きした。ADR の追加・変更は無い
- [x] **TASK-7** データ: 本番の `requiresStaff` が `call_staff` と重複している2本（`stairLift`・`wheelchairEscalator` を含むルート）のフラグを Admin で外す（開発者）
