// 列車（編成・車両設備・停車位置）。docs/domain/train-stop-patterns.md 参照
import { pgTable, varchar, decimal, integer, timestamp, uuid, boolean, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { operators, lines } from './stationMaster';
import { platforms } from './platform';
import { CAR_NUMBERS_ASCEND_TOWARD, type CarNumbersAscendToward, type TrainEquipmentType } from '../enums';

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

// ホーム・列車の組み合わせごとの停車位置パターン。
// 一意キーは (platformId, trainId) で、方面別の区別は持たない。
// 上下共用の中線を持つ事業者を追加する場合の移行手順は
// docs/domain/train-stop-patterns.md「現在の制約」参照
export const trainStopPatterns = pgTable('train_stop_patterns', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  platformId: uuid('platform_id').references(() => platforms.id, { onDelete: 'cascade' }).notNull(),
  trainId: uuid('train_id').references(() => trains.id, { onDelete: 'cascade' }).notNull(),
  // 停車位置は「1号車の外側の端の座標」と「号車番号の向き」だけで持ち、号車の区間は
  // 列車の号車構成から読むたびに算出する（ADR-0025。算出は packages/platform-diagram の
  // carSegmentsFromCarOne）。号車ごとの区間を保存しないので、両数を変えてもずれない（#215）。
  carOneOuterMeters: decimal('car_one_outer_meters', { precision: 6, scale: 2 }).notNull(),
  carNumbersAscendToward: varchar('car_numbers_ascend_toward', { length: 10 }).$type<CarNumbersAscendToward>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('unique_train_stop_pattern').on(t.platformId, t.trainId),
  // 値は sql.raw でリテラルとして展開する（理由は platform.ts の facility_types_code_known を見る）
  check(
    'train_stop_patterns_ascend_toward_known',
    sql`${t.carNumbersAscendToward} IN (${sql.raw(CAR_NUMBERS_ASCEND_TOWARD.map((v) => `'${v}'`).join(', '))})`,
  ),
]);

