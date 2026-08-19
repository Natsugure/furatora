# 技術設計: ホーム設備・車両停車位置のメートル座標化 (Issue #29 拡張)

## 概要

- **対象**: `packages/database`, `packages/eslint-config`(新規), `apps/admin`, `apps/web`, `apps/scripts`
- **参照**: [`requirements.md`](./requirements.md) / [ADR一覧](../adr/README.md)
- **作成日**: 2026-08-14
- **最終更新**: 2026-08-15（ADR-0001〜0005 の決定を反映 / レビュー指摘 1〜4 を反映）

本設計は以下のADRの決定に従う。**判断の根拠は各ADRを参照すること**（本書には重複させない）。

| ADR | 決定 | 本設計への影響 |
|---|---|---|
| [0001](../adr/0001-layer-structure.md) | 4層構成（app / features / shared / external）と依存ルール | ディレクトリ構成・ESLint |
| [0002](../adr/0002-dependency-inversion-ports.md) | ports による依存性逆転 | `features/*/ports.ts`・`di.ts` |
| [0003](../adr/0003-read-write-separation.md) | 読み = Query Service / 書き = Repository、DTO制約 | 型定義・interface |
| [0004](../adr/0004-neon-branch-dev-environment.md) | 開発環境を Neon ブランチへ統一 | 移行方針・Docker廃止 |
| [0005](../adr/0005-write-atomicity-driver.md) | 読み=`neon-http` / 書き=`neon-serverless` | 親子insertの原子性 |

---

## 適応的実行戦略（信頼度72%・中信頼度）

`requirements.md` の信頼度評価により、PoC/MVPを優先する。

**MVP範囲**: 1駅・1ホーム（新宿駅 3・4番線相当の複数パターンが存在するケースを選定）に対して、スキーマ変更 → Admin登録（停車位置パターン・設備） → Web表示（SVG viewBox描画）を通しで実装・検証する。

**MVP成功基準**:
1. 号車数が同じで停車位置・向きが異なる2つの列車パターンを、同一ホームに矛盾なく登録できる
2. 1両の前方・後方に別々の設備（例: 階段A・階段B）を区別して登録・表示できる
3. ホーム端（`x=0`）からの相対位置として、車両の停車範囲外（頭端式相当）に設備を登録・表示できる
4. SVGのviewBoxにより、ブラウザの表示幅を変えても要素間の位置比率が崩れない
5. 停車位置パターンを追加・削除しても、既存の設備・他パターンの描画位置が変化しない

MVP検証後、他のAdmin画面（`TrainForm`等）・全駅データへの展開に進む。

---

## アーキテクチャ構成

### レイヤーと依存ルール（[ADR-0001](../adr/0001-layer-structure.md)）

```
        app/  ──────►  features/  ──────►  shared/
      (routing)      (ドメイン + UI)        (汎用)
                          ▲
                          │ implements（依存が逆転する）
                          │
                     external/  ──►  @furatora/database / 外部API
```

| 場所 | `next/*` | `drizzle-orm` / `@furatora/database` |
|---|---|---|
| `app/` | ✅ | ❌ |
| `features/*/domain/`, `ports.ts`, `usecases/` | ❌ | ❌ |
| `features/*/components/` | ✅ | ❌ |
| `shared/` | ✅ | ❌ |
| `external/` | ❌ | ✅ |

- `shared/` は `features/` を import しない
- `app/` にビジネスロジックを書かない（クエリ呼び出しとJSXの合成のみ）
- feature間依存は `platform` を最下層とし、`station` → `platform`／`stop-pattern` → `platform` のみ許可
- `@furatora/database/enums` は当面例外として全層で許可（[ADR-0001](../adr/0001-layer-structure.md)）

**ESLint による強制**は `packages/eslint-config`（新規）に置き、各アプリに薄い
`eslint.config.mjs` を配置する。flat config の `files` グロブは設定ファイルの位置を
基準に解決されるため、ルート1箇所では適用されない（詳細と検証手順はADR-0001）。

### 抽象の使い分け（[ADR-0003](../adr/0003-read-write-separation.md) / [ADR-0005](../adr/0005-write-atomicity-driver.md)）

```
              読み取り                    書き込み
          ┌────────────────────┬──────────────────────────┐
  抽象    │ Query Service       │ Repository               │
  戻り値  │ DTO（画面単位）      │ ドメインエンティティ       │
  DB      │ db（neon-http）      │ withTransaction（ws Pool）│
          └────────────────────┴──────────────────────────┘
```

