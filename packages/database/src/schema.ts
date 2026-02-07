import { pgTable, varchar, decimal, integer, timestamp, text, jsonb, uuid, boolean, primaryKey, unique, serial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  odptStationId: varchar('odpt_station_id', { length: 100 }), // ODPT API の owl:sameAs (例: odpt.Station:TokyoMetro.Marunouchi.Shinjuku)
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

export const stationAccessibility = pgTable('station_accessibility', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationId: uuid('station_id').references(() => stations.id).notNull(),
  elevators: jsonb('elevators').$type<{
    location: string;
    description?: string;
  }[]>(),
  accessibleRoutes: jsonb('accessible_routes').$type<string[]>(),
  notes: text('notes'),
  verified: boolean('verified').default(false),
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
  platformNumber: varchar('platform_number', { length: 10 }).notNull(), // 番線番号 (例: "1", "2a")
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  inboundDirectionId: uuid('inbound_direction_id').references(() => lineDirections.id), // 上り方向
  outboundDirectionId: uuid('outbound_direction_id').references(() => lineDirections.id), // 下り方向
  maxCarCount: integer('max_car_count').notNull(), // 最大両数
  carStopPositions: jsonb('car_stop_positions').$type<CarStopPosition[]>(), // 各両数の停車位置
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export type CarStopPosition = {
  carCount: number; // 編成両数
  frontCarPosition: number; // 先頭車両が停車する号車位置（最大両数基準）
};

export const stationFacilities = pgTable('station_facilities', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationId: uuid('station_id').references(() => stations.id).notNull(),
  platformId: uuid('platform_id').references(() => platforms.id), // NULL = ホーム外（改札階など）
  type: varchar('type', { length: 20 }).notNull(), // 'elevator' | 'escalator' | 'stairs'
  nearCarNumber: integer('near_car_number'), // ホーム上の場合、最寄り号車番号
  description: text('description'), // 説明 (例: "改札階〜ホーム階")
  isAccessible: boolean('is_accessible').default(true), // ベビーカー・車椅子利用可否
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

export const facilityConnections = pgTable('facility_connections', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  facilityId: uuid('facility_id').references(() => stationFacilities.id, { onDelete: 'cascade' }).notNull(),
  connectionType: varchar('connection_type', { length: 20 }).notNull(), // 'station' | 'same_floor'
  connectedStationId: uuid('connected_station_id').references(() => stations.id), // connectionType='station'の場合
  connectedFacilityId: uuid('connected_facility_id').references(() => stationFacilities.id), // connectionType='same_floor'の場合
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull().unique('operators_name_unique'),
  odptOperatorId: varchar('odpt_operator_id', { length: 100 }), // ODPT API の odpt:operator (例: odpt.Operator:TokyoMetro)
  createdAt: timestamp('created_at').defaultNow(),
});

export const odptMetadata = pgTable('odpt_metadata', {
  id: serial('id').primaryKey(),
  operator: varchar('operator', { length: 50 }).notNull().unique(),
  railwayHash: varchar('railway_hash', { length: 64 }),
  stationHash: varchar('station_hash', { length: 64 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});