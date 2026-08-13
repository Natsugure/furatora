# 技術設計: ホーム設備・車両停車位置のメートル座標化 (Issue #29 拡張)

## 概要

- **対象**: `packages/database`, `apps/admin`, `apps/web`, `apps/scripts`
- **参照**: [`requirements.md`](./requirements.md)
- **作成日**: 2026-08-14

---

## 適応的実行戦略（信頼度72%・中信頼度）

`requirements.md` の信頼度評価により、PoC/MVPを優先する。

**MVP範囲**: 1駅・1ホーム（新宿駅 3・4番線相当の複数パターンが存在するケースを選定）に対して、スキーマ変更 → Admin登録（停車位置パターン・設備） → Web表示（SVG viewBox描画）を通しで実装・検証する。

**MVP成功基準**:
1. 号車数が同じで停車位置・向きが異なる2つの列車パターンを、同一ホームに矛盾なく登録できる
2. 1両の前方・後方に別々の設備（例: 階段A・階段B）を区別して登録・表示できる
3. ホーム原点からの相対位置として、車両の停車範囲外（頭端式相当）に設備を登録・表示できる
4. SVGのviewBoxにより、ブラウザの表示幅を変えても要素間の位置比率が崩れない

MVP検証後、他のAdmin画面（`TrainForm`等）・全駅データへの展開に進む。

---

## アーキテクチャ概要

### 変更対象レイヤー

```
packages/database/
  └── src/schema.ts              ← スキーマ変更（主要）

apps/admin/
  ├── src/lib/validations.ts     ← バリデーションスキーマ変更
  ├── src/components/
  │   ├── PlatformForm.tsx       ← physicalLength入力に変更
  │   ├── TrainForm.tsx          ← limitedToPlatformIds削除、carLength追加
  │   ├── FacilityForm.tsx       ← 枠番号→メートル入力に変更
  │   └── TrainStopPatternForm.tsx（新規） ← 停車位置パターン編集
  └── src/app/api/stations/[stationId]/
      ├── platform-locations/... ← メートル対応
      └── train-stop-patterns/... （新規）

apps/web/
  ├── src/app/stations/[slug]/page.tsx   ← クエリ・列車表示判定の変更
  ├── src/components/TrainVisualization.tsx ← SVG viewBox方式に全面書き換え
  ├── src/components/PlatformDisplay.tsx ← 型・表示更新
  └── src/components/PlatformTabs.tsx    ← 型更新

apps/scripts/
  └── src/migrate-platform-locations.ts  ← 削除（リセット方針のため不要）
```

---

## データモデル

### 現行スキーマ（変更前・#29時点）

```
platforms
  ├── maxCarCount: integer
  └── platformCarStopPositions (FK: platformId, unique on [platformId, carCount])
        ├── referenceCarNumber / referencePlatformCell / direction

platformLocations (コンコース)
  └── platformLocationCells
        ├── nearPlatformCell: integer nullable
        └── stationFacilities

facilityConnections
  ├── connectedStationId / connectedPlatformId / directionId
  └── exitLabel

trains
  └── limitedToPlatformIds: uuid[] nullable
```

### 新スキーマ（変更後）

```
platforms
  ├── maxCarCount 削除
  └── physicalLength: decimal              ← 新規（メートル、管理者手入力）

trainStopPatterns (NEW, platformCarStopPositionsを置き換え)
  ├── platformId, trainId
  ├── unique(platformId, trainId)
  └── trainStopPatternCars (NEW, FK: trainStopPatternId CASCADE)
        ├── carNumber: integer
        ├── startMeters: decimal
        └── endMeters: decimal

trainCarStructures
  └── carLength: decimal nullable          ← 新規（未指定時は標準値を使用）

trains
  └── limitedToPlatformIds 削除            ← trainStopPatternsの存在で判定

platformLocations (コンコース)             ← 構造は維持
  └── platformLocationCells
        ├── nearPlatformCell 削除
        └── xPositionMeters: decimal nullable  ← 新規（null=コンコース全体）

facilityConnections
  ├── 既存カラムは維持
  ├── xRangeStart: decimal nullable        ← 新規（対面乗り換え帯用）
  └── xRangeEnd: decimal nullable          ← 新規（対面乗り換え帯用）
```

### テーブル定義

#### 変更: `platforms`

```typescript
export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationId: uuid('station_id').references(() => stations.id).notNull(),
  platformNumber: varchar('platform_number', { length: 10 }).notNull(),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  inboundDirectionId: uuid('inbound_direction_id').references(() => lineDirections.id),
  outboundDirectionId: uuid('outbound_direction_id').references(() => lineDirections.id),
  physicalLength: decimal('physical_length', { precision: 6, scale: 2 }).notNull(), // メートル
  platformSide: varchar('platform_side', { length: 10 }).$type<PlatformSide>(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});
// maxCarCount を削除
```

