# タスク: 停車位置パターンの基準点を NOT NULL にし、train_stop_pattern_cars を DROP する (Issue #224)

ブランチ: `refactor/stop-pattern-not-null-224`（`main` から）

- [x] **TASK-1** 着手前の確認: 本番・development の履歴件数（24 で一致）と NULL の行（0 件）
- [x] **TASK-2** `resolvePatternCars` の null 分岐を外す（テスト先行）
- [x] **TASK-3** `stopPatternCarsOf` / `groupEquipmentsByTrainCar` を `platform-diagram` に足し（テスト先行）、Web・Admin の query を置き換える
- [x] **TASK-4** マイグレーション 0024（`--custom`、埋め戻しの流し直し）・0025（`db:generate`、DROP と NOT NULL）。0025 に想定外の文が無いことを確認
- [x] **TASK-5** development に `pnpm run db:migrate`（開発者が実行）→ MCP で旧表が無いこと・2列が NOT NULL・履歴 26 件を確認
- [x] **TASK-6** dev を再起動し、Web の駅詳細・Admin の駅レイアウトで停車位置が変わらず表示されることを確認
- [x] **TASK-7** ドキュメント: `docs/domain/train-stop-patterns.md` の適用状況を外す、`packages/database/CLAUDE.md` の誤検出一覧を更新
- [ ] **TASK-8** PR。マージ直前に本番で NULL 0 件を再確認する