判断基準: **そのメソッドがDBの状態を変えるなら Repository、変えないなら Query Service。**

### 変更対象（#29の適用範囲）

Issue #29 では `platform` / `station` / `stop-pattern` の3feature に限定する。

```
packages/database/
  ├── src/schema.ts              ← スキーマ変更（主要）
  ├── src/client.ts              ← USE_LOCAL_DB分岐を削除（ADR-0004）
  └── src/tx.ts                  ← 新規: withTransaction（ADR-0005）

packages/eslint-config/          ← 新規: 4層の依存ルール（ADR-0001）

apps/web/
  ├── src/app/stations/[slug]/page.tsx      ← 485行 → 約70行（合成とJSXのみ）
  ├── src/di.ts                             ← 新規: コンポジションルート
  ├── src/features/platform/
  │   ├── domain/types.ts                   ← PlatformDTO 等
  │   ├── domain/geometry.ts                ← 新規: computeBounds()（純関数）
  │   ├── ports.ts                          ← PlatformQuery
  │   └── components/
  │       ├── TrainVisualization.tsx        ← SVG viewBox方式に全面書き換え
  │       ├── PlatformDisplay.tsx           ← DTO受け取りに変更
  │       └── PlatformTabs.tsx              ← Drizzle型importを排除
  ├── src/features/station/
  │   ├── domain/types.ts / ports.ts
  │   └── usecases/getStationDetail.ts
  └── src/external/query/
      └── stationDetailQuery.ts             ← 既存 fetchStationDetails() の移設先

apps/admin/
  ├── src/di.ts                             ← 新規
  ├── src/features/platform/
  │   ├── schema.ts                         ← 旧 lib/validations.ts から分割
  │   ├── ports.ts
  │   └── components/PlatformForm.tsx       ← physicalLength入力に変更
  ├── src/features/stop-pattern/            ← 新規feature
  │   ├── domain/{carSegments.ts,types.ts}  ← buildCarSegments()（純関数）+ DTO
  │   ├── schema.ts / ports.ts
  │   └── components/TrainStopPatternForm.tsx
  ├── src/features/train/components/TrainForm.tsx      ← limitedToPlatformIds削除、carLength追加
  ├── src/features/facility/components/FacilityForm.tsx ← 枠番号→メートル入力に変更
  ├── src/external/repository/
  │   ├── stopPatternRepository.ts          ← 親子insert（withTransaction必須）+ update
  │   └── platformRepository.ts
  ├── src/external/query/
  │   └── stopPatternPageQuery.ts           ← 新規（Phase 4実施結果。一覧・編集ページ用）
  └── src/app/
      ├── stations/[stationId]/platforms/[platformId]/stop-patterns/
      │   ├── page.tsx                      ← 新規（一覧）
      │   ├── new/page.tsx                  ← 新規
      │   └── [patternId]/edit/page.tsx     ← 新規
      └── api/stations/[stationId]/
          ├── platform-locations/...        ← 薄くする + 原子化（ADR-0005）
          └── train-stop-patterns/...       ← 新規（[patternId]/route.ts に PUT を追加）

apps/scripts/
  ├── package.json                          ← tsx に --env-file-if-exists を付与（ADR-0004）
  ├── src/migrate-platform-locations.ts     ← 削除（リセット方針のため不要）
  └── src/update-odpt.ts                    ← db.transaction() → withTransaction()（ADR-0005）

docker/                                     ← 削除（ADR-0004）
docker-compose.yml                          ← 削除（ADR-0004）
```

#### カラム削除への追随のみ行う範囲（層移行はしない）

上記とは別に、**削除するカラムを参照しているため #29 で必ず修正が要る**ファイルがある。
これらは `features/` へ移さず、現在の位置のまま型・クエリだけを追随させる。

| ファイル | 参照している削除対象 |
|---|---|
| `apps/admin/src/app/stations/[stationId]/platforms/[platformId]/edit/page.tsx` | `platformCarStopPositions`, `maxCarCount` |
| `apps/admin/src/app/stations/[stationId]/facilities/page.tsx` | `maxCarCount`, `nearPlatformCell`（`orderBy` と表示） |
| `apps/admin/src/app/stations/[stationId]/facilities/[locationId]/edit/page.tsx` | `nearPlatformCell` |
| `apps/admin/src/app/trains/[trainId]/edit/page.tsx` | `limitedToPlatformIds` |
| `apps/admin/src/lib/validations.test.ts` | `maxCarCount` のフィクスチャ |

