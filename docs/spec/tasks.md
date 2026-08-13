# 実装タスク: ホーム設備・車両停車位置のメートル座標化 (Issue #29 拡張)

## 概要

- **対象**: `packages/database`, `apps/admin`, `apps/web`, `apps/scripts`
- **参照**: [`requirements.md`](./requirements.md) / [`design.md`](./design.md)
- **作成日**: 2026-08-14
- **ブランチ**: `feature/issue29-platform-improve`
- **信頼度**: 72%（中）→ MVP検証を先行させる（詳細は `design.md` の「適応的実行戦略」参照）

---

## フェーズ構成

```
Phase 0: docs/spec更新                     (完了)
Phase 1: スキーマ変更                      (基盤)
Phase 2: 既存データのリセット               (必須)
Phase 3: Admin API更新                     (P0)
Phase 4: Admin UI更新                      (P0)
Phase 5: Web UI更新                        (P1)
Phase 6: MVP検証・全体検証・振り返り        (必須)
```

Phase 3〜5 は互いに独立して着手できるが、Phase 6 のMVP検証は Phase 1〜5 すべてが揃った時点で1駅1ホーム分を通しで行う。

---

## Phase 0: docs/spec更新（完了）

### TASK-0.1: requirements.md 更新
- **状態**: ✅ 完了 (2026-08-14)

### TASK-0.2: design.md 更新
- **状態**: ✅ 完了 (2026-08-14)

### TASK-0.3: tasks.md 更新
- **状態**: ✅ 完了 (2026-08-14)

---

## Phase 1: スキーマ変更

### TASK-1.1: `platforms` テーブルの `maxCarCount` を `physicalLength` に置き換え
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `maxCarCount: integer('max_car_count').notNull()` を削除
  - `physicalLength: decimal('physical_length', { precision: 6, scale: 2 }).notNull()` を追加
- **期待結果**: `platforms` テーブルが号車数ではなくメートル単位の物理長を持つ
- **依存**: なし

### TASK-1.2: `platformCarStopPositions` テーブルを削除
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**: `platformCarStopPositions` テーブル定義および `CarStopPosition` 型を削除する
- **期待結果**: 号車基準の停車位置テーブルが存在しなくなる
- **依存**: なし

### TASK-1.3: `trainStopPatterns` テーブルを新規追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
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
- **期待結果**: ホーム・列車の組み合わせごとに1つの停車位置パターンを持てる
- **依存**: なし

### TASK-1.4: `trainStopPatternCars` テーブルを新規追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
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
- **期待結果**: 号車ごとの開始・終了位置（メートル）を保持できる
- **依存**: TASK-1.3

### TASK-1.5: `trainCarStructures` に `carLength` を追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**: `trainCarStructures` に `carLength: decimal('car_length', { precision: 5, scale: 2 })`（nullable）を追加
- **期待結果**: 号車ごとの実長を任意で保持できる。未指定時はアプリ側で標準値（20.0m）を使う
- **依存**: なし

### TASK-1.6: `trains` から `limitedToPlatformIds` を削除
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**: `limitedToPlatformIds: uuid('limited_to_platform_ids').array()` を削除
- **期待結果**: 列車のホーム表示判定が `trainStopPatterns` の存在のみに一本化される
- **依存**: なし

### TASK-1.7: `platformLocationCells` の `nearPlatformCell` を `xPositionMeters` に置き換え
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `nearPlatformCell: integer('near_platform_cell')` を削除
  - `xPositionMeters: decimal('x_position_meters', { precision: 6, scale: 2 })`（nullable、null=コンコース全体）を追加
- **期待結果**: 設備アクセス点の位置がメートル単位になる
- **依存**: なし

### TASK-1.8: `facilityConnections` に対面乗り換え帯の範囲カラムを追加
- **対象ファイル**: `packages/database/src/schema.ts`
- **実装内容**:
  - `xRangeStart: decimal('x_range_start', { precision: 6, scale: 2 })`（nullable）を追加
  - `xRangeEnd: decimal('x_range_end', { precision: 6, scale: 2 })`（nullable）を追加
