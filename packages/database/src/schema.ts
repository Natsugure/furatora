import { pgTable, varchar, decimal, integer, timestamp, text, uuid, boolean, primaryKey, unique, serial, date, check } from 'drizzle-orm/pg-core';
import type { StrollerDifficulty, WheelchairDifficulty, DirectionType, PlatformSide, StationConnectionSource } from './enums';
import { sql } from 'drizzle-orm';

// 粒度は「路線×駅」。ekidata の station_cd と 1:1 で対応する。
// 【この粒度は暫定である】ドメインとして正しい粒度ではなく、既存行を UPDATE で
// 移行して platforms / lineDirections からの参照を切らないための選択である。
// 同一事業者・同一駅が複数行に割れる（東京駅=18行、新宿=13行）。
// 確定は実データ投入後の後続Issue。docs/domain/station-master-model.md 参照
export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  // 【一意制約を付けないこと】ODPT との同期は ADR-0007 決定3 で停止しており、
  // この列は移行済み481行の来歴を残すためだけに存在する。ekidata 由来の新規行では
  // NULL であり、突合の手がかりとしても使われない。値の重複を防ぐ主体がもう居ないため、
  // 一意制約は「欠落」ではなく意図的な不在である
  odptStationId: varchar('odpt_station_id', { length: 100 }), // ODPT API の owl:sameAs (例: odpt.Station:TokyoMetro.Marunouchi.Shinjuku)
  slug: varchar('slug', { length: 100 }).unique(), // URL用スラッグ (例: tokyo-metro-marunouchi-shinjuku)
  code: varchar('code', { length: 20 }), // 駅ナンバリング (例: M08)
  name: varchar('name', { length: 100 }).notNull(),
  nameKana: varchar('name_kana', { length: 100 }),
  nameEn: varchar('name_en', { length: 100 }),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lon: decimal('lon', { precision: 9, scale: 6 }),
  operatorId: uuid('operator_id').references(() => operators.id).notNull(),
  // ekidata station_cd。未突合の行が残るため nullable のまま（requirements.md C-3）
  ekidataStationCd: integer('ekidata_station_cd').unique(),
  stationGroupId: uuid('station_group_id').references(() => stationGroups.id),
  prefCode: integer('pref_code'),
  abolishedAt: date('abolished_at'),
  // 【可視性はこの列が単独で担う】null = 非公開。ekidata 由来の新規駅は null で作られ、
  // 管理者が明示的に設定するまで一覧・検索・詳細ページ・公開APIに出ない。
  // operators.displayPriority は表示順専用であり可視性の意味を持たない
  publishedAt: timestamp('published_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
    unique('uniqueStationPerOperator').on(t.odptStationId, t.operatorId),
    // 公開されている駅は必ず slug を持つ。URL を持てない駅が公開状態になるのを防ぐ
    check('published_requires_slug', sql`published_at IS NULL OR slug IS NOT NULL`),
]);

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  // 【一意制約を付けないこと】理由は stations.odptStationId と同じ（ADR-0007 決定3）
  odptRailwayId: varchar('odpt_railway_id', { length: 100 }), // ODPT API の owl:sameAs (例: odpt.Railway:TokyoMetro.Marunouchi)
  slug: varchar('slug', { length: 100 }).unique(),
  lineCode: varchar('line_code', { length: 10 }), // 路線コード (例: M)
  name: varchar('name', { length: 100 }).notNull(),
  nameKana: varchar('name_kana', { length: 100 }),
  nameEn: varchar('name_en', { length: 100 }),
  color: varchar('color', { length: 7 }), // カラーコード (例: #F62E36)
  displayOrder: integer('display_order').default(0), // 表示順
  operatorId: uuid('operator_id').references(() => operators.id).notNull(),
  // ekidata line_cd。未突合の行が残るため nullable のまま（requirements.md C-3）
  ekidataLineCd: integer('ekidata_line_cd').unique(),
  abolishedAt: date('abolished_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('uniqueRailwayPerOperator').on(t.odptRailwayId, t.operatorId),
]);

// 【unique(stationId) を付けないこと】実測で複数路線を持つ駅は0件だが、これは
// ekidata が路線ごとに駅を割っている（stations が路線×駅粒度である）結果であって、
// furatora のドメインの不変条件ではない。粒度は暫定であり確定していない
// （stations の冒頭コメント参照）。
// コストはマイグレーションではなく「1駅は1路線」を仮定したクエリと表示ロジックが
// 増えることであり、そうなると粒度の変更が制約の削除では済まなくなる
export const stationLines = pgTable('station_lines', {
  stationId: uuid('station_id').references(() => stations.id).notNull(),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  stationOrder: integer('station_order'), // 路線内での駅の順序 (ODPT の odpt:index)
}, (t) => [
    primaryKey({ columns: [t.stationId, t.lineId] }),
]);