加えて、`PlatformForm` / `TrainForm` / `FacilityForm` を `features/*/components/` へ
移動するため、これらを import している**6ページ**の import パス更新が発生する
（上記4ページ + `platforms/new` / `facilities/new` / `trains/new`）。

`search` / `line` / `transfer` および admin の一覧・編集ページの**層移行**は後続Issueとする。
**層移行の先送りとカラム削除への追随は別物であり、後者は #29 の必須範囲である。**
移行完了までは ESLint の除外設定を各アプリ側に置き、段階的に削る。

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
  └── physicalLength: decimal notNull default '0'  ← 新規（メートル、管理者手入力。'0'=未入力）

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
  // メートル。既存行があるため default('0') 付きで追加する（'0' = 未入力の暫定値）。
  // default を外す作業は後続Issue。詳細は「移行方針」参照
  physicalLength: decimal('physical_length', { precision: 6, scale: 2 }).notNull().default('0'),
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

1. **`x=0` はホームの物理的な一端とする。** ホームの実体は `[0, physicalLength]` の区間である
2. **原点は列車のデータから導出しない。** どの停車位置パターンが登録・削除されても原点は動かない
3. 停車位置パターンは、ホーム端からのオフセットとして各号車の `startMeters` / `endMeters` を持つ。
   パターン同士は互いに独立しており、他のパターンの登録・削除に影響されない
4. `[0, physicalLength]` の外（頭端式ホームの外側、負座標を含む）にも設備・アクセス点・
   停車位置を配置できる
5. SVGのviewBoxは `physicalLength` と全設備・全停車位置パターンの座標の最小値・最大値から
   マージンを加えて動的に算出する（デモ実装の `computeBounds` と同等のロジック）

### どちらの端を `x=0` にするか

**規約で固定しない。** ホームごとに管理者が一方の端を選び、以後変えない。

現行実装にも「枠番号1がホームのどちら側か」を決めるデータは存在せず
（`TrainVisualization.tsx:690` の枠番号昇順がそのまま左→右になるだけで、
`platformCarStopPositions.direction` は列車の向きしか決めていない）、
方面（`inbound` / `outbound`）もヘッダーに文字列連結して出すのみで
ホームの左右端に紐付いていない（`PlatformDisplay.tsx:83-88`）。
本ルールはこの現状を形式化したものであり、表示上の情報は失われない。

- Web側は **x昇順で左→右**に描画する
- **ホーム端に方面ラベルを出さない**（現状も出していない）

将来「← 渋谷方面」を端に表示したくなった場合は、`platforms` に
「`x=0` 側がどの方面か」を持つカラムを1つ足せばよい。
**原点が動かないため、後から追加しても既存座標は一切壊れない**（これが本方式の主要な利点）。

### `direction`（ascending / descending）は廃止する

旧 `platformCarStopPositions.direction` に相当する概念は持たない。
列車の向きは**号車座標そのものが表現する**（1号車が x の小さい側にあるか大きい側にあるか）。

ドア番号の反転表示（`TrainVisualization.tsx:77`, `:152` の `reversed`）は、
`cars` を `carNumber` 昇順に並べたときの `startMeters` が減少していれば反転、として導出する。

### 方面別の停車位置パターンは持たない（当面）

`trainStopPatterns` の一意キーは `(platformId, trainId)` であり、
**同一ホーム・同一列車に対して停車位置パターンは1件しか持てない。**

この制約は、対象事業者に上下共用のホームが存在しないことに依存している。
2026-08-15 時点で `inbound_direction_id` と `outbound_direction_id` の両方が
設定された `platforms` レコードは0件（開発者確認済み）。

折返しホーム（終端駅・支線）は両方向を持ちうるが、
**編成が物理的に反転しないため停車位置は1通り**であり、1件で正しく表現できる。

破綻するのは**上下共用の中線**（JRの国鉄型2面3線等）である。
同一ホーム・同一列車が逆向きで停車するため号車座標が2通り必要になるが、
一意制約により1件しか登録できない。結果として片方の方面で号車番号が左右反転し、
「2号車付近のエレベーター」が実際には7号車付近を指す誤案内になる。

**回避策として `platforms` を番線ごとに分けることはできない。**
設備は `platformId` にぶら下がるため（`platformLocations` → `platformLocationCells`
→ `stationFacilities` / `facilityConnections`）、同一の物理ホームを2レコードに分けると
設備・コンコースが二重登録になり、#29 の中核であるコンコース単位グルーピングが
同じ階段を別物として扱い始める。

