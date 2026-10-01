// 乗換（接続一覧と乗換難易度）。docs/domain/station-master-model.md「乗換接続」「乗換難易度」参照
import { pgTable, varchar, smallint, timestamp, text, uuid, boolean, unique, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { DirectionType, StationConnectionSource } from '../enums';
import { stations } from './stationMaster';
import { facilityTypes } from './platform';

export const stationConnections = pgTable('station_connections', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationId: uuid('station_id').references(() => stations.id).notNull(),

  // ODPT 同期の廃止（ADR-0007 決定3）に伴い odptStationId / odptRailwayId /
  // connectedRailwayId は削除済み。路線は connectedStationId → stationLines → lines の
  // join で解決する（docs/domain/station-master-model.md「乗換接続（stationConnections）」）
  connectedStationId: uuid('connected_station_id').references(() => stations.id).notNull(),

  // 乗換難易度の旧4列（strollerDifficulty 等）は #136 で削除済み。難易度は
  // transfer_connections 以下の新モデルが持つ（docs/domain/station-master-model.md「乗換難易度」）

  // 行の由来。'ekidata_group' は初回シードで station_g_cd から機械生成された行、
  // 'manual' は管理者が手で足した行、NULL は ODPT 時代の行。
  // 詳細は docs/domain/station-master-model.md「乗換接続」
  source: varchar('source', { length: 20 }).$type<StationConnectionSource>(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  // 【(stationId, connectedStationId) は1行しか持たない】無いと同じ組が重複する。
  // 乗換接続は有向2行で持つ（読み取り側は stationId 一致で片方向しか見ない）。
  // Admin からの作成（apps/admin/src/external/repository/stationConnectionRepository.ts。
  // Issue #88）は (A→B) と (B→A) を1トランザクションで、この制約を衝突対象にした
  // onConflictDoNothing で冪等に挿入する。削除も両方向を対で行う。
  unique('unique_station_connection').on(t.stationId, t.connectedStationId),
]);

// 乗換難易度の新モデル（Issue #30 で定義、#122 で実装）。4層で持つ:
//   transfer_connections（接続）→ connection_routes（接続×ルート）→
//   transfer_routes（ルート）→ transfer_route_facilities（設備）
// ペルソナ別の列は持たない。可否は設備から表示層で導出する（docs/domain/station-master-model.md）。
// 現行の station_connections は接続一覧（乗換できる相手駅）として残る（難易度4列は #136 で削除済み）。
// この4表との間に FK は張れない（旧表は方面を持たない有向2行のため）。

// 無向1行の接続。端点は (stationId, direction_type) × 2 で、方面は両端点とも必須。
// 【端点は昇順に正規化して INSERT すること】check が逆順・同一端点の行を拒否する。
// 正規化は apps/admin/src/features/transfer-connection/domain/normalize.ts。
// 読み取り側は端点の両順序（A,B）と（B,A）を見ること。
// 【比較キーに direction_type を含めること】stations は路線×駅粒度なので今は stationId が
// 路線を含意するが、Issue #82 で物理駅粒度に統合されると stationId だけでは端点が定まらない。
// 同一駅・方面違いの接続が正当になるため、station_a_id <> station_b_id の check は付けない。
// 【direction_type は物理ホームを一意に決めない】分岐駅（中野坂上）では同じ
// (stationId, direction_type) に複数のホームが対応しうる。Issue #128 の対象。
// 【NULLS NOT DISTINCT は不要】方面が NOT NULL のため NULL を含む行が存在しない
export const transferConnections = pgTable('transfer_connections', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  stationAId: uuid('station_a_id').references(() => stations.id).notNull(),
  directionA: varchar('direction_a', { length: 20 }).notNull().$type<DirectionType>(),
  stationBId: uuid('station_b_id').references(() => stations.id).notNull(),
  directionB: varchar('direction_b', { length: 20 }).notNull().$type<DirectionType>(),
  notes: text('notes'),
  // 行の由来。値の意味は station_connections.source と同じ
  source: varchar('source', { length: 20 }).$type<StationConnectionSource>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique('unique_transfer_connection').on(t.stationAId, t.directionA, t.stationBId, t.directionB),
  // uuid はバイト順、方面は 'inbound' < 'outbound'。normalize.ts と同じ順序でなければならない
  check(
    'transfer_connection_endpoints_ordered',
    sql`(${t.stationAId}, ${t.directionA}) < (${t.stationBId}, ${t.directionB})`,
  ),
]);

