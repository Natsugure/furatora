# 実装タスク: 駅ホーム設備の定義方法改善 (Issue #29)

## 概要

- **対象**: `packages/database`, `apps/admin`, `apps/web`
- **参照**: [`requirements.md`](./requirements.md) / [`design.md`](./design.md)
- **作成日**: 2026-03-06
- **ブランチ**: `feature/issue-29-platform-facility-improvement`

---

## フェーズ構成

```
Phase 0: docs/spec更新                    (完了)
Phase 1: スキーマ変更                     (基盤)
Phase 2: データ移行スクリプト              (必須)
Phase 3: Admin API更新                    (P0)
Phase 4: Admin UI更新                     (P0)
Phase 5: Web UI更新                       (P1)
Phase 6: 検証・振り返り                   (必須)
```

---

## Phase 0: docs/spec更新（完了）

### TASK-0.1: requirements.md 更新
- **状態**: ✅ 完了 (2026-03-06)
- **内容**: Issue #29向けに全面書き換え

### TASK-0.2: design.md 更新
- **状態**: ✅ 完了 (2026-03-06)
- **内容**: 新スキーマ設計・データフロー・インターフェース定義を記述

### TASK-0.3: tasks.md 更新
- **状態**: ✅ 完了 (2026-03-06)
- **内容**: 全実装タスクを定義

---

## Phase 1: スキーマ変更

### TASK-1.1: `platformLocations` テーブルから `nearPlatformCell` カラムを削除
- **説明**: `packages/database/src/schema.ts` の `platformLocations` テーブル定義から `nearPlatformCell` カラムを削除する
- **対象ファイル**: `packages/database/src/schema.ts`
- **期待結果**: `platformLocations` テーブルが `nearPlatformCell` を持たなくなる
- **依存**: なし

### TASK-1.2: `platformLocationCells` テーブルを新規追加
- **説明**: コンコースへのアクセス点を表す新テーブルを追加する
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  ```typescript
  export const platformLocationCells = pgTable('platform_location_cells', {
    id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
    platformLocationId: uuid('platform_location_id')
      .references(() => platformLocations.id, { onDelete: 'cascade' })
      .notNull(),
    nearPlatformCell: integer('near_platform_cell'),
  });
  ```
- **期待結果**: `platform_location_cells` テーブルが定義される
- **依存**: TASK-1.1

### TASK-1.3: `stationFacilities` のFKを `platformLocationCells` へ変更
- **説明**: `stationFacilities` テーブルの `platformLocationId` FK を `platformLocationCellId` FK に変更する
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `platformLocationId` カラムを削除
  - `platformLocationCellId: uuid('platform_location_cell_id').references(() => platformLocationCells.id, { onDelete: 'cascade' }).notNull()` を追加
- **期待結果**: `station_facilities.platform_location_cell_id` が `platform_location_cells.id` を参照する
- **依存**: TASK-1.2

### TASK-1.4: `facilityConnections` に `connectedPlatformId`・`directionId` を追加
- **説明**: 乗り換え先の特定ホームおよび方面を指定できるようカラムを追加する
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `connectedPlatformId: uuid('connected_platform_id').references(() => platforms.id)` を追加（nullable）
  - `directionId: uuid('direction_id').references(() => lineDirections.id)` を追加（nullable）
  - ユニーク制約: `(platformLocationId, connectedStationId)` を見直し、`connectedPlatformId`, `directionId` を含む制約に変更を検討
- **期待結果**: 方面・ホーム指定が可能になる
- **依存**: TASK-1.1

### TASK-1.5: マイグレーションファイル生成
- **説明**: DrizzleのCLIでマイグレーションファイルを生成する
- **コマンド**: `pnpm run db:generate`
- **期待結果**: `packages/database/drizzle/` 配下に新しいマイグレーションファイルが生成される
- **依存**: TASK-1.1, TASK-1.2, TASK-1.3, TASK-1.4
- **注意**: `pnpm run db:push` で対話型ウィザードが表示された場合、開発者に確認を取る

---

## Phase 2: データ移行スクリプト