本Issueで対応しない理由は、JR追加時点で必要なキーが本当に「方面」なのかが
未確定なためである（中線は方面ではなく運用（待避・折返し）で停車位置が分かれる可能性があり、
また号車数が10両/15両で大きく変わるため `trains` の粒度自体の見直しが入りうる）。
実データが1件も無い状態で解決ロジックを設計すると作り直しになる
（[ADR-0002](../adr/0002-dependency-inversion-ports.md) の「推測で設計しない」と同じ判断）。

制約の詳細と、対応が必要になったときの移行手順は
[`docs/domain/train-stop-patterns.md`](../domain/train-stop-patterns.md) に記載する。

### 号車位置の自動算出ロジック（`trainStopPatternCars` 生成時）

1. 管理者が対象の `platformId` ・ `trainId` を選択
2. **編成の `x=0` に近い側の端が、ホーム端（`x=0`）から何メートルの位置に来るか**を入力する
3. **`x=0` に近い側が1号車か最終号車か**を選択する
4. `trainCarStructures.carLength`（未指定時は標準値 20.0m）を、`x=0` に近い側から順に積算し、
   各号車の `startMeters` / `endMeters` を算出する
5. 算出結果をプレビュー表示し、管理者が個別の号車境界を上書き可能な状態で保存

**基準を「先頭車」ではなく「`x=0` に近い側の端」とする。** 「先頭車」を基準にすると、
その先頭が x の小さい側にあるのか大きい側にあるのかが別途必要になり、
入力が2つの独立した二択に分かれて曖昧になる。上記の形なら
「位置1つ + 号車番号の向き1つ」で一意に定まる。

手順2は**駅の平面図や実測から直接読み取れる量**である。
旧設計の「1号車先端を x=0 に揃える」は、登録する列車が最長編成でない限り
ルール1に違反し、複数パターンが同一座標に重なる原因になるため採用しない。

---

## データフロー

### Admin側（停車位置パターン登録）

**号車位置の算出はクライアント側で行い、APIは保存に徹する。**
管理者がプレビューを見ながら個別の号車位置を上書きできる必要があるため、
算出結果ではなく**確定した座標**を送る。

```
[管理者ブラウザ] features/stop-pattern/components/TrainStopPatternForm.tsx
     │
     ├── trainCarStructures から各号車の carLength を取得（未指定は標準値20.0m）
     ├── domain/carSegments.ts の
     │     buildCarSegments(carStructure, startMeters, carNumberOrder) で算出
     │     （startMeters = ホーム端から、編成の x=0 側の端までの距離）
     ├── プレビュー表示 → 管理者が個別の startMeters/endMeters を上書き可能
     │
     │ payload: { platformId, trainId, cars: [{ carNumber, startMeters, endMeters }] }
     ▼
[POST /api/stations/:stationId/train-stop-patterns]  ← 薄いハンドラ
     │ features/stop-pattern/schema.ts の Zod で検証
     ▼
[external/repository/stopPatternRepository.ts] save()
     │ withTransaction（ADR-0005。親の採番IDを子に渡すため必須）
     ├── INSERT INTO train_stop_patterns (platformId, trainId) RETURNING id
     └── INSERT INTO train_stop_pattern_cars (trainStopPatternId, carNumber, startMeters, endMeters) × 号車数
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
[app/stations/[slug]/page.tsx]  (Server Component・約70行)
     │ import { getStationDetail } from '@/di'
     ▼
[features/station/usecases/getStationDetail.ts]
     │ StationDetailQuery（port）のみに依存
     ▼
[external/query/stationDetailQuery.ts]   ← ここだけが Drizzle を知る
     ├── SELECT physicalLength FROM platforms
     ├── SELECT * FROM train_stop_patterns JOIN train_stop_pattern_cars
     │     WHERE platformId IN (...)
     ├── SELECT * FROM platform_location_cells (xPositionMeters) ...
     └── SELECT facilityConnections（xRangeStart/xRangeEnd含む）...
     │ JOIN・Promise.all は自由。decimal → number 変換もここで行う
     ▼
[DTO] PlatformDTO { physicalLength, stopPatterns[], concourses[] }
     ▼
[features/platform/components/TrainVisualization.tsx]
     │ features/platform/domain/geometry.ts の computeBounds() で viewBox 算出
     ▼
[ユーザー]
```

クエリ本数は現状（10本）から増やさない。層を分けることが目的であり、
集約単位に分解して N+1 を作らないこと（[ADR-0003](../adr/0003-read-write-separation.md)）。

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

### Web表示用DTO定義