export const stationConnections = pgTable('station_connections', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationId: uuid('station_id').references(() => stations.id).notNull(),

  // DB上に存在する場合はIDを保存
  connectedStationId: uuid('connected_station_id').references(() => stations.id),
  connectedRailwayId: uuid('connected_railway_id').references(() => lines.id),

  // 常にODPT IDを保存（後からマッチング用）
  odptStationId: varchar('odpt_station_id', { length: 100 }),
  odptRailwayId: varchar('odpt_railway_id', { length: 100 }),

  strollerDifficulty: varchar('stroller_difficulty', { length: 20 }).$type<StrollerDifficulty>(),
  wheelchairDifficulty: varchar('wheelchair_difficulty', { length: 20 }).$type<WheelchairDifficulty>(),

  notesAboutStroller: text('notes_about_stroller'),
  notesAboutWheelchair: text('notes_about_wheelchair'),

  // 由来。'ekidata_group' はインポートが再生成してよい行、'manual' は触れてはならない行
  source: varchar('source', { length: 20 }).$type<StationConnectionSource>(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  // TASK-2.8 のインポートを冪等にする。onConflictDoNothing がこの制約を衝突対象に
  // するため、無いと再実行のたびに重複行が積み上がる。
  // 【NULL 行は守られない】PostgreSQL の UNIQUE は既定で NULL どうしを異なる値として
  // 扱うため、connectedStationId IS NULL の行（ODPT 未突合）は重複を防げない。
  // nullsNotDistinct を付けないのは意図的である。TASK-2.8 が生成するのは同一
  // station_g_cd の実在駅どうしの順序対で常に非 NULL であり、NULL 行は TASK-4.2 の
  // notNull 化で消えるためである
  unique('unique_station_connection').on(t.stationId, t.connectedStationId),
]);

export const trains = pgTable('trains', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull(),
  operators: uuid('operators').references(() => operators.id).notNull(),
  lines: uuid('lines').references(() => lines.id).array().notNull(),
  carCount: integer('car_count').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export type CarStructure = {
  carNumber: number;
  doorCount: number;
};

export const trainCarStructures = pgTable('train_car_structures', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
  carNumber: integer('car_number').notNull(),
  doorCount: integer('door_count').notNull(),
  carLength: decimal('car_length', { precision: 5, scale: 2 }), // メートル、未指定=標準値(20.0m)
}, (t) => [
  unique('unique_train_car_structure').on(t.trainId, t.carNumber),
]);

export type FreeSpace = {
  carNumber: number;
  nearDoor: number;
  isStandard: boolean; // 全編成に装備されているか
}

export type PrioritySeat = {
  carNumber: number;
  nearDoor: number;
  isStandard: boolean; // 全編成に装備されているか
}

export type TrainEquipmentType = 'free_space' | 'priority_seat';

export const trainEquipments = pgTable('train_equipments', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 20 }).notNull().$type<TrainEquipmentType>(),
  carNumber: integer('car_number').notNull(),
  nearDoor: integer('near_door').notNull(),
  isStandard: boolean('is_standard').notNull().default(true),
}, (t) => [
  unique('unique_train_equipment').on(t.trainId, t.type, t.carNumber, t.nearDoor),
]);

