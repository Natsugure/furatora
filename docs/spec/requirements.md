# 要件: station_connections の旧4列と難易度 enum の削除 (Issue #136)

## 概要

- **対象**: `station_connections` から乗換難易度の旧4列
  （`stroller_difficulty` / `wheelchair_difficulty` / `notes_about_stroller` / `notes_about_wheelchair`）を削除し、
  `StrollerDifficulty` / `WheelchairDifficulty` 型を削除する
- **参照**: [design.md](./design.md) / [tasks.md](./tasks.md) /
  [Issue #136](https://github.com/Natsugure/furatora/issues/136) /
  `docs/domain/station-master-model.md`「乗換接続（`stationConnections`）— 接続一覧」/
  CLAUDE.md「禁止事項」（破壊的マイグレーションの二段階ルール）
- **ブランチ**: `feat/issue136-drop-legacy-difficulty-columns`
- **信頼度**: 95%（高）。読み書きするコードが無いことを確認済みで、変更は削除のみ

## 背景

乗換難易度は新モデル（`transfer_connections` → `connection_routes` → `transfer_routes` → `transfer_route_facilities`）に移行した。
旧4列は #124 で Admin から書かれなくなり、#125 で Web から読まれなくなった。
二段階ルールの1段目（読み書きしないコードのデプロイ）は #125 の本番リリースで完了している
（2026-09-28 時点で `origin/main..origin/develop` が0件）。本 Issue は2段目（列の削除）である。

## 要件（EARS記法）

- **REQ-1**: システムは、`station_connections` に旧4列を持たないこと
- **REQ-2**: システムは、`@furatora/database/enums` に `StrollerDifficulty` / `WheelchairDifficulty` を持たないこと
- **REQ-3**: マイグレーションが適用されたとき、システムは `station_connections` の既存行を削除・変更しないこと（列の削除のみ）
- **REQ-4**: 管理者が接続を追加・削除したとき、システムは変更前と同じ結果（有向2行の作成・削除）を返すこと
- **REQ-5**: 利用者が駅詳細を開いたとき、システムは変更前と同じ乗換先を表示すること
- **REQ-6**: `pnpm run build` は DB に触れないこと

## 対象外

- `line_directions` の代表駅・終点駅の列（#129）
- ADR-0001 本文中の enum の例示（ADR は不変のため変更しない）

## エッジケース

| ケース | 扱い |
|---|---|
| マイグレーション適用後、旧コードがまだ稼働している間に Admin で接続を追加する | Drizzle の `insert` は全列を列挙するため失敗する。Admin 専用・数分の窓なので、デプロイ中は接続を追加しない運用で扱う（design.md 決定1） |
| 旧4列の値を後で参照したい | #123 の移行 SQL（`packages/database/drizzle/0012_migrate_transfer_difficulty.sql`）と git 履歴に残る |
