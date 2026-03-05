# Frontend Engineer Agent Memory

## プロジェクト構造
- `apps/admin` - 管理者用アプリ (Next.js App Router, `src/` 配下)
- `apps/web` - フロントエンドアプリ
- `packages/database/src/schema.ts` - 全テーブル定義の集約ファイル
- DBクライアントは `@furatora/database/client` からインポート

## 重要パターン: stationConnections テーブルの null 問題

`stationConnections` テーブルでは `connectedStationId` と `connectedRailwayId` が
それぞれ独立して `null` になり得る（ODPT データが未解決の場合）。

- **Toei（都営）のデータは `connectedRailwayId` が `null` になるケースがある**
  - `update-odpt.ts` の処理順序や ODPT データの構造上の問題が原因
- `INNER JOIN` を使うと `null` のレコードが除外される → `LEFT JOIN` を使うこと
- 路線名の解決は `connectedRailwayId`（DB UUID）で試み、
  失敗した場合は `odptRailwayId` でテーブルを引いて補完するパターンが有効

詳細: `docs/spec/` を参照 (Issue #33 修正)

## TypeScript テストエラーについて
`apps/admin/src/app/api/operators/[operatorId]/route.test.ts` などのテストファイルに
Drizzle ORM のモック型エラーが既存で存在する。今回の変更とは無関係。