### TASK-2.1: 移行スクリプト作成
- **説明**: 既存 `platformLocations` データを新スキーマへ自動変換するスクリプトを作成する
- **対象ファイル**: `apps/scripts/src/migrate-platform-locations.ts`（新規作成）
- **実装内容**:
  1. 全 `platformLocations` レコードを取得
  2. 各レコードに対して `platformLocationCells` レコードを1件作成（`nearPlatformCell` を移行）
  3. 該当する全 `stationFacilities` の `platformLocationCellId` を更新
- **期待結果**: 既存データが新スキーマで正しく表現される
- **依存**: TASK-1.5 (マイグレーション適用後に実行)

### TASK-2.2: `package.json` にスクリプト実行コマンド追加
- **説明**: `apps/scripts/package.json` に移行スクリプト実行コマンドを追加する
- **対象ファイル**: `apps/scripts/package.json`
- **実装内容**: `"migrate-platform-locations": "ts-node src/migrate-platform-locations.ts"` を追加
- **依存**: TASK-2.1

---

## Phase 3: Admin API更新

### TASK-3.1: バリデーションスキーマ更新
- **説明**: `platformLocationSchema` を新構造（cells配列）に合わせて更新する
- **対象ファイル**: `apps/admin/src/lib/validations.ts`
- **実装内容**:
  - `cellSchema` を追加: `nearPlatformCell` + `facilities[]`
  - `platformLocationSchema` を変更: `nearPlatformCell`・`facilities` を削除し、`cells: z.array(cellSchema).min(1)` を追加
  - `connectionSchema` を拡張: `connectedPlatformId`・`directionId` を追加（任意）
- **依存**: なし（スキーマ変更前でも先行して定義可能）

### TASK-3.2: GET API更新（一覧取得）
- **説明**: `GET /api/stations/:stationId/platform-locations` が `cells` と `connections` を含む新構造を返すよう更新する
- **対象ファイル**: `apps/admin/src/app/api/stations/[stationId]/platform-locations/route.ts`
- **実装内容**:
  - `platformLocationCells` と `stationFacilities` を JOIN して取得
  - `facilityConnections` の `connectedPlatformId`・`directionId` を取得
  - レスポンスをネスト構造に組み立て
- **依存**: TASK-1.5

### TASK-3.3: POST API更新（新規作成）
- **説明**: `POST /api/stations/:stationId/platform-locations` が新構造で受け取れるよう更新する
- **対象ファイル**: `apps/admin/src/app/api/stations/[stationId]/platform-locations/route.ts`
- **実装内容**:
  1. `platformLocations` に挿入（`nearPlatformCell` なし）
  2. `cells[]` を反復: `platformLocationCells` 挿入 → 各 `stationFacilities` 挿入
  3. `connections[]` を `facilityConnections` に挿入（`connectedPlatformId`・`directionId` 含む）
- **依存**: TASK-3.1, TASK-1.5

### TASK-3.4: PUT API更新（更新）
- **説明**: `PUT /api/stations/:stationId/platform-locations/:locationId` を更新する
- **対象ファイル**: `apps/admin/src/app/api/stations/[stationId]/platform-locations/[locationId]/route.ts`
- **実装内容**:
  - `platformLocations` レコード更新
  - 既存 `platformLocationCells`（CASCADE で `stationFacilities` も削除）を削除
  - 新 `cells[]` を挿入（TASK-3.3 と同様の処理）
  - 既存 `facilityConnections` 削除 → 新規挿入（`connectedPlatformId`・`directionId` 含む）
- **依存**: TASK-3.1, TASK-1.5

### TASK-3.5: Duplicate API更新
- **説明**: コンコース複製APIが `platformLocationCells` と `stationFacilities` も複製するよう更新する
- **対象ファイル**: `apps/admin/src/app/api/stations/[stationId]/platform-locations/[locationId]/duplicate/route.ts`
- **実装内容**:
  - 元の `platformLocationCells` を全件取得
  - 各 cell に紐づく `stationFacilities` を取得
  - 新しい `platformLocations` レコード作成後、`platformLocationCells` + `stationFacilities` を複製
- **依存**: TASK-1.5

---

## Phase 4: Admin UI更新

