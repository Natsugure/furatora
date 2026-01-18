import { pgTable, varchar, decimal, integer, timestamp, text, jsonb, uuid, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  code: varchar('code', { length: 20 }),
  name: varchar('name', { length: 100 }).notNull(),
  lat: decimal('lat', { precision: 9, scale: 6 }),
  lon: decimal('lon', { precision: 9, scale: 6 }),
  wheelchairBoarding: integer('wheelchair_boarding'),
  operators: uuid('operators').references(() => operators.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  shortName: varchar('short_name', { length: 50 }),
  longName: varchar('long_name', { length: 100 }).notNull(),
  color: varchar('color', { length: 6 }),
  operators: uuid('operators').references(() => operators.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stationLines = pgTable('station_lines', {
  stationId: uuid('station_id').references(() => stations.id).notNull(),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.stationId, table.lineId] }),
  };
});

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
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const trains = pgTable('trains', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull(),
  operators: uuid('operators').references(() => operators.id).notNull(),
  lines: uuid('lines').references(() => lines.id).array().notNull(),
  freeSpaces: jsonb('free_spaces').$type<{
    car: number;
    door: number;  
  }[]>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});