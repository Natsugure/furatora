// 駅・路線マスタ（事業者・駅・路線・隣接・方面）。
// docs/domain/station-master-model.md / line-directions.md / station-visibility.md 参照
import { pgTable, varchar, decimal, integer, timestamp, text, uuid, boolean, primaryKey, unique, uniqueIndex, date, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { DirectionType } from '../enums';

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
  // ekidata station_cd。初回シード時の対応スナップショットであり、由来の記録として残す
  // （ADR-0007 決定3）。手動追加された駅は ekidata コードを持ち得ないため nullable のまま。
  // notNull 化しないこと（手動運用そのものを禁じる制約になる）。
  // unique は「2行が同じ ekidata 駅を主張しない」ためで、NULL 行とは共存する
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
}, () => [
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
  // ekidata line_cd。理由は stations.ekidataStationCd と同じ（ADR-0007 決定3）。
  // 由来の記録。手動追加された路線は持ち得ないため nullable のまま。notNull 化しないこと
  ekidataLineCd: integer('ekidata_line_cd').unique(),
  abolishedAt: date('abolished_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

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

export const lineDirections = pgTable('line_directions', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  directionType: varchar('direction_type', { length: 20 }).notNull().$type<DirectionType>(),
  displayName: varchar('display_name', { length: 100 }).notNull(), // "渋谷方面"
  displayNameEn: varchar('display_name_en', { length: 100 }), // "For Shibuya"
  // (路線, 走行方向) の既定の文言。ホームが登録されていない駅の方面ラベルに使う（ADR-0014）。
  isDefault: boolean('is_default').notNull().default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex('unique_line_direction_default').on(t.lineId, t.directionType).where(sql`${t.isDefault}`),
]);

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  name: varchar('name', { length: 100 }).notNull().unique('operators_name_unique'),
  // 【一意制約を付けないこと】理由は stations.odptStationId と同じ（ADR-0007 決定3）
  odptOperatorId: varchar('odpt_operator_id', { length: 100 }), // ODPT API の odpt:operator (例: odpt.Operator:TokyoMetro)
  // 【表示順専用。可視性の意味は持たない】小さいほど先に並ぶ。既定 0。
  // 可視性は stations.publishedAt が単独で担う（docs/domain/station-visibility.md /
  // ADR-0007）。かつては null = 非表示という旧仕様があったが、マイグレーション 0008 で
  // NOT NULL DEFAULT 0 に純化し、可視性の判定から切り離した
  displayPriority: integer('display_priority').notNull().default(0),
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
// この表に書き込むコードは端点 UUID を昇順へ正規化してから INSERT すること。
// これにより辺が逆向きに与えられても重複行にならない。
// 正規化の実装は apps/admin/src/features/station-adjacency/domain/normalize.ts
// （normalizeAdjacencyEndpoints）。Repository が INSERT 前に必ずこれを通す（Issue #88）。
// 隣接を引く側は (stationAId = X OR stationBId = X) の両方を見ること。
// 詳細は docs/domain/station-master-model.md「隣接」
export const stationAdjacencies = pgTable('station_adjacencies', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  lineId: uuid('line_id').references(() => lines.id).notNull(),
  stationAId: uuid('station_a_id').references(() => stations.id).notNull(),
  stationBId: uuid('station_b_id').references(() => stations.id).notNull(),
}, (t) => [
  unique('unique_station_adjacency').on(t.lineId, t.stationAId, t.stationBId),
]);
