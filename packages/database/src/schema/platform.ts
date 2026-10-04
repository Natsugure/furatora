// ホームと設備（ホーム・場所・アクセス点・設備・設備マスタ）。
// docs/domain/platform-coordinate-system.md 参照
import { pgTable, varchar, decimal, timestamp, text, uuid, boolean, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { FACILITY_TYPE_CODES, type FacilityTypeCode, type PlatformSide } from '../enums';
import { stations, lines, lineDirections } from './stationMaster';

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
  typeCode: varchar('type_code').references(() => facilityTypes.code).notNull().$type<FacilityTypeCode>(),
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

// 設備の種類のマスタ。code の一覧の正は enums の FACILITY_TYPE_CODES で、この表は CHECK 制約で従う（ADR-0016）。
// station_facilities / transfer_route_facilities の type_code は外部キーでここを参照するので、子に CHECK は要らない
export const facilityTypes = pgTable('facility_types', {
  code: varchar('code', { length: 20 }).primaryKey().$type<FacilityTypeCode>(),
  name: varchar('name', { length: 100 }).notNull(),
}, (t) => [
  // 【値は sql.raw でリテラルとして展開すること】${} でそのまま埋め込む書き方や inArray は、
  // drizzle-kit が IN ($1, $2) を出力してマイグレーションが壊れる。sql.raw を使ってよいのは、
  // 値が利用者の入力ではなくコード内の定数だから。定数を変えると db:generate が DROP / ADD を出力する
  check(
    'facility_types_code_known',
    sql`${t.code} IN (${sql.raw(FACILITY_TYPE_CODES.map((code) => `'${code}'`).join(', '))})`,
  ),
]);