- **期待結果**: `connectedPlatformId` を指定した対面乗り換え接続に、自ホーム座標系での帯範囲を持たせられる
- **依存**: なし

### TASK-1.9: マイグレーションファイル生成
- **コマンド**: `pnpm run db:generate`
- **期待結果**: `packages/database/drizzle/` 配下に新しいマイグレーションファイルが生成される
- **依存**: TASK-1.1〜TASK-1.8
- **注意**: `pnpm run db:push` で対話型ウィザードが表示された場合は、選択内容を開発者に提示して完了まで待機すること

---

## Phase 2: 既存データのリセット

`requirements.md` REQ-8.1/8.2 の通り、開発中データのため移行スクリプトは作成せずリセットする。

### TASK-2.1: 旧移行スクリプトを削除
- **対象ファイル**: `apps/scripts/src/migrate-platform-locations.ts`（削除）
- **実装内容**: ファイル自体を削除し、`apps/scripts/package.json` の `migrate-platform-locations` コマンドも削除する
- **依存**: なし

### TASK-2.2: 開発DBへのマイグレーション適用
- **コマンド**: `pnpm run db:migrate`（または開発環境なら `pnpm run db:push`、対話ウィザードが出た場合は開発者に選択内容を確認）
- **期待結果**: 新スキーマが開発DBに反映される。旧テーブル・カラムに依存していたデータは失われる
- **依存**: TASK-1.9, TASK-2.1

### TASK-2.3: ODPTデータの再取得
- **コマンド**: `pnpm run update-odpt`
- **期待結果**: 駅・路線・ホームの基礎データが再構築される（`physicalLength` 等の手動項目は別途入力が必要）
- **依存**: TASK-2.2

---

## Phase 3: Admin API更新

### TASK-3.1: バリデーションスキーマ更新
- **対象ファイル**: `apps/admin/src/lib/validations.ts`
- **実装内容**:
  - `platformSchema`: `maxCarCount: z.number().int().min(1)` を `physicalLength: z.number().positive()` に変更
  - `trainSchema`: `limitedToPlatformIds` を削除
  - `carStructureSchema`: `carLength: z.number().positive().nullable().optional()` を追加
  - `cellSchema`: `nearPlatformCell` を `xPositionMeters: z.number().nullable()` に変更
  - `connectionSchema`: `xRangeStart: z.number().nullable().optional()`, `xRangeEnd: z.number().nullable().optional()` を追加
  - `trainStopPatternSchema` を新規追加:
    ```typescript
    const trainStopPatternCarSchema = z.object({
      carNumber: z.number().int().min(1),
      startMeters: z.number(),
      endMeters: z.number(),
    }).refine((v) => v.startMeters < v.endMeters, {
      message: '開始位置は終了位置より小さい値にしてください',
    });

    const trainStopPatternSchema = z.object({
      platformId: z.string().uuid(),
      trainId: z.string().uuid(),
      cars: z.array(trainStopPatternCarSchema).min(1),
    });
    ```
- **依存**: なし

### TASK-3.2: `platforms` API更新
- **対象ファイル**: `apps/admin/src/app/api/stations/[stationId]/platforms/route.ts`, `apps/admin/src/app/api/stations/[stationId]/platforms/[platformId]/route.ts`
- **実装内容**: リクエスト/レスポンスの `maxCarCount` を `physicalLength` に置き換える。`carStopPositions` の受け渡し処理（`platformCarStopPositions` 由来）を削除する
- **依存**: TASK-3.1, TASK-1.9

### TASK-3.3: `trains` API更新
- **対象ファイル**: `apps/admin/src/app/api/trains/[trainId]/route.ts`
- **実装内容**: `limitedToPlatformIds` の受け渡しを削除。`carStructure` の各要素に `carLength` を追加して保存する
- **依存**: TASK-3.1, TASK-1.9

