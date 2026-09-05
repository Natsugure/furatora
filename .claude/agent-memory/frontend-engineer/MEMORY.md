# Frontend Engineer Agent Memory

## プロジェクト構造
- `apps/admin` - 管理者用アプリ (Next.js App Router, `src/` 配下)
- `apps/web` - フロントエンドアプリ
- `packages/database/src/schema.ts` - 全テーブル定義の集約ファイル
- DBクライアントは `@furatora/database/client` からインポート

## 重要パターン: stationConnections の路線解決（Phase 4 で変更、旧パターンは使わない）

`stationConnections.connectedRailwayId` と `odptRailwayId` は Issue #56 Phase 4 で
削除された（ODPT 同期専用の列で、ekidata 由来のインポートは書かないため）。
**「`connectedRailwayId` で試み、失敗したら `odptRailwayId` でフォールバック」という
旧パターンはもう存在しない。再導入しないこと。**

路線名の解決は `connectedStationId → stationLines → lines` の join で行う
（ekidata は路線ごとに駅を割るため、駅が決まればほぼ1路線に定まる。実測で
複数路線を持つ駅はごく少数。その場合は `(connectedStationId, lineName)` で
重複除去する）。参考実装: `apps/web/src/external/query/stationDetailQuery.ts`
の `getStationConnectionRows`。

`connectedStationId` は Phase 4 で notNull 化される予定（PR2）。それまでは
nullable だが、null 行は「未突合」ではなく単に存在しない。

詳細: `docs/spec/tasks.md` Phase 4 を参照

## TypeScript テストエラーについて
`apps/admin/src/app/api/operators/[operatorId]/route.test.ts` などのテストファイルに
Drizzle ORM のモック型エラーが既存で存在する。今回の変更とは無関係。