### TASK-4.1: FacilityForm.tsx 大幅改修
- **説明**: 「1枠番号+複数設備」から「複数アクセス点（各々が枠番号+設備）のリスト」に変更する
- **対象ファイル**: `apps/admin/src/components/FacilityForm.tsx`
- **実装内容**:
  - `LocationData` 型変更: `nearPlatformCell`・`facilities` を `cells: CellData[]` に統合
  - `CellData` 型追加: `{ nearPlatformCell: number | null; facilities: FacilitySelection[] }`
  - アクセス点の動的追加/削除UI実装
  - 接続フォームに `connectedPlatformId`（ホーム選択）と `directionId`（方面選択）ドロップダウンを追加
  - 初期化時のデータ取得: 方面リスト取得APIの呼び出しを追加
- **依存**: TASK-3.2, TASK-3.3

### TASK-4.2: 設備一覧ページ更新
- **説明**: コンコース単位で複数アクセス点を表示するよう更新する
- **対象ファイル**: `apps/admin/src/app/stations/[stationId]/facilities/page.tsx`
- **実装内容**:
  - データ取得を新構造（`platformLocationCells` を含む）に合わせて更新
  - 表示: コンコースCardに複数アクセス点を列挙
  - `facilityConnections` 表示: 方面名・ホーム番号も表示
- **依存**: TASK-3.2

### TASK-4.3: 設備編集ページ更新
- **説明**: 編集ページのデータ取得を新構造に合わせて更新する
- **対象ファイル**: `apps/admin/src/app/stations/[stationId]/facilities/[locationId]/edit/page.tsx`
- **実装内容**:
  - `platformLocationCells` + `stationFacilities` を取得し `cells[]` として組み立て
  - `facilityConnections` の `connectedPlatformId`・`directionId` を取得
  - `FacilityForm` の `initialData` に `cells[]` を渡す
- **依存**: TASK-3.2, TASK-4.1

---

## Phase 5: Web UI更新

### TASK-5.1: 駅詳細ページのクエリ更新
- **説明**: `platformLocationCells` → `stationFacilities` の階層クエリに変更する
- **対象ファイル**: `apps/web/src/app/stations/[slug]/page.tsx`
- **実装内容**:
  ```typescript
  // 追加クエリ
  const cellList = await db
    .select()
    .from(platformLocationCells)
    .where(inArray(platformLocationCells.platformLocationId, locationIds));

  const facilityList = await db
    .select()
    .from(stationFacilities)
    .where(inArray(stationFacilities.platformLocationCellId, cellIds));
  ```
  - `facilityConnections` クエリに `connectedPlatformId`・`directionId`・方面名JOINを追加
  - データ組み立て: `concourse → cells → facilities` の階層構造に変換
- **依存**: TASK-1.5

### TASK-5.2: PlatformDisplay.tsx 型と表示更新
- **説明**: 型定義とレンダリングをコンコース単位グルーピングに変更する
- **対象ファイル**: `apps/web/src/components/PlatformDisplay.tsx`
- **実装内容**:
  - `PlatformLocation` 型を新構造に変更（`cells[]` を含む）
  - `PlatformLocationCell` 型を追加
  - `FacilityConnection` 型に `directionName: string | null` を追加
  - 表示ロジック: コンコース（接続先）を見出しとしてグルーピング表示
- **依存**: TASK-5.1

---

## Phase 6: 検証・振り返り

### TASK-6.1: ビルド確認
- **説明**: TypeScript型エラーがないことを確認する
- **コマンド**: `pnpm run build`
- **期待結果**: ビルドエラーなし
- **依存**: Phase 1〜5 全体

### TASK-6.2: 移行スクリプト検証
- **説明**: 開発DBで移行スクリプトを実行し、データ整合性を確認する
- **確認項目**:
  - 移行前後で `platformLocations` 件数が一致する
  - 全 `platformLocations` に対して `platformLocationCells` が1件以上存在する
  - 全 `stationFacilities` が有効な `platformLocationCellId` を参照する
  - Drizzle Studio (`pnpm run db:studio`) でテーブル構造を目視確認
- **依存**: TASK-2.1

### TASK-6.3: Admin手動テスト
- **確認項目**:
  - 新規コンコース（複数アクセス点）の登録ができる
  - 既存コンコースの編集でデータが正しく表示・編集できる
  - 対面乗り換え（`connectedPlatformId` 指定）の登録ができる
  - 方面別設備（`directionId` 指定）の登録ができる
  - コンコース複製が正しく動作する
  - コンコース削除でcellsとfacilitiesが連鎖削除される