### TASK-3.4: `platform-locations` API更新（GET/POST/PUT/duplicate）
- **対象ファイル**:
  - `apps/admin/src/app/api/stations/[stationId]/platform-locations/route.ts`
  - `apps/admin/src/app/api/stations/[stationId]/platform-locations/[locationId]/route.ts`
  - `apps/admin/src/app/api/stations/[stationId]/platform-locations/[locationId]/duplicate/route.ts`
- **実装内容**: `cells[].nearPlatformCell` → `cells[].xPositionMeters`、`connections[]` に `xRangeStart`/`xRangeEnd` を追加してCRUD・複製処理を更新する
- **依存**: TASK-3.1, TASK-1.9

### TASK-3.5: `train-stop-patterns` API新規作成
- **対象ファイル**: `apps/admin/src/app/api/stations/[stationId]/train-stop-patterns/route.ts`（新規）、`apps/admin/src/app/api/stations/[stationId]/train-stop-patterns/[patternId]/route.ts`（新規）
- **実装内容**:
  - `GET`: 指定ホームの全 `trainStopPatterns` を `trainStopPatternCars` とJOINして返す
  - `POST`: リクエストで受け取った `cars[]`（自動算出済みまたは手動調整済みの号車ごとのstart/end）をそのまま `trainStopPatterns` + `trainStopPatternCars` に保存する（自動算出のロジック自体はTASK-4.4のクライアント側で行い、APIは保存に徹する）
  - `DELETE`: `trainStopPatterns` を削除（CASCADEで `trainStopPatternCars` も削除）
- **期待結果**: ホーム・列車ごとに停車位置パターンを保存・取得・削除できる
- **依存**: TASK-3.1, TASK-1.9

---

## Phase 4: Admin UI更新

### TASK-4.1: `PlatformForm.tsx` 更新
- **対象ファイル**: `apps/admin/src/components/PlatformForm.tsx`
- **実装内容**: `maxCarCount` の数値入力（号車数）を `physicalLength` の数値入力（メートル、小数対応）に置き換える。`carStopPositions` 関連の入力UI（基準号車・基準枠番号・方向）を削除する
- **依存**: TASK-3.2

### TASK-4.2: `TrainForm.tsx` 更新
- **対象ファイル**: `apps/admin/src/components/TrainForm.tsx`
- **実装内容**: `limitedToPlatformIds` のホーム選択UIを削除する。号車構成（`carStructure`）の各行に、実長（メートル、任意入力）の数値フィールドを追加する
- **依存**: TASK-3.3

### TASK-4.3: `FacilityForm.tsx` 更新
- **対象ファイル**: `apps/admin/src/components/FacilityForm.tsx`
- **実装内容**:
  - アクセス点の「枠番号」数値入力を「ホーム原点からのメートル位置」入力に置き換える（`description` の文言も更新）
  - 接続（`connections`）に `connectedPlatformId` を指定した場合のみ表示される、対面乗り換え帯の範囲入力（開始・終了メートル）を追加する
- **依存**: TASK-3.4

### TASK-4.4: `TrainStopPatternForm.tsx` 新規作成
- **対象ファイル**: `apps/admin/src/components/TrainStopPatternForm.tsx`（新規）
- **実装内容**:
  - ホーム・列車のドロップダウン選択
  - 原点への寄せ方（「1号車先端をx=0に揃える」／「オフセットを直接入力」）の選択UI
  - 選択された列車の `carStructure`（`carLength`、未指定時は標準値20.0m）と号車数から、各号車の `startMeters`/`endMeters` をクライアント側で計算してプレビュー表示する関数を実装:
    ```typescript
    const DEFAULT_CAR_LENGTH = 20.0;

    function buildCarSegments(
      carStructure: { carNumber: number; carLength: number | null }[],
      offsetMeters: number
    ): { carNumber: number; startMeters: number; endMeters: number }[] {
      const sorted = [...carStructure].sort((a, b) => a.carNumber - b.carNumber);
      let cursor = offsetMeters;
      return sorted.map((car) => {
        const length = car.carLength ?? DEFAULT_CAR_LENGTH;
        const start = cursor;
        const end = cursor + length;
        cursor = end;
        return { carNumber: car.carNumber, startMeters: start, endMeters: end };
      });
    }
    ```
  - プレビューされた各号車の `startMeters`/`endMeters` を個別に上書きできる入力欄を用意する
  - 保存時に `POST /api/stations/:stationId/train-stop-patterns` へ送信する