配置先は `apps/web/src/features/platform/domain/types.ts`。
**`ViewModel` ではなく `DTO` と呼ぶ**（[ADR-0003](../adr/0003-read-write-separation.md)）。

DTOの制約（[ADR-0003](../adr/0003-read-write-separation.md)）:

- ✅ プリミティブ・配列・プレーンオブジェクトのみ。JSONシリアライズ可能であること
- ❌ 色コード・Tailwindクラス名・JSX・Mantineのprops等、UI固有の値を含めない
- ❌ メソッドを持つクラスインスタンスにしない

`decimal` は Drizzle が `string` で返すため、**`external/query/` の中で `number` へ変換する**。
DTOより上の層に `string` のまま渡さない（SVG描画側に `Number()` が散らばるため）。

```typescript
export type PlatformDTO = {
  id: string;
  physicalLength: number;        // decimal → number 変換済み
  stopPatterns: TrainStopPatternDTO[];
  concourses: ConcourseDTO[];
};

export type TrainStopPatternDTO = {
  trainId: string;
  trainLabel: string;
  cars: { carNumber: number; startMeters: number; endMeters: number }[];
};

export type ConcourseDTO = {
  id: string;
  exits: string | null;
  cells: { xPositionMeters: number | null; facilities: FacilityDTO[] }[];
  connections: FacilityConnectionDTO[];
};

export type FacilityConnectionDTO = {
  stationName: string;
  lineNames: string[];
  directionName: string | null;
  exitLabel: string | null;
  xRangeStart: number | null;
  xRangeEnd: number | null;
};
```

先例として `apps/web/src/types/index.ts` の `StationSearchApiResponse` 等が
既に Drizzle 非依存のDTOとして `/api/v1/*` のレスポンス契約になっている。
新規DTOは配置先が異なるだけで**性質は同じもの**とする。

### ports 定義

`features/*/ports.ts` に置く。Drizzle も Next.js も import しない
（[ADR-0002](../adr/0002-dependency-inversion-ports.md)）。

```typescript
// apps/web/src/features/station/ports.ts
export interface StationDetailQuery {
  getBySlug(slug: string): Promise<StationDetailDTO | null>;
}
```

```typescript
// apps/admin/src/features/stop-pattern/ports.ts
export interface StopPatternRepository {
  save(pattern: StopPatternInput): Promise<void>;
  update(id: string, pattern: StopPatternInput): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

// 読み取り（一覧・編集ページ用）。stop-pattern の新規ページは src/app/** に置かれ、
// ESLint の依存ルールにより @furatora/database を直接 import できないため必要になる
export interface StopPatternPageQuery {
  getListByPlatform(stationId: string, platformId: string): Promise<StopPatternListDTO | null>;
  getEditContext(stationId: string, platformId: string, patternId?: string): Promise<StopPatternEditContextDTO | null>;
}
```

> **Phase 4 実施結果（2026-08-20）**: `update()` と `StopPatternPageQuery` は当初の定義に
> 無かったが、TASK-4.5（一覧・編集ページ）の実装過程で追加した（開発者承認済み）。
> `update()` は「編集」導線に必要で、`save`/`update` はいずれも一意制約違反
> （`platformId`, `trainId`）を `DuplicateStopPatternError` として throw し、
> route.ts 側で409に変換する。`StopPatternPageQuery` は
> [ADR-0003](../adr/0003-read-write-separation.md) が admin の一覧・編集ページの
> Query Service 化を後続Issue（#48）としている対象範囲を超える追加だが、
> 本件は既存ページの改修ではなく新規ページの必須要件であるため、この2画面分のみ
> 本Issueで先行導入した（開発者承認済み）。

**port は実在する画面・ユースケースに対してのみ定義する。**
乗換案内など未実装機能のための port を先回りして作らないこと（ADR-0002）。

### 書き込みの原子性（[ADR-0005](../adr/0005-write-atomicity-driver.md)）

`trainStopPatterns` の `id` はDB側で採番されるため、
**親を insert → 返却された id で子を insert** という順序が必須になる。
この形は `db.batch()` では表現できず、既定の `neon-http` は
`db.transaction()` が実行時例外になる。

したがって `StopPatternRepository.save()` は `withTransaction` を使う。

