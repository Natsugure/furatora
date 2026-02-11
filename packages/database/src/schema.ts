import { pgTable, varchar, decimal, integer, timestamp, text, jsonb, uuid, boolean, primaryKey, unique, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  odptStationId: varchar('odpt_station_id', { length: 100 }), // ODPT API の owl:sameAs (例: odpt.Station:TokyoMetro.Marunouchi.Shinjuku)
  slug: varchar('slug', { length: 100 }).unique(), // URL用スラッグ (例: tokyo-metro-marunouchi-shinjuku)
  code: varchar('code', { length: 20 }), // 駅ナンバリング (例: M08)
  name: varchar('name', { length: 100 }).notNull(),
  nameEn: varchar('name_en', { length: 100 }),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lon: decimal('lon', { precision: 9, scale: 6 }),
  operatorId: uuid('operator_id').references(() => operators.id).notNull(),
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

  isWheelchairAccessible: boolean('is_wheelchair_accessible').default(true),
  isStrollerAccessible: boolean('is_stroller_accessible').default(true),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const trains = pgTable('trains', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull(),
  operators: uuid('operators').references(() => operators.id).notNull(),
  lines: uuid('lines').references(() => lines.id).array().notNull(),
  carCount: integer('car_count').notNull(),
  carStructure: jsonb('car_configuration').$type<CarStructure>(),
  freeSpaces: jsonb('free_spaces').$type<FreeSpace[]>(),
  prioritySeats: jsonb('priority_seats').$type<PrioritySeat[]>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export type CarStructure = {
  carNumber: number;
  doorCount: number;
};

export type FreeSpace = {
  carNumber: number;
  nearDoor: number;
  isStandard: boolean; // 全編成に装備されているか
}

export type PrioritySeat = {
  carNumber: number;
  nearDoor: number;
}


export const lineDirections = pgTable('line_directions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  directionType: varchar('direction_type', { length: 20 }).notNull(), // 'inbound' | 'outbound'
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
  maxCarCount: integer('max_car_count').notNull(),
  carStopPositions: jsonb('car_stop_positions').$type<CarStopPosition[]>(), // 各両数の停車位置
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export type CarStopPosition = {
  carCount: number;
  frontCarPosition: number; // 先頭車両が停車する号車位置（最大両数基準）
};

export const stationFacilities = pgTable('station_facilities', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformId: uuid('platform_id').references(() => platforms.id).notNull(),
  typeCode: varchar('type_code').references(() => facilityTypes.code).notNull(),
  nearCarNumber: integer('near_car_number'),
  description: text('description'),
  isWheelchairAccessible: boolean('is_wheelchair_accessible').default(true),
  isStrollerAccessible: boolean('is_stroller_accessible').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

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