# 技術設計: 駅ホーム設備の定義方法改善 (Issue #29)

## 概要

- **対象**: `packages/database`, `apps/admin`, `apps/web`
- **参照**: [`requirements.md`](./requirements.md)
- **作成日**: 2026-03-06

---

## アーキテクチャ概要

### 変更対象レイヤー

```
packages/database/
  └── src/schema.ts              ← スキーマ変更（主要）

apps/admin/
  ├── src/lib/validations.ts    ← バリデーションスキーマ変更
  ├── src/components/
  │   └── FacilityForm.tsx      ← 大幅改修
  └── src/app/api/stations/[stationId]/
      └── platform-locations/
          ├── route.ts          ← GET・POST更新
          └── [locationId]/
              ├── route.ts      ← PUT・DELETE更新
              └── duplicate/
                  └── route.ts  ← Duplicate更新

apps/admin/src/app/stations/[stationId]/facilities/
  ├── page.tsx                  ← 一覧表示更新
  └── [locationId]/edit/
      └── page.tsx              ← 編集ページ更新

apps/web/
  ├── src/app/stations/[slug]/page.tsx  ← クエリ更新
  └── src/components/PlatformDisplay.tsx ← 型・表示更新

apps/scripts/
  └── src/migrate-platform-locations.ts ← 新規（移行スクリプト）
```

---

## データモデル

### 現行スキーマ（変更前）

```
platforms (ホーム)
  └── platformLocations
        ├── nearPlatformCell: integer  ← 枠番号
        ├── exits: text
        ├── notes: text
        ├── stationFacilities (FK: platformLocationId)
        │     ├── typeCode
        │     ├── isWheelchairAccessible
        │     └── isStrollerAccessible
        └── facilityConnections (FK: platformLocationId)
              ├── connectedStationId: uuid NOT NULL
              └── exitLabel: text
```

### 新スキーマ（変更後）

```
platforms (ホーム)
  └── platformLocations (コンコース)
        ├── exits: text              ← nearPlatformCell を削除
        ├── notes: text
        ├── platformLocationCells (NEW, FK: platformLocationId CASCADE)
        │     ├── nearPlatformCell: integer nullable  ← ここに移動
        │     └── stationFacilities (FK: platformLocationCellId CASCADE)
        │           ├── typeCode
        │           ├── isWheelchairAccessible
        │           └── isStrollerAccessible
        └── facilityConnections (FK: platformLocationId CASCADE)
              ├── connectedStationId: uuid NOT NULL  ← 維持
              ├── connectedPlatformId: uuid nullable  ← 新規追加
              ├── directionId: uuid nullable          ← 新規追加
              └── exitLabel: text
```

### テーブル定義

#### 新テーブル: `platform_location_cells`

```typescript
export const platformLocationCells = pgTable('platform_location_cells', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformLocationId: uuid('platform_location_id')
    .references(() => platformLocations.id, { onDelete: 'cascade' })
    .notNull(),
  nearPlatformCell: integer('near_platform_cell'),  // null = コンコース全体
});
```

#### 変更: `station_facilities` (FKカラム名変更)

```typescript
// 変更前
platformLocationId: uuid('platform_location_id')
  .references(() => platformLocations.id, { onDelete: 'cascade' })
  .notNull()

// 変更後
platformLocationCellId: uuid('platform_location_cell_id')
  .references(() => platformLocationCells.id, { onDelete: 'cascade' })
  .notNull()
```

#### 変更: `facility_connections` (カラム追加)

```typescript
// 追加
connectedPlatformId: uuid('connected_platform_id')
  .references(() => platforms.id),  // nullable
directionId: uuid('direction_id')
  .references(() => lineDirections.id),  // nullable
```

#### 変更: `platform_locations` (カラム削除)

```typescript
// 削除するカラム
nearPlatformCell: integer('near_platform_cell')  // platformLocationCells へ移動
```

---

## データフロー

### Admin側（登録・編集）

```
[管理者ブラウザ]
     │ FacilityForm.tsx (Client Component)
     │ payload: {
     │   platformId, exits, notes,
     │   cells: [{ nearPlatformCell, facilities: [...] }],
     │   connections: [{ stationId, connectedPlatformId?, directionId?, exitLabel }]
     │ }
     ▼
[POST/PUT /api/stations/:stationId/platform-locations]
     │
     ├── INSERT INTO platform_locations (platformId, exits, notes)
     │
     ├── for each cell:
     │   ├── INSERT INTO platform_location_cells (platformLocationId, nearPlatformCell)
     │   └── INSERT INTO station_facilities (platformLocationCellId, typeCode, ...)
     │
     └── INSERT INTO facility_connections (platformLocationId, connectedStationId, connectedPlatformId?, directionId?, exitLabel)
```

### Web側（表示）

```
[ユーザーブラウザ]
     ▼
[GET /stations/:slug]  (Server Component)
     │
     ├── SELECT * FROM platform_locations WHERE platformId IN (...)
     │
     ├── SELECT * FROM platform_location_cells WHERE platformLocationId IN (...)
     │
     ├── SELECT * FROM station_facilities WHERE platformLocationCellId IN (...)
     │
     └── SELECT facilityConnections + stations + lineDirections
           WHERE platformLocationId IN (...)
     │
     ▼
[データ組み立て]
     │ 構造: concourse → cells → facilities
     │
     ▼
[PlatformDisplay.tsx]
     │ 表示: コンコース単位グルーピング
     │   ○○駅（南口方面）:
     │     3号車付近: 階段・エスカレーター
     │     5号車付近: エレベーター
     ▼
[ユーザー]
```

---

## インターフェース定義