```typescript
// apps/admin/src/external/repository/stopPatternRepository.ts
import { withTransaction } from '@furatora/database/tx';

export const dbStopPatternRepository: StopPatternRepository = {
  async save(pattern) {
    await withTransaction(async (tx) => {
      const [row] = await tx.insert(trainStopPatterns)
        .values({ platformId: pattern.platformId, trainId: pattern.trainId })
        .returning();
      await tx.insert(trainStopPatternCars).values(
        pattern.cars.map((c) => ({ trainStopPatternId: row!.id, ...c })),
      );
    });
  },
};
```

`platform-locations` 系の既存ルート（3テーブルの delete → insert が非原子）も
#29 で同じ箇所を触るため、あわせて `withTransaction` 化する。

単一テーブルの単純な書き込みは `db` のままでよい。

---

## Admin UI変更

### 新規: 停車位置パターン編集（`TrainStopPatternForm.tsx`）

```
ホーム: 3番線（ホーム長: 210.00 m）   ← 固定表示（URLのplatformIdで確定するため）
列車:   [ドロップダウン]

編成の端の位置: [数値入力] m   ← x=0 に近い側の端の、ホーム端(x=0)からの距離
号車番号の向き:
  ( ) x=0 に近い側が 1号車     （号車番号が増えるほど x が大きくなる）
  ( ) x=0 に近い側が 最終号車   （号車番号が増えるほど x が小さくなる）

[自動計算して プレビュー表示]

号車ごとの位置（上書き可）:
  1号車: [start] 〜 [end] m
  2号車: [start] 〜 [end] m
  ...
```

ホーム長を併記するのは、入力値が `[0, physicalLength]` に対してどこに来るかを
管理者が確認できるようにするため。範囲外の入力自体は許容する（ルール4）。

> **Phase 4 実施結果（2026-08-20）**: ホームの選択は当初「ドロップダウン」としていたが、
> このフォームは `platforms/[platformId]/stop-patterns/...` 配下のページにのみ置かれ、
> ホームは常にURLの `platformId` で一意に決まるため、固定表示（読み取り専用テキスト）に
> 変更した（開発者承認済み）。それ以外の要素はモック通り実装した。

### `FacilityForm.tsx`（#29から座標入力欄のみ変更）

枠番号の数値入力を「**ホーム端（x=0）からのメートル位置**」入力に置き換える。コンコース＋アクセス点のUI構造自体は維持する。対面乗り換え接続には帯の範囲（開始・終了メートル）入力欄を追加する。

入力欄の `description` には、原点が停車位置ではなくホーム端であることが分かる文言を置く
（例:「ホーム端からの距離。ホーム長: 210.00 m。範囲外（負値・ホーム長超）も入力可」）。
**「原点」という語を単独で使わない。** 旧設計では原点が列車データからの導出値だったため、
管理者がどこを基準に測ればよいか分からなくなる問題があった。

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

### 自動テスト（[ADR-0002](../adr/0002-dependency-inversion-ports.md) の前提条件）

**ADR-0002 は「テスタビリティ」のみを根拠に ports を採用している。**
以下が満たされないまま #29 がマージされた場合、ADR-0002 は
Level 1（マッピング層のみ）へ差し戻される。抽象だけを残す選択はしない。

現状のテスト基盤は以下の通りで、**`apps/web` には実行環境自体が無い**。

| | vitest設定 | `test` script | 既存テスト |
|---|---|---|---|
| `apps/admin` | ✅ | ✅ | 4ファイル |
| `apps/web` | ❌ **無し** | ❌ **無し** | **0** |

必須項目:

1. **`apps/web` にテスト実行環境を構築する**
   （`vitest.config.ts` + `test` script。`apps/admin` の既存設定を踏襲）
2. **port に Fake を注入した usecase テストを最低1つ書く**
   ```ts
   const fake: StationDetailQuery = { getBySlug: async () => fixture };
   const getStationDetail = makeGetStationDetail({ query: fake });
   ```
   Drizzle のチェーンモックを書かないこと（それが Level 2 を却下した理由）
3. **純関数の単体テスト**
   - `features/platform/domain/geometry.ts` の `computeBounds()`
     — 車両範囲外・負座標・`physicalLength` 超過の各ケース
   - `features/stop-pattern/domain/carSegments.ts` の `buildCarSegments()`
     — `carLength` 指定あり／未指定（標準値20.0m）の両方、
       および号車の並び（1号車が先頭／最後尾）の両方
4. **ESLint ルールが発火することの検証**（[ADR-0001](../adr/0001-layer-structure.md)）
   `apps/web/src/app/` 配下に `import { db } from '@furatora/database/client';` を
   含む一時ファイルを置き、`pnpm run lint` がエラーになることを確認して削除する。
   `apps/admin` でも同様。**「違反ゼロで通った」と「ルールが未適用」は
   lint の出力上区別がつかないため、この検証を省略しない。**