#### 新テーブル: `trainStopPatterns`

```typescript
export const trainStopPatterns = pgTable('train_stop_patterns', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformId: uuid('platform_id').references(() => platforms.id, { onDelete: 'cascade' }).notNull(),
  trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('unique_train_stop_pattern').on(t.platformId, t.trainId),
]);
```

#### 新テーブル: `trainStopPatternCars`

```typescript
export const trainStopPatternCars = pgTable('train_stop_pattern_cars', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  trainStopPatternId: uuid('train_stop_pattern_id')
    .references(() => trainStopPatterns.id, { onDelete: 'cascade' })
    .notNull(),
  carNumber: integer('car_number').notNull(),
  startMeters: decimal('start_meters', { precision: 6, scale: 2 }).notNull(),
  endMeters: decimal('end_meters', { precision: 6, scale: 2 }).notNull(),
}, (t) => [
  unique('unique_train_stop_pattern_car').on(t.trainStopPatternId, t.carNumber),
]);
```

#### 変更: `trainCarStructures`（カラム追加）

```typescript
export const trainCarStructures = pgTable('train_car_structures', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
  carNumber: integer('car_number').notNull(),
  doorCount: integer('door_count').notNull(),
  carLength: decimal('car_length', { precision: 5, scale: 2 }), // メートル、未指定=標準値（20.0m）
}, (t) => [
  unique('unique_train_car_structure').on(t.trainId, t.carNumber),
]);
```

#### 変更: `trains`（カラム削除）

```typescript
// 削除
limitedToPlatformIds: uuid('limited_to_platform_ids').array(),
```

#### 変更: `platformLocationCells`

```typescript
export const platformLocationCells = pgTable('platform_location_cells', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformLocationId: uuid('platform_location_id')
    .references(() => platformLocations.id, { onDelete: 'cascade' })
    .notNull(),
  xPositionMeters: decimal('x_position_meters', { precision: 6, scale: 2 }), // null = コンコース全体
});
// nearPlatformCell を削除
```

#### 変更: `facilityConnections`（カラム追加）

```typescript
// 追加（対面乗り換え帯: connectedPlatformIdが設定されている行のみ使用）
xRangeStart: decimal('x_range_start', { precision: 6, scale: 2 }), // nullable
xRangeEnd: decimal('x_range_end', { precision: 6, scale: 2 }),     // nullable
```

#### 削除: `platformCarStopPositions`

`trainStopPatterns` / `trainStopPatternCars` に置き換えるため削除する。

---

## 座標系のルール

1. ホームごとに、登録済み `trainStopPatterns` のうち最も号車数が多いものの1号車先端を `x=0` とする
2. 他の停車位置パターンは、原点とは独立したオフセットを持てる（同じホーム内でも編成長が異なれば停車位置がずれるため）
3. `physicalLength` を超える範囲（頭端式ホームの外側など）にも設備・アクセス点を配置できる
4. SVGのviewBoxは `physicalLength` と全設備・全停車位置パターンの座標の最小値・最大値からマージンを加えて動的に算出する（デモ実装の `computeBounds` と同等のロジック）

### 号車位置の自動算出ロジック（`trainStopPatternCars` 生成時）

1. 管理者が対象の `platformId` ・ `trainId` を選択
2. 原点への寄せ方を選択（例:「1号車をx=0に揃える」「オフセットを直接数値入力」）
3. `trainCarStructures.carLength`（未指定時は標準値 20.0m）を号車順に積算し、各号車の `startMeters` / `endMeters` を算出
4. 算出結果をプレビュー表示し、管理者が個別の号車境界を上書き可能な状態で保存

---

## データフロー

### Admin側（停車位置パターン登録）

```
[管理者ブラウザ] TrainStopPatternForm.tsx
     │ payload: { platformId, trainId, alignment, carLengthOverrides? }
     ▼
[POST /api/stations/:stationId/train-stop-patterns]
     │
     ├── trainCarStructures から各号車の carLength を取得（未指定は標準値）
     ├── alignment に基づき各号車の startMeters/endMeters を算出
     ├── INSERT INTO train_stop_patterns (platformId, trainId)
     └── INSERT INTO train_stop_pattern_cars (carNumber, startMeters, endMeters) × 号車数
```

### Admin側（設備登録、#29から座標型のみ変更）

```
[管理者ブラウザ] FacilityForm.tsx
     │ payload: { platformId, exits, notes,
     │   cells: [{ xPositionMeters, facilities: [...] }],
     │   connections: [{ stationId, connectedPlatformId?, directionId?, xRangeStart?, xRangeEnd?, exitLabel }]
     │ }
     ▼
[POST/PUT /api/stations/:stationId/platform-locations]
     （テーブル構成は#29と同様、カラムの型のみ変更）
```

### Web側（表示）