- **依存**: TASK-3.5

### TASK-4.5: 停車位置パターン一覧・編集ページ作成
- **対象ファイル**: `apps/admin/src/app/stations/[stationId]/platforms/[platformId]/stop-patterns/page.tsx`（新規）
- **実装内容**: 対象ホームに登録済みの `trainStopPatterns` を一覧表示し、`TrainStopPatternForm` への導線（新規作成・編集・削除）を提供する
- **依存**: TASK-4.4

---

## Phase 5: Web UI更新

### TASK-5.1: 駅詳細ページのクエリ・列車表示判定を更新
- **対象ファイル**: `apps/web/src/app/stations/[slug]/page.tsx`
- **実装内容**:
  - `platforms.maxCarCount` の取得・比較処理を削除し、`physicalLength` を取得する
  - `train.carCount > platform.maxCarCount` および `train.limitedToPlatformIds` による判定（337〜340行目付近）を削除し、`trainStopPatterns`（+`trainStopPatternCars`）を `platformId` でJOIN取得し、パターンが存在する列車のみを `platformTrains` に含めるロジックに置き換える
  - `platformLocationCells.xPositionMeters`、`facilityConnections.xRangeStart/xRangeEnd` を取得するクエリに更新する
- **依存**: TASK-1.9, TASK-2.2

### TASK-5.2: `TrainVisualization.tsx` をSVG viewBox方式に全面書き換え
- **対象ファイル**: `apps/web/src/components/TrainVisualization.tsx`
- **実装内容**: `design.md` の「座標系のルール」に従い、`physicalLength`・`trainStopPatternCars`・`platformLocationCells.xPositionMeters`・`facilityConnections`（`xRangeStart/xRangeEnd`含む）を受け取り、`<svg viewBox="...">` で描画するコンポーネントに書き換える。viewBoxの範囲（`minX`/`maxX`）は `physicalLength` と全設備・全パターン座標から動的に算出する
- **依存**: TASK-5.1

### TASK-5.3: `PlatformDisplay.tsx` / `PlatformTabs.tsx` 型更新
- **対象ファイル**: `apps/web/src/components/PlatformDisplay.tsx`, `apps/web/src/components/PlatformTabs.tsx`
- **実装内容**: `maxCarCount`・`carStopPositions`（旧型）への参照を削除し、`physicalLength`・新しい `TrainStopPattern` 型・`xPositionMeters`・`xRangeStart/xRangeEnd` を扱う型に更新する
- **依存**: TASK-5.1, TASK-5.2

---

## Phase 6: MVP検証・全体検証・振り返り

### TASK-6.1: ビルド確認
- **コマンド**: `pnpm run build`
- **期待結果**: ビルドエラーなし
- **依存**: Phase 1〜5 全体

### TASK-6.2: MVP検証（1駅1ホーム）
- **対象**: 新宿駅 3・4番線相当（複数の停車位置パターンが存在するホーム）
- **確認項目**（`requirements.md` MVP成功基準 / `design.md` 参照）:
  1. 号車数が同じで停車位置・向きが異なる2列車パターンを矛盾なく登録できる
  2. 1両の前方・後方に別々の設備を区別して登録・表示できる
  3. 車両の停車範囲外（ホーム原点基準で `physicalLength` を超える、または負の位置）に設備を登録・表示できる
  4. ブラウザ幅を変えてもSVG要素間の位置比率が崩れない