### ビルド確認

- `pnpm run build` で型エラー・コンパイルエラーがないこと

### 手動検証

- **MVP検証**: 選定した1駅1ホームで、要件定義のMVP成功基準4項目を確認
- **Admin**:
  - 号車数が同じで向きが異なる2パターンの登録
  - 号車の自動算出結果の上書き
  - 対面乗り換え帯（`xRangeStart`/`xRangeEnd`）の登録
  - **停車位置パターン保存の原子性**: 子の insert が失敗した場合に
    親（`trainStopPatterns`）が残らないこと（[ADR-0005](../adr/0005-write-atomicity-driver.md)）
- **Web**:
  - SVG viewBoxが画面幅に応じて崩れずスケールすること
  - 頭端式ホーム相当のケースで、車両範囲外の設備が正しい位置に描画されること
- **`update-odpt` の疎通確認**（[ADR-0005](../adr/0005-write-atomicity-driver.md)）:
  `USE_LOCAL_DB` 廃止後に、**ローカル実行とGitHub Actions の `workflow_dispatch` の両方**で
  成功を確認する。日次cronのため壊れていても翌日まで気づけず、かつCIは環境変数を直接
  注入するため `.env` の読み込み欠落はCIでは検出できない。どちらも省略しないこと。
- **既存データ**: 開発中データのためリセットする。
  回帰確認の対象は **Admin で再入力し終えたホームに限られる**（`update-odpt` はホーム以下を
  再構築しない。「移行方針」参照）。#29 の検証範囲は MVP対象駅 + 対面乗り換えの確認用に
  赤坂見附相当を1駅追加入力した範囲とし、全駅の目視確認は行わない

---

## 移行方針

### データ

開発中データのため、`platform_locations` 系・`platform_car_stop_positions` のデータはマイグレーション後にリセットする。`apps/scripts/src/migrate-platform-locations.ts` は不要になるため削除する。

適用先は Neon の `development` ブランチになる（[ADR-0004](../adr/0004-neon-branch-dev-environment.md)）。
データを壊した場合は、`docker compose down -v` に相当する操作として
**`main` ブランチから `development` を作り直す**。

#### `update-odpt` が再構築する範囲は駅・路線までである

`apps/scripts/src/update-odpt.ts` が書き込むテーブルは
`stations` / `lines` / `stationLines` / `stationConnections` / `operators` / `odptMetadata` に限られ、
**`platforms` 以下（ホーム・列車・停車位置・設備）は一切作らない。** これらは元々 Admin での手入力データである。

したがってリセット後の復旧は次の2段階になり、2段目は手作業である。

| | 手段 | 対象 |
|---|---|---|
| 1 | `pnpm run update-odpt` | 駅・路線・駅間接続 |
| 2 | **Admin で手入力** | ホーム（`physicalLength` を含む）・停車位置パターン・コンコース・設備・接続 |

さらに REQ-6.1 により、列車の表示判定は「そのホーム・列車の組み合わせに停車位置パターンが
登録されているか」のみになる。**停車位置パターンを入力するまで、Web側ではどのホームにも
列車が1本も表示されない。** これは不具合ではなく仕様だが、リセットの実コストとして
計画に織り込む必要がある。全駅への展開ではなく、MVP対象駅から順に入力する。

#### `platforms.physicalLength` を `notNull` にする手順

`platforms` には既存行があり、`maxCarCount`（号車数）から `physicalLength`（メートル）への
機械的な変換はできない（1両あたりの長さが列車ごとに異なるため）。
`notNull` かつ default 無しのカラムを既存行のあるテーブルへ直接追加することはできないため、
以下の順で適用する。

1. `physicalLength` を **`.notNull().default('0')` として追加**し、`db:push` を適用する
2. Admin で対象ホームの実際の長さを入力する
3. 全ホームの入力が済んだ時点で `default` を外すマイグレーションを当てる（**後続Issue**。
   #29 は MVP対象駅しか入力しないため、この段階では到達しない）

**`0` は「未入力」を意味する暫定値である。** Web側は `physicalLength === 0` のホームを
描画対象から除外する（`computeBounds()` の呼び出し前にガードする）。
Admin のバリデーションは `z.number().positive()` のままとし、`0` を新規入力できないようにする
（既存行の暫定値としてのみ存在を許す）。

### 開発環境（[ADR-0004](../adr/0004-neon-branch-dev-environment.md)）

