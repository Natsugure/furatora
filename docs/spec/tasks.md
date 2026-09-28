# 実装タスク: station_connections の旧4列と難易度 enum の削除 (Issue #136)

- **参照**: [requirements.md](./requirements.md) / [design.md](./design.md)
- **ブランチ**: `feat/issue136-drop-legacy-difficulty-columns`（`develop` から作成）
- **前提**: #125 が `main` にリリース済み（2026-09-28 に確認）

## フェーズ1〜2: 分析・設計

- [x] **TASK-1** 旧4列・enum 型の参照箇所と、`stationConnections` の SELECT / INSERT / DELETE の形を確認する
- [x] **TASK-2** `docs/spec/` の3点セットを本 Issue 用に全面的に書き換える

## フェーズ3: 実装

- [ ] **TASK-3** `schema.ts` から4列と enum 型の import を、`enums.ts` から2型を削除する（依存: なし）
- [ ] **TASK-4** `pnpm run db:generate` でマイグレーションを生成し、DROP COLUMN ×4 だけであることを確認する（依存: TASK-3）
- [ ] **TASK-5** Admin のテスト・コメント、`packages/database/CLAUDE.md` を更新する（依存: TASK-3）

## フェーズ4: 検証

- [ ] **TASK-6** `pnpm run typecheck` / `lint` / `test` / `build` が通ること。旧4列・enum 型の参照が残っていないこと
- [ ] **TASK-7** 開発者が development に `db:migrate` を適用する。Neon MCP で列が消え行数が変わらないことを確認し、
      Admin の接続の追加・削除と Web の駅詳細を確認する

## フェーズ5〜6: 振り返り・引き渡し

- [ ] **TASK-8** `docs/domain/station-master-model.md` の凍結の記述を削除する。ADR の変更が無いことを確認する
- [ ] **TASK-9** PR（base: `develop`）を作成する。デプロイ中は Admin で接続を追加しない旨を書く
