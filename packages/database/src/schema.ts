import { pgTable, varchar, decimal, integer, timestamp, text, uuid, boolean, primaryKey, unique, serial } from 'drizzle-orm/pg-core';
import type { StrollerDifficulty, WheelchairDifficulty, DirectionType, PlatformSide } from './enums';
import { sql } from 'drizzle-orm';

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  odptStationId: varchar('odpt_station_id', { length: 100 }), // ODPT API の owl:sameAs (例: odpt.Station:TokyoMetro.Marunouchi.Shinjuku)
  slug: varchar('slug', { length: 100 }).unique(), // URL用スラッグ (例: tokyo-metro-marunouchi-shinjuku)
  code: varchar('code', { length: 20 }), // 駅ナンバリング (例: M08)
  name: varchar('name', { length: 100 }).notNull(),
  nameKana: varchar('name_kana', { length: 100 }),
  nameEn: varchar('name_en', { length: 100 }),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lon: decimal('lon', { precision: 9, scale: 6 }),
  operatorId: uuid('operator_id').references(() => operators.id).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
    unique('uniqueStationPerOperator').on(t.odptStationId, t.operatorId),
]);

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  odptRailwayId: varchar('odpt_railway_id', { length: 100 }), // ODPT API の owl:sameAs (例: odpt.Railway:TokyoMetro.Marunouchi)
  slug: varchar('slug', { length: 100 }).unique(),
  lineCode: varchar('line_code', { length: 10 }), // 路線コード (例: M)
  name: varchar('name', { length: 100 }).notNull(),
  nameKana: varchar('name_kana', { length: 100 }),
  nameEn: varchar('name_en', { length: 100 }),
  color: varchar('color', { length: 7 }), // カラーコード (例: #F62E36)
  displayOrder: integer('display_order').default(0), // 表示順
  operatorId: uuid('operator_id').references(() => operators.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('uniqueRailwayPerOperator').on(t.odptRailwayId, t.operatorId),
]);

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

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

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
  odptOperatorId: varchar('odpt_operator_id', { length: 100 }), // ODPT API の odpt:operator (例: odpt.Operator:TokyoMetro)
  displayPriority: integer('display_priority'), // 数字=表示順、null=非表示
  createdAt: timestamp('created_at').defaultNow(),
});

export const odptMetadata = pgTable('odpt_metadata', {
  id: serial('id').primaryKey(),
  operator: varchar('operator', { length: 50 }).notNull().unique(),
  railwayHash: varchar('railway_hash', { length: 64 }),
  stationHash: varchar('station_hash', { length: 64 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});