| 削除 | 理由 |
|---|---|
| `docker/Dockerfile.postgres` / `docker/init.sql` / `docker-compose.yml` | `pg_uuidv7` は Neon が標準サポート（v1.6, PG14〜17） |
| `packages/database` の `postgres` 依存（devDependencies） | ドライバを Neon に統一 |
| `client.ts` の `USE_LOCAL_DB` 分岐 | 実態は「postgres-js を使う」フラグ |
| `.github/workflows/update-odpt.yml` の `USE_LOCAL_DB: 'true'` | 同上 |

`README.md` の `docker compose up -d` の手順を Neon ブランチの接続手順へ差し替える
（日本語・英語の両セクション）。

#### `.env` は3箇所にある

`DATABASE_URL` を持つ `.env` は **ルート / `apps/scripts` / `packages/database` の3箇所**に存在する
（それぞれ `.env.local` も同様）。`development` ブランチへの切り替えでは3ファイルすべてを
更新する。1つでも取り残すと、`db:push` は `development`・`update-odpt` は `main` といった
食い違いが起きる。

#### `client.ts` の `import 'dotenv/config'` の扱い

`USE_LOCAL_DB` 分岐の削除にあわせて `client.ts:1` の `import 'dotenv/config'` も落とすが、
**この import に実際に依存しているのは `apps/scripts` だけである**点に注意する。

| 利用者 | `.env` の読み込み手段 |
|---|---|
| `apps/web` / `apps/admin` | Next.js が自前で読む。dotenv は元から不要 |
| `packages/database/drizzle.config.ts` | **自分で `import 'dotenv/config'` している**。client.ts に依存しない |
| `apps/scripts` | 自前の dotenv 依存を持たず、`@furatora/database/client` の副作用に乗っている |

したがって `apps/scripts` に受け皿が要る。Node の `--env-file` を使い、
`package.json` のスクリプトを次の形にする（`tsx` は Node のフラグをそのまま転送する。
Node v24.18.0 / リポジトリ同梱の `tsx` で動作確認済み・2026-08-15）。

```json
"update-odpt": "tsx --env-file-if-exists=.env src/update-odpt.ts"
```

**`--env-file`（`-if-exists` 無し）を使ってはならない。** `.env` が存在しない場合に
`exit 9` で即座に失敗する。GitHub Actions には `.env` が無く環境変数で直接注入するため、
`--env-file` にすると `update-odpt` がCIで落ちる。
`--env-file-if-exists` はファイルが無ければ警告を出して継続する
（CI の `node-version: 20` は 20.18.0 以降に解決されるため利用可能）。

`packages/database` の `dotenv` は **`devDependencies` へ移す。削除はしない**
（`drizzle.config.ts` が `db:generate` / `db:push` / `db:studio` で使う）。

### `USE_LOCAL_DB` の削除順序（厳守）

**このフラグは現在 load-bearing であり、単独で消すと本番の日次ODPT更新が壊れる。**
[ADR-0005](../adr/0005-write-atomicity-driver.md) のドライバ変更と**同一PRで**、以下の順に行う。

1. `packages/database/src/tx.ts`（`withTransaction`）を追加する
2. `apps/scripts/src/update-odpt.ts:151` の `db.transaction()` を `withTransaction()` に置き換える
3. `.github/workflows/update-odpt.yml` から `USE_LOCAL_DB: 'true'` を削除する
4. `apps/scripts/package.json` の各スクリプトに `--env-file-if-exists=.env` を付ける
   （`client.ts` から dotenv を落とす前に行う）
5. `client.ts` の `USE_LOCAL_DB` 分岐・`postgres` 依存・`import 'dotenv/config'` を削除し、
   `packages/database` の `dotenv` を `devDependencies` へ移す
6. **ローカルで `pnpm run update-odpt` が動くことを確認する**
7. **`workflow_dispatch` を手動実行し、成功を確認する**

手順6を省略しないこと。**CIは環境変数を直接注入するため、`.env` の読み込みが壊れていても
手順7は成功する。** ローカルだけが壊れ、次に誰かが手元でスクリプトを回すまで露見しない。

### アーキテクチャ移行

既存58ファイルを一度に移行しない。#29 の対象3feature（`platform` / `station` /
`stop-pattern`）のみを新構成へ移し、それ以外は ESLint の除外設定で当面許容する。
除外設定は共有パッケージではなく**各アプリの `eslint.config.mjs` に置く**
（アプリごとに異なる速度で減っていくため。[ADR-0001](../adr/0001-layer-structure.md)）。