- **依存**: TASK-6.1

### TASK-6.3: Admin手動テスト
- **確認項目**:
  - `physicalLength` を指定してホームを新規登録できる
  - 列車の号車構成に `carLength` を指定・未指定の両方で保存できる
  - 停車位置パターンの自動算出プレビューが表示され、個別の号車位置を上書きして保存できる
  - 同一ホーム・同一列車で2件目の停車位置パターンを登録しようとすると一意制約エラーになる
  - 設備のメートル位置入力、対面乗り換え帯の範囲入力が保存・編集できる
- **依存**: Phase 3, Phase 4

### TASK-6.4: Web手動テスト
- **確認項目**:
  - 停車位置パターンが未登録の列車がホーム表示に出てこない
  - コンコース単位グルーピング表示（#29機能）が引き続き正しく動作する
  - 対面乗り換え帯がSVG上に正しい範囲で描画される
- **依存**: Phase 5

### TASK-6.5: docs/spec最終更新
- **対象ファイル**: `docs/spec/requirements.md`, `docs/spec/design.md`, `docs/spec/tasks.md`
- **内容**: 実装を通じて明らかになった変更点（自動算出ロジックの調整、標準車両長の妥当性など）をspecに反映する
- **依存**: TASK-6.1〜TASK-6.4

---

## タスクサマリー

| フェーズ | タスク数 | 優先度 | 推定規模 |
|---------|---------|-------|---------|
| Phase 0: docs/spec更新 | 3 | P0 | S |
| Phase 1: スキーマ変更 | 9 | P0 | M |
| Phase 2: 既存データのリセット | 3 | P0 | S |
| Phase 3: Admin API更新 | 5 | P0 | L |
| Phase 4: Admin UI更新 | 5 | P0 | L |
| Phase 5: Web UI更新 | 3 | P1 | L |
| Phase 6: 検証 | 5 | P0 | M |
| **合計** | **33** | | |

---

## 実装順序の依存関係

```
TASK-1.1〜1.8 (スキーマ) → TASK-1.9 (マイグレーション生成)
                                  │
                    ┌─────────────┼─────────────────┐
                    │             │                 │
              TASK-2.1〜2.3  TASK-3.1 (バリデーション)
              (データリセット)     │
                                  ├── TASK-3.2 (platforms API)
                                  ├── TASK-3.3 (trains API)
                                  ├── TASK-3.4 (platform-locations API)
                                  └── TASK-3.5 (train-stop-patterns API)
                                        │
                                  ┌─────┼─────┬─────────────┐
                                  │     │     │             │
                            TASK-4.1 4.2  4.3         TASK-4.4 (StopPatternForm)
                                                              │
                                                        TASK-4.5 (一覧・編集ページ)

TASK-1.9, TASK-2.2 → TASK-5.1 (webクエリ) → TASK-5.2 (TrainVisualization) → TASK-5.3 (型更新)

Phase 3・4・5 すべて完了 → TASK-6.1〜6.5 (検証)
```

---

## 進捗追跡

| タスクID | 状態 | 完了日 |
|---------|------|-------|
| TASK-0.1 | ✅ 完了 | 2026-08-14 |
| TASK-0.2 | ✅ 完了 | 2026-08-14 |
| TASK-0.3 | ✅ 完了 | 2026-08-14 |
| TASK-1.1〜1.9 | ⬜ 未着手 | - |
| TASK-2.1〜2.3 | ⬜ 未着手 | - |
| TASK-3.1〜3.5 | ⬜ 未着手 | - |
| TASK-4.1〜4.5 | ⬜ 未着手 | - |
| TASK-5.1〜5.3 | ⬜ 未着手 | - |
| TASK-6.1〜6.5 | ⬜ 未着手 | - |