export const lineDirections = pgTable('line_directions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  directionType: varchar('direction_type', { length: 20 }).notNull().$type<DirectionType>(),
  representativeStationId: uuid('representative_station_id').references(() => stations.id).notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(), // "渋谷方面"
  displayNameEn: varchar('display_name_en', { length: 100 }), // "For Shibuya"
  terminalStationIds: uuid('terminal_station_ids').array(), // 終着駅候補（複数対応）
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const platforms = pgTable('platforms', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationId: uuid('station_id').references(() => stations.id).notNull(),
  platformNumber: varchar('platform_number', { length: 10 }).notNull(),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  inboundDirectionId: uuid('inbound_direction_id').references(() => lineDirections.id),
  outboundDirectionId: uuid('outbound_direction_id').references(() => lineDirections.id),
  // メートル。既存行があるため default('0') 付きで追加する（'0' = 未入力の暫定値）。
  // default を外す作業は後続Issue。docs/domain/platform-coordinate-system.md 参照
  physicalLength: decimal('physical_length', { precision: 6, scale: 2 }).notNull().default('0'),
  platformSide: varchar('platform_side', { length: 10 }).$type<PlatformSide>(), // ホームが列車の上下どちらか
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// ホーム・列車の組み合わせごとの停車位置パターン。
// 一意キーは (platformId, trainId) で、方面別の区別は持たない。
// 上下共用の中線を持つ事業者を追加する場合の移行手順は
// docs/domain/train-stop-patterns.md「現在の制約」参照
export const trainStopPatterns = pgTable('train_stop_patterns', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformId: uuid('platform_id').references(() => platforms.id, { onDelete: 'cascade' }).notNull(),
  trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('unique_train_stop_pattern').on(t.platformId, t.trainId),
]);

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

export const platformLocations = pgTable('platform_locations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformId: uuid('platform_id').references(() => platforms.id).notNull(),
  exits: text('exits'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// アクセス点（ホーム座標系のメートル位置）を表す中間テーブル
export const platformLocationCells = pgTable('platform_location_cells', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformLocationId: uuid('platform_location_id')
    .references(() => platformLocations.id, { onDelete: 'cascade' })
    .notNull(),
  xPositionMeters: decimal('x_position_meters', { precision: 6, scale: 2 }), // null = コンコース全体
});

export const stationFacilities = pgTable('station_facilities', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformLocationCellId: uuid('platform_location_cell_id').references(() => platformLocationCells.id, { onDelete: 'cascade' }).notNull(),
  typeCode: varchar('type_code').references(() => facilityTypes.code).notNull(),
  isWheelchairAccessible: boolean('is_wheelchair_accessible').default(true),
  isStrollerAccessible: boolean('is_stroller_accessible').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// 場所↔乗換駅 多対多の中間テーブル
export const facilityConnections = pgTable('facility_connections', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformLocationId: uuid('platform_location_id').references(() => platformLocations.id, { onDelete: 'cascade' }).notNull(),
  connectedStationId: uuid('connected_station_id').references(() => stations.id).notNull(),
  connectedPlatformId: uuid('connected_platform_id').references(() => platforms.id), // nullable
  directionId: uuid('direction_id').references(() => lineDirections.id), // nullable
  exitLabel: text('exit_label'), // 出口ラベル (例: "A3出口", "改札外")
  // 対面乗り換え帯（connectedPlatformId が設定されている行のみ使用）。自ホーム座標系での範囲
  xRangeStart: decimal('x_range_start', { precision: 6, scale: 2 }), // nullable
  xRangeEnd: decimal('x_range_end', { precision: 6, scale: 2 }),     // nullable
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('unique_facility_connection').on(t.platformLocationId, t.connectedStationId),
]);

export const facilityTypes = pgTable('facility_types', {
  code: varchar('code', { length: 20 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
});

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull().unique('operators_name_unique'),
  // 【一意制約を付けないこと】理由は stations.odptStationId と同じ（ADR-0007 決定3）
  odptOperatorId: varchar('odpt_operator_id', { length: 100 }), // ODPT API の odpt:operator (例: odpt.Operator:TokyoMetro)
  // TODO(TASK-3.8): NOT NULL DEFAULT 0 にして表示順専用に純化する。
  // それまでは「null=非表示」の旧仕様が残る。TASK-3.7 のバックフィルが
  // 「移行前に非表示だった事業者」をこの null で判別するため、先に埋めてはならない
  displayPriority: integer('display_priority'), // 数字=表示順、null=非表示
  ekidataCompanyCd: integer('ekidata_company_cd').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 乗換単位の「駅」。ekidata station_g_cd に対応する。
// stations（路線×駅）が複数行に割れても、乗り換えはこの単位でまとまる
export const stationGroups = pgTable('station_groups', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  ekidataStationGroupCd: integer('ekidata_station_group_cd').notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  nameKana: varchar('name_kana', { length: 100 }),
  prefCode: integer('pref_code'),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lon: decimal('lon', { precision: 9, scale: 6 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// 路線内の隣接駅。ekidata join に対応する。
// 【1辺につき1行しか持たない】無向グラフだが両方向の2行は作らない。
// 2行に増やすと片方だけが更新される状態を作れてしまうためである。
// unique_station_adjacency は (lineId, stationAId, stationBId) の順序に依存するので、
// 書き込み側（features/master-import）は端点 UUID を昇順へ正規化してから INSERT する。
// これにより供給元が辺を逆向きに配布し直しても重複行にならない。
// 隣接を引く側は (stationAId = X OR stationBId = X) の両方を見ること
export const stationAdjacencies = pgTable('station_adjacencies', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  stationAId: uuid('station_a_id').references(() => stations.id).notNull(),
  stationBId: uuid('station_b_id').references(() => stations.id).notNull(),
}, (t) => [
  unique('unique_station_adjacency').on(t.lineId, t.stationAId, t.stationBId),
]);

export const odptMetadata = pgTable('odpt_metadata', {
  id: serial('id').primaryKey(),
  operator: varchar('operator', { length: 50 }).notNull().unique(),
  railwayHash: varchar('railway_hash', { length: 64 }),
  stationHash: varchar('station_hash', { length: 64 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});