- **依存**: Phase 3, Phase 4

### TASK-6.4: Web手動テスト
- **確認項目**:
  - 駅詳細ページでコンコース単位グルーピング表示が正しい
  - 方面情報が乗り換え接続に表示される
  - TrainVisualizationコンポーネントへの影響がない
- **依存**: Phase 5

### TASK-6.5: docs/spec最終更新
- **説明**: 実装を通じて明らかになった変更点をspecに反映する
- **対象ファイル**: `docs/spec/requirements.md`, `docs/spec/design.md`, `docs/spec/tasks.md`
- **依存**: TASK-6.1〜TASK-6.4

---

## タスクサマリー

| フェーズ | タスク数 | 優先度 | 推定規模 |
|---------|---------|-------|---------|
| Phase 0: docs/spec更新 | 3 | P0 | S |
| Phase 1: スキーマ変更 | 5 | P0 | M |
| Phase 2: 移行スクリプト | 2 | P0 | M |
| Phase 3: Admin API更新 | 5 | P0 | L |
| Phase 4: Admin UI更新 | 3 | P0 | L |
| Phase 5: Web UI更新 | 2 | P1 | M |
| Phase 6: 検証 | 5 | P0 | M |
| **合計** | **25** | | |

---

## 実装順序の依存関係

```
TASK-1.1〜1.4 (スキーマ) → TASK-1.5 (マイグレーション生成)
                                    │
                    ┌───────────────┤
                    │               │
               TASK-2.1             ├── TASK-3.1 (バリデーション)
               (移行スクリプト)     │       │
                                    │   TASK-3.2 (GET API)
                                    │   TASK-3.3 (POST API)
                                    │   TASK-3.4 (PUT API)
                                    │   TASK-3.5 (Duplicate API)
                                    │       │
                                    │   TASK-4.1 (FacilityForm)
                                    │   TASK-4.2 (一覧ページ)
                                    │   TASK-4.3 (編集ページ)
                                    │
                                    └── TASK-5.1 (webクエリ)
                                                │
                                            TASK-5.2 (PlatformDisplay)
                                                │
                                        TASK-6.1〜6.5 (検証)
```

---

## 進捗追跡

| タスクID | 状態 | 完了日 |
|---------|------|-------|
| TASK-0.1 | ✅ 完了 | 2026-03-06 |
| TASK-0.2 | ✅ 完了 | 2026-03-06 |
| TASK-0.3 | ✅ 完了 | 2026-03-06 |
| TASK-1.1 | ✅ 完了 | 2026-03-06 |
| TASK-1.2 | ✅ 完了 | 2026-03-06 |
| TASK-1.3 | ✅ 完了 | 2026-03-06 |
| TASK-1.4 | ✅ 完了 | 2026-03-06 |
| TASK-1.5 | ✅ 完了 | 2026-03-06 |
| TASK-2.1 | ✅ 完了 | 2026-03-06 |
| TASK-2.2 | ✅ 完了 | 2026-03-06 |
| TASK-3.1 | ✅ 完了 | 2026-03-08 |
| TASK-3.2 | ✅ 完了 | 2026-03-08 |
| TASK-3.3 | ✅ 完了 | 2026-03-08 |
| TASK-3.4 | ✅ 完了 | 2026-03-08 |
| TASK-3.5 | ✅ 完了 | 2026-03-08 |
| TASK-4.1 | ✅ 完了 | 2026-03-08 |
| TASK-4.2 | ✅ 完了 | 2026-03-08 |
| TASK-4.3 | ✅ 完了 | 2026-03-08 |
| TASK-5.1 | ✅ 完了 | 2026-03-08 |
| TASK-5.2 | ✅ 完了 | 2026-03-08 |
| TASK-6.1 | ⬜ 未着手 | - |
| TASK-6.2 | ⬜ 未着手 | - |
| TASK-6.3 | ⬜ 未着手 | - |
| TASK-6.4 | ⬜ 未着手 | - |
| TASK-6.5 | ⬜ 未着手 | - |
