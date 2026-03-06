/**
 * 開発環境専用: db:push でスキーマを直接適用した環境の移行修正スクリプト
 *
 * 実行条件:
 *   - __drizzle_migrations に 0000 が未記録
 *   - platform_location_cells テーブルが未作成
 *   - platform_locations に near_platform_cell カラムが存在する
 *
 * 実行後の次ステップ:
 *   1. pnpm run migrate-platform-locations
 *   2. pnpm run db:migrate (0002 クリーンアップ適用)
 */

import { db } from '@furatora/database/client';
import { sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DRIZZLE_DIR = resolve(__dirname, '../../../packages/database/drizzle');

function getHash(filename: string): string {
  const content = readFileSync(resolve(DRIZZLE_DIR, filename), 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('=== 開発環境マイグレーション修正スクリプト ===\n');

  // __drizzle_migrations テーブルの確認
  await db.execute(sql`
    CREATE SCHEMA IF NOT EXISTS drizzle;
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    );
  `);

  // 既存の記録を確認
  const appliedResult = await db.execute(sql`
    SELECT hash FROM drizzle.__drizzle_migrations
  `);
  const appliedRows = Array.isArray(appliedResult)
    ? (appliedResult as Array<Record<string, unknown>>)
    : ((appliedResult as unknown as { rows: Array<Record<string, unknown>> }).rows);
  const applied = appliedRows.map(r => r['hash'] as string);

  const hash0000 = getHash('0000_uneven_ultragirl.sql');
  const hash0001 = getHash('0001_great_romulus.sql');

  // 0000 の記録
  if (!applied.includes(hash0000)) {
    await db.execute(sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash0000}, 1771939832434)
    `);
    console.log('✓ 0000 を __drizzle_migrations に記録しました');
  } else {
    console.log('  0000 は既に記録済みです');
  }

  // 0001 の適用確認
  if (applied.includes(hash0001)) {
    console.log('  0001 は既に適用済みです。スキップします。');
    console.log('\n次のステップ:');
    console.log('  1. pnpm run migrate-platform-locations');
    console.log('  2. pnpm run db:migrate');
    process.exit(0);
  }

  // platform_location_cells の存在確認
  const tableCheck = await db.execute(sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'platform_location_cells'
  `);
  const tableExists = (Array.isArray(tableCheck) ? tableCheck : (tableCheck as { rows: unknown[] }).rows).length > 0;

  if (!tableExists) {
    console.log('\n0001 の SQL を適用中...');

    // 0001: platform_location_cells 作成
    await db.execute(sql`
      CREATE TABLE "platform_location_cells" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v7() NOT NULL,
        "platform_location_id" uuid NOT NULL,
        "near_platform_cell" integer
      )
    `);
    console.log('  ✓ platform_location_cells テーブルを作成しました');

    // 0001: facility_connections に新カラム追加
    await db.execute(sql`ALTER TABLE "facility_connections" ADD COLUMN IF NOT EXISTS "connected_platform_id" uuid`);
    await db.execute(sql`ALTER TABLE "facility_connections" ADD COLUMN IF NOT EXISTS "direction_id" uuid`);
    console.log('  ✓ facility_connections に connected_platform_id, direction_id を追加しました');

    // 0001: station_facilities に nullable カラム追加
    await db.execute(sql`ALTER TABLE "station_facilities" ADD COLUMN IF NOT EXISTS "platform_location_cell_id" uuid`);
    console.log('  ✓ station_facilities に platform_location_cell_id (nullable) を追加しました');

    // 0001: 外部キー制約を追加
    await db.execute(sql`
      ALTER TABLE "platform_location_cells"
      ADD CONSTRAINT "platform_location_cells_platform_location_id_platform_locations_id_fk"
      FOREIGN KEY ("platform_location_id") REFERENCES "public"."platform_locations"("id") ON DELETE cascade
    `);
    await db.execute(sql`
      ALTER TABLE "facility_connections"
      ADD CONSTRAINT "facility_connections_connected_platform_id_platforms_id_fk"
      FOREIGN KEY ("connected_platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action
    `);
    await db.execute(sql`
      ALTER TABLE "facility_connections"
      ADD CONSTRAINT "facility_connections_direction_id_line_directions_id_fk"
      FOREIGN KEY ("direction_id") REFERENCES "public"."line_directions"("id") ON DELETE no action
    `);
    await db.execute(sql`
      ALTER TABLE "station_facilities"
      ADD CONSTRAINT "station_facilities_platform_location_cell_id_platform_location_cells_id_fk"
      FOREIGN KEY ("platform_location_cell_id") REFERENCES "public"."platform_location_cells"("id") ON DELETE cascade
    `);
    console.log('  ✓ 外部キー制約を追加しました');
  } else {
    console.log('  platform_location_cells は既に存在します。スキップします。');
  }

  // 0001 を __drizzle_migrations に記録
  await db.execute(sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash0001}, 1772754725522)
  `);
  console.log('✓ 0001 を __drizzle_migrations に記録しました');

  console.log('\n✓ 開発環境マイグレーション修正が完了しました。');
  console.log('\n次のステップ:');
  console.log('  1. pnpm run migrate-platform-locations');
  console.log('  2. pnpm run db:migrate  (0002 クリーンアップ適用)');
  process.exit(0);
}

main().catch(err => {
  console.error('エラー:', err);
  process.exit(1);
});