// 1本の物理経路。接続に従属しない。
// 【connectionId を持たせないこと】方面差の無い駅は最大4行の接続を持ち、それらが同じ物理経路を
// 使う。ルート行を複製せず1本を共有するため、接続との関係は connection_routes が担う。
// 設備の種類の集合と4フラグが一致するルートも DB は拒否しない（集合の一意性は制約で書けず、中身が一致しても
// 別の物理経路でありうる）。二重登録は Admin が保存時に提示する（apps/admin の domain/duplicates.ts）
export const transferRoutes = pgTable('transfer_routes', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  // 所要時分が不明なルートを許容する（迂回度は minutes が揃うときだけ導出する）
  minutes: smallint('minutes'),
  isOutdoor: boolean('is_outdoor').notNull().default(false),
  requiresExitGate: boolean('requires_exit_gate').notNull().default(false),
  requiresStaff: boolean('requires_staff').notNull().default(false),
  isOfficiallyGuided: boolean('is_officially_guided').notNull().default(false),
  // モデルが構造的に表現しない次元（設備の質・時間帯制約等）の受け皿。
  // 出発地に依存する経路上の選好（「〇〇駅のほうが便利」）は書かない
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
});

// 接続とルートの紐付け（多対多）。
// 【label と isBaseline は transfer_routes ではなくこの表に持つこと】ルートが複数の接続から
// 共有されるため、「その接続でこのルートがどう機能するか」は組に属する事実である。
// 接続を消すと紐付けは cascade で消えるが、ルート行は他の接続から共有されうるので消えない。
// 孤立したルートの掃除はアプリ層の責務（apps/admin の external/transferPairSql.ts の deleteOrphanRoutes。docs/domain「不変条件」）
export const connectionRoutes = pgTable('connection_routes', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  connectionId: uuid('connection_id').references(() => transferConnections.id, { onDelete: 'cascade' }).notNull(),
  routeId: uuid('route_id').references(() => transferRoutes.id, { onDelete: 'cascade' }).notNull(),
  // 経路の識別名（「北改札経由」「地上経由」）。識別と表示の二役を担う
  label: varchar('label', { length: 100 }).notNull(),
  // 一般利用者が案内される経路か（迂回度の分母）
  isBaseline: boolean('is_baseline').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  // 属性（フラグ等）を一意キーに含めないこと。事実の訂正が制約に阻まれる
  unique('unique_connection_route_label').on(t.connectionId, t.label),
  unique('unique_connection_route').on(t.connectionId, t.routeId),
  // 【外さないこと】基準ルートは接続あたり高々1本。無いと迂回度（基準ルートとの所要時分の差）の
  // 分母が一意に定まらない。基準ルートの付け替え（既存の降格＋新規の昇格）は2文になるので、
  // Repository + withTransaction で行う（ADR-0005）。Admin の savePair は駅対の紐付けを全部消してから
  // 入れ直すため、順序の問題は起きない。行数の上限はこの制約では表現しない
  uniqueIndex('unique_connection_baseline').on(t.connectionId).where(sql`${t.isBaseline}`),
]);

// ルートが通る設備の種類の集合（順序・回数は持たない。ADR-0011）。1行 = 「この種類をすべて通る」。
// 【代替手段（階段と階段昇降機など）は同一ルートに入れず別ルートにすること】同居させると
// 「階段昇降機のルートはベビーカーが通れない」等の判定が壊れる。
// 【行が0件のルートは「設備未入力」】段差無しは sameFloor を明示する。0件から必要な行為を
// 導出しないこと（ADR-0012。#124・#125 の制約）
export const transferRouteFacilities = pgTable('transfer_route_facilities', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v7()`),
  routeId: uuid('route_id').references(() => transferRoutes.id, { onDelete: 'cascade' }).notNull(),
  typeCode: varchar('type_code').references(() => facilityTypes.code).notNull(),
}, (t) => [
  unique('unique_transfer_route_facility_type').on(t.routeId, t.typeCode),
]);