```
[GET /stations/:slug]  (Server Component)
     │
     ├── SELECT physicalLength FROM platforms
     ├── SELECT * FROM train_stop_patterns JOIN train_stop_pattern_cars
     │     WHERE platformId IN (...)
     ├── SELECT * FROM platform_location_cells (xPositionMeters) ...
     └── SELECT facilityConnections（xRangeStart/xRangeEnd含む）...
     ▼
[データ組み立て] 構造: platform(physicalLength) → trainStopPatterns[] → cars[] / concourse → cells → facilities
     ▼
[TrainVisualization.tsx] SVG viewBoxで描画（デモの PlatformDiagram 相当）
     ▼
[ユーザー]
```

---

## インターフェース定義

### Admin APIリクエスト/レスポンス

```typescript
// 停車位置パターン
type TrainStopPatternRequest = {
  platformId: string;
  trainId: string;
  cars: { carNumber: number; startMeters: number; endMeters: number }[];
};

// コンコース（#29から型変更のみ）
type PlatformLocationRequest = {
  platformId: string;
  exits: string | null;
  notes: string | null;
  cells: CellRequest[];
  connections?: ConnectionRequest[];
};

type CellRequest = {
  xPositionMeters: number | null; // null = コンコース全体
  facilities: FacilityRequest[];
};

type ConnectionRequest = {
  stationId: string;
  connectedPlatformId?: string | null;
  directionId?: string | null;
  xRangeStart?: number | null; // 対面乗り換え帯（connectedPlatformId指定時のみ意味を持つ）
  xRangeEnd?: number | null;
  exitLabel?: string | null;
};
```

### Web表示用型定義

```typescript
export type PlatformViewModel = {
  id: string;
  physicalLength: number;
  stopPatterns: TrainStopPattern[];
  concourses: Concourse[];
};

export type TrainStopPattern = {
  trainId: string;
  trainLabel: string;
  cars: { carNumber: number; startMeters: number; endMeters: number }[];
};

export type Concourse = {
  id: string;
  exits: string | null;
  cells: { xPositionMeters: number | null; facilities: Facility[] }[];
  connections: FacilityConnection[];
};

export type FacilityConnection = {
  stationName: string;
  lineNames: string[];
  directionName: string | null;
  exitLabel: string | null;
  xRangeStart: number | null;
  xRangeEnd: number | null;
};
```

---

## Admin UI変更

### 新規: 停車位置パターン編集（`TrainStopPatternForm.tsx`）

```
ホーム: [ドロップダウン]
列車:   [ドロップダウン]

原点への寄せ方:
  ( ) 1号車先端をx=0に揃える
  ( ) オフセットを直接指定: [数値入力] m

[自動計算して プレビュー表示]

号車ごとの位置（上書き可）:
  1号車: [start] 〜 [end] m
  2号車: [start] 〜 [end] m
  ...
```

### `FacilityForm.tsx`（#29から座標入力欄のみ変更）

枠番号の数値入力を「ホーム原点からのメートル位置」入力に置き換える。コンコース＋アクセス点のUI構造自体は維持する。対面乗り換え接続には帯の範囲（開始・終了メートル）入力欄を追加する。

---

## エラーハンドリング

| シナリオ | 対応 |
|---------|------|
| 同一ホーム・列車の組み合わせで停車位置パターンを重複登録 | ユニーク制約違反として409エラー |
| 号車の開始位置が終了位置以上 | バリデーションエラー：「開始位置は終了位置より小さい値にしてください」 |
| 停車位置パターン未登録の列車 | Web側では表示対象から除外（エラーではなく正常系） |
| アクセス点が0件で送信 | バリデーションエラー：「アクセス点を1つ以上追加してください」 |
| 接続先駅が未選択で接続追加 | 送信時に空の接続を除外 |
| `xRangeStart` > `xRangeEnd` | バリデーションエラー |

---

## テスト戦略

- **ビルド確認**: `pnpm run build` で型エラー・コンパイルエラーがないことを確認
- **MVP検証**: 選定した1駅1ホームで、要件定義のMVP成功基準4項目を手動確認
- **Admin手動テスト**:
  - 号車数が同じで向きが異なる2パターンの登録
  - 号車の自動算出結果の上書き
  - 対面乗り換え帯（`xRangeStart`/`xRangeEnd`）の登録
- **Web手動テスト**:
  - SVG viewBoxが画面幅に応じて崩れずスケールすること
  - 頭端式ホーム相当のケースで、車両範囲外の設備が正しい位置に描画されること
- **既存データ**: 開発中データのためリセットして再構築し、回帰確認は主要駅（新宿・赤坂見附相当）で目視確認する

---

## 移行方針

開発中データのため、`platform_locations` 系・`platform_car_stop_positions` のデータはマイグレーション後にリセットする。`apps/scripts/src/migrate-platform-locations.ts` は不要になるため削除し、代わりに新スキーマ用のシード/再構築手順（`update-odpt` 実行＋対象駅の手動再入力）をREADME等に記載する。
