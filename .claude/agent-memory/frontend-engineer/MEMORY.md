# Frontend Engineer Agent Memory

## プロジェクト構造
- `apps/admin` - 管理者用アプリ (Next.js App Router, `src/` 配下)
- `apps/web` - フロントエンドアプリ
- `packages/database/src/schema.ts` - 全テーブル定義の集約ファイル
- DBクライアントは `@furatora/database/client` からインポート

## 重要パターン: stationConnections の路線解決（旧パターンは使わない）

`stationConnections.connectedRailwayId` と `odptRailwayId` は Issue #56 で
削除された（ODPT 同期専用の列で、以後 ODPT 同期は行わないため。ADR-0007 決定3）。
**「`connectedRailwayId` で試み、失敗したら `odptRailwayId` でフォールバック」という
旧パターンはもう存在しない。再導入しないこと。**

路線名の解決は `connectedStationId → stationLines → lines` の join で行う
（ekidata は路線ごとに駅を割るため、駅が決まればほぼ1路線に定まる。実測で
複数路線を持つ駅はごく少数。その場合は `(connectedStationId, lineName)` で
重複除去する）。参考実装: `apps/web/src/external/query/stationDetailQuery.ts`
の `getStationConnectionRows`。

`connectedStationId` は notNull 化済み。null 行は存在しない。

詳細: `docs/domain/station-master-model.md`「乗換接続（stationConnections）」/ ADR-0007 決定3

## TypeScript テストエラーについて
`apps/admin/src/app/api/operators/[operatorId]/route.test.ts` などのテストファイルに
Drizzle ORM のモック型エラーが既存で存在する。今回の変更とは無関係。