### Admin APIリクエスト/レスポンス

#### POST/PUT リクエストボディ

```typescript
type PlatformLocationRequest = {
  platformId: string;          // UUID
  exits: string | null;        // 出口テキスト
  notes: string | null;        // メモ
  cells: CellRequest[];        // 1件以上必須
  connections?: ConnectionRequest[];
};

type CellRequest = {
  nearPlatformCell: number | null;  // null = コンコース全体
  facilities: FacilityRequest[];
};

type FacilityRequest = {
  typeCode: string;
  isWheelchairAccessible?: boolean;
  isStrollerAccessible?: boolean;
  notes?: string | null;
};

type ConnectionRequest = {
  stationId: string;               // UUID, NOT NULL
  connectedPlatformId?: string | null;  // UUID, optional
  directionId?: string | null;          // UUID, optional
  exitLabel?: string | null;
};
```

#### GET レスポンスボディ

```typescript
type PlatformLocationResponse = {
  id: string;
  platformId: string;
  exits: string | null;
  notes: string | null;
  cells: CellResponse[];
  connections: ConnectionResponse[];
};

type CellResponse = {
  id: string;
  nearPlatformCell: number | null;
  facilities: FacilityResponse[];
};

type FacilityResponse = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
  notes: string | null;
};

type ConnectionResponse = {
  id: string;
  connectedStationId: string;
  connectedPlatformId: string | null;
  directionId: string | null;
  exitLabel: string | null;
};
```

### Web表示用型定義

`apps/web/src/components/PlatformDisplay.tsx`:

```typescript
export type PlatformLocation = {
  id: string;
  exits: string | null;
  cells: PlatformLocationCell[];
  connections: FacilityConnection[];
};

export type PlatformLocationCell = {
  nearPlatformCell: number | null;
  facilities: Facility[];
};

export type Facility = {
  id: string;
  typeCode: string;
  typeName: string;
  isWheelchairAccessible: boolean | null;
  isStrollerAccessible: boolean | null;
};

export type FacilityConnection = {
  stationName: string;
  lineNames: string[];
  directionName: string | null;  // 新規: 方面名
  exitLabel: string | null;
};
```

---

## データ移行戦略

### 移行スクリプト: `apps/scripts/src/migrate-platform-locations.ts`

既存データを新スキーマへ自動変換する。

**変換ロジック:**

```
既存 platformLocations レコード:
  { id, platformId, nearPlatformCell: 3, exits, notes }
  → stationFacilities: [{ platformLocationId: id, typeCode: 'stairs' }]

変換後:
  platformLocations: { id, platformId, exits, notes }  ← nearPlatformCell 削除
  platformLocationCells: { id: new_id, platformLocationId: id, nearPlatformCell: 3 }
  stationFacilities: { platformLocationCellId: new_id, typeCode: 'stairs' }
```

**実行手順:**
1. `pnpm run db:generate` でマイグレーションファイル生成
2. `pnpm run db:migrate` でスキーマ適用
3. `pnpm run migrate-platform-locations` で既存データ変換

**検証:**
- 移行前後で `platformLocations` 件数が一致する
- 全 `platformLocations` に対して `platformLocationCells` が1件以上存在する
- 全 `stationFacilities` が有効な `platformLocationCellId` を参照する

---

## Admin UI変更

### FacilityForm.tsx 設計

現在の「1つの枠番号 + 複数設備タイプ」という構造を「複数アクセス点（各々が枠番号+設備タイプ）のリスト」に変更する。

**アクセス点セクション（動的リスト）:**

```
コンコース情報:
  ホーム: [ドロップダウン]
  出口: [テキスト入力]
  メモ: [テキストエリア]

アクセス点:
  [ + アクセス点を追加 ]
  ┌─────────────────────────────┐
  │ アクセス点 1                 │
  │  枠番号: [数値入力]          │
  │  設備タイプ:                 │
  │    ☑ 階段  ☑ エスカレーター  │
  │    ☐ エレベーター            │
  │  [削除]                     │
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │ アクセス点 2                 │
  │  枠番号: [数値入力]          │
  │  設備タイプ: ☑ エレベーター  │
  │  [削除]                     │
  └─────────────────────────────┘

乗換可能な駅:
  [ + 接続を追加 ]
  ┌──────────────────────────────────────────┐
  │ 接続先駅: [駅ドロップダウン]              │
  │ 対象ホーム: [ホームドロップダウン] (任意) │
  │ 対象方面: [方面ドロップダウン] (任意)     │
  │ 出口ラベル: [テキスト入力]               │
  │ [削除]                                   │
  └──────────────────────────────────────────┘
```

---

## エラーハンドリング

| シナリオ | 対応 |
|---------|------|
| アクセス点が0件で送信 | バリデーションエラー: 「アクセス点を1つ以上追加してください」|
| 各アクセス点の設備タイプが0件 | バリデーションエラー: 「設備タイプを1つ以上選択してください」|
| 接続先駅が未選択で接続追加 | 送信時に空の接続を除外 |
| `connectedPlatformId` に無効なIDが入力 | Zodバリデーションエラー |

---

## テスト戦略

- **ビルド確認**: `pnpm run build` で型エラー・コンパイルエラーがないことを確認
- **移行スクリプト検証**: 開発DBで実行し、件数・参照整合性を手動確認
- **Admin手動テスト**:
  - 新規コンコース（複数アクセス点）の登録・編集・削除
  - 対面乗り換え（connectedPlatformId指定）の登録
  - 方面別設備（directionId指定）の登録
- **Web手動テスト**:
  - 駅詳細ページでコンコース単位グルーピング表示を確